/* Mode local : tout reste dans le navigateur (IndexedDB), aucun serveur. */
'use strict';
window.LocalAPI = (() => {
  const PALETTE = ['#7a2e2e', '#1f4e5f', '#3b5d3a', '#5b3a6b', '#8a5a1c', '#2c3e66', '#6b2d4f', '#355c55', '#7d4b2a', '#3d3d5c'];
  const rid = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-3);
  const now = () => Date.now();

  // ---------- Stockage (IndexedDB, repli en mémoire) ----------
  let dbp = null; const mem = { meta: new Map(), blob: new Map(), prog: new Map() }; let useMem = false;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('bibliotheque-locale', 1);
        r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('meta', { keyPath: 'id' }); d.createObjectStore('blob'); d.createObjectStore('prog', { keyPath: 'book' }); };
        r.onsuccess = () => res(r.result);
        r.onerror = r.onblocked = () => { useMem = true; res(null); };
      } catch { useMem = true; res(null); }
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    if (!d) return fn(null, store);
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const o = t.objectStore(store); let out;
      Promise.resolve(fn(o, store)).then((v) => { out = v; }).catch(rej);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  }
  const rq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = (store, key) => tx(store, 'readonly', (o, s) => o ? rq(o.get(key)) : mem[s].get(key));
  const all = (store) => tx(store, 'readonly', (o, s) => o ? rq(o.getAll()) : [...mem[s].values()]);
  const put = (store, val, key) => tx(store, 'readwrite', (o, s) => { if (!o) { mem[s].set(key ?? val.id ?? val.book, val); return; } return rq(key !== undefined ? o.put(val, key) : o.put(val)); });
  const del = (store, key) => tx(store, 'readwrite', (o, s) => o ? rq(o.delete(key)) : mem[s].delete(key));

  // ---------- pdf.js (embarqué dans le fichier) ----------
  let pdfjsP = null;
  function pdfjs() {
    if (pdfjsP) return pdfjsP;
    pdfjsP = (async () => {
      const dec = (id) => { const b = atob(document.getElementById(id).textContent.trim()); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Blob([u], { type: 'text/javascript' }); };
      let lib, worker;
      const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/';
      let m = null;
      if (document.getElementById('pdfjs-lib')) {
        try { lib = URL.createObjectURL(dec('pdfjs-lib')); worker = URL.createObjectURL(dec('pdfjs-worker')); m = await import(lib); } catch { m = null; }
      }
      if (!m) { worker = CDN + 'pdf.worker.min.mjs'; m = await import(CDN + 'pdf.min.mjs'); } // version en ligne (page publiée)
      m.GlobalWorkerOptions.workerSrc = worker;
      return m;
    })();
    return pdfjsP;
  }
  const docs = new Map();
  async function pdfDoc(id) {
    if (docs.has(id)) return docs.get(id);
    const rec = await get('blob', id); if (!rec?.file) throw new Error('Livre introuvable');
    const lib = await pdfjs();
    const p = rec.file.arrayBuffer().then((data) => lib.getDocument({ data }).promise);
    docs.set(id, p); if (docs.size > 3) docs.delete(docs.keys().next().value);
    p.catch(() => docs.delete(id));
    return p;
  }
  async function renderPage(doc, n, width) {
    const page = await doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(3, width / v1.width);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    return c;
  }

  // ---------- Texte ----------
  function splitText(text, target = 1500) {
    const paras = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const pages = []; let cur = '';
    const push = () => { if (cur.trim()) pages.push(cur.trim()); cur = ''; };
    for (let p of paras) {
      while (p.length > target * 1.4) {
        let cut = p.lastIndexOf('. ', target); if (cut < target * 0.5) cut = p.lastIndexOf(' ', target); if (cut < 1) cut = target;
        if (cur) push(); pages.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1).trim();
      }
      if (cur.length + p.length > target && cur) push();
      cur += (cur ? '\n\n' : '') + p;
    }
    push();
    // un titre ne reste jamais seul en bas de page
    for (let i = 0; i < pages.length - 1; i++) {
      const parts = pages[i].split(/\n{2,}/);
      if (parts.length > 1 && /^#{1,3} /.test(parts[parts.length - 1])) { pages[i + 1] = parts.pop() + '\n\n' + pages[i + 1]; pages[i] = parts.join('\n\n'); }
    }
    return pages.length ? pages : [''];
  }

  // ---------- Word (.docx) : lecture directe de l'archive ----------
  async function unzip(buf) {
    const dv = new DataView(buf); let e = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Fichier Word invalide');
    const n = dv.getUint16(e + 10, true); let off = dv.getUint32(e + 16, true); const files = new Map(); const td = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      files.set(td.decode(new Uint8Array(buf, off + 46, nlen)), { method: dv.getUint16(off + 10, true), csize: dv.getUint32(off + 20, true), lho: dv.getUint32(off + 42, true) });
      off += 46 + nlen + xlen + clen;
    }
    return async (name) => {
      const f = files.get(name); if (!f) return null;
      const start = f.lho + 30 + dv.getUint16(f.lho + 26, true) + dv.getUint16(f.lho + 28, true);
      const data = new Uint8Array(buf, start, f.csize);
      if (f.method === 0) return td.decode(data);
      if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur est trop ancien pour lire les .docx');
      return td.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    };
  }
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  async function readDocx(file) {
    const read = await unzip(await file.arrayBuffer());
    const xml = await read('word/document.xml'); if (!xml) throw new Error('Ce fichier n\'est pas un document Word (.docx)');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Document Word illisible');
    const paras = [];
    const ptext = (p) => {
      let t = '';
      const walk = (n) => { for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue; const ln = c.localName;
        if (ln === 't') t += c.textContent; else if (ln === 'tab') t += ' '; else if (ln === 'br' || ln === 'cr') t += '\n'; else if (ln === 'noBreakHyphen') t += '-';
        else if (['pPr', 'rPr', 'instrText', 'del', 'delText', 'Fallback', 'footnoteReference'].includes(ln)) continue; else walk(c);
      } };
      walk(p); return t.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
    };
    const handleP = (p) => {
      const t = ptext(p); if (!t) return;
      const ppr = [...p.children].find((x) => x.localName === 'pPr');
      const st = ppr ? ([...ppr.children].find((x) => x.localName === 'pStyle')?.getAttributeNS(W, 'val') || '') : '';
      const isList = ppr && [...ppr.children].some((x) => x.localName === 'numPr');
      if (/^(heading\s*\d*|titre\s*\d*|title|subtitle|sous-?titre|titre\d*)$/i.test(st.replace(/\s/g, '')) || /^(Heading|Titre)/i.test(st)) paras.push('# ' + t.replace(/\n/g, ' '));
      else paras.push((isList ? '• ' : '') + t);
    };
    const handleTbl = (tbl) => { for (const tr of tbl.getElementsByTagNameNS(W, 'tr')) {
      const cells = [...tr.children].filter((x) => x.localName === 'tc').map((tc) => [...tc.getElementsByTagNameNS(W, 'p')].map(ptext).filter(Boolean).join(' ')).filter(Boolean);
      if (cells.length) paras.push(cells.join(' · '));
    } };
    const walkBody = (n) => { for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue; const ln = c.localName;
      if (ln === 'p') handleP(c); else if (ln === 'tbl') handleTbl(c); else if (ln !== 'sectPr') walkBody(c);
    } };
    walkBody(doc.getElementsByTagNameNS(W, 'body')[0] || doc.documentElement);
    let title = '', author = '';
    try {
      const core = await read('docProps/core.xml');
      if (core) { const cd = new DOMParser().parseFromString(core, 'application/xml'); title = cd.getElementsByTagName('dc:title')[0]?.textContent?.trim() || ''; author = cd.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || ''; }
    } catch {}
    return { paras, title, author };
  }
  async function decodeText(file) {
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if ((t.match(/�/g) || []).length > 3) t = new TextDecoder('windows-1252').decode(buf);
    return t.replace(/^﻿/, '');
  }
  const pageTextCache = new Map();
  async function pdfText(id, n) {
    const key = id + ':' + n; if (pageTextCache.has(key)) return pageTextCache.get(key);
    const doc = await pdfDoc(id); const page = await doc.getPage(n); const tc = await page.getTextContent();
    let out = '', lastY = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > (it.height || 10) * 1.6) out += '\n\n';
      else if (out && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' ';
      out += it.str; if (it.hasEOL) out += '\n'; lastY = y ?? lastY;
    }
    out = out.replace(/-\n(\w)/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    pageTextCache.set(key, out); if (pageTextCache.size > 60) pageTextCache.delete(pageTextCache.keys().next().value);
    return out;
  }

  // ---------- Livres ----------
  const coverUrls = new Map();
  function coverUrl(id, blob) { if (!blob) return null; if (!coverUrls.has(id)) coverUrls.set(id, URL.createObjectURL(blob)); return coverUrls.get(id); }
  async function bookOut(m) {
    const p = await get('prog', m.id); const rec = m.kind === 'pdf' ? await get('blob', m.id) : null;
    return { id: m.id, title: m.title, author: m.author, kind: m.kind, pages: m.pages, status: 'ready', color: m.color, created: m.created,
      fav: !!m.fav, state: m.state || '', lib: m.lib || 'main', src: m.src || '', cols: m.cols || [], trashed: m.trashed || 0, size: m.fsize || 0,
      coverUrl: rec?.cover ? coverUrl(m.id, rec.cover) : null, progress: p ? { page: p.page, opens: p.opens, last: p.last, pos: p.pos } : null };
  }
  async function upload(file, onp, extra = {}) {
    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (ext === '.doc') throw new Error('Ancien format .doc : enregistre-le en .docx dans Word, puis ajoute-le.');
    const kind = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ['.txt', '.md', '.text'].includes(ext) ? 'txt' : null;
    if (!kind) throw new Error('Formats acceptés : PDF, Word (.docx) ou texte (.txt)');
    const id = rid(); const count = (await all('meta')).length;
    const meta = { id, title: file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Sans titre', author: '', kind, pages: 0, color: PALETTE[count % PALETTE.length], created: now(), position: -count, fname: file.name, fsize: file.size, ...extra };
    onp(30, 'Lecture du fichier…');
    if (kind === 'pdf') {
      const lib = await pdfjs();
      const data = await file.arrayBuffer();
      const doc = await lib.getDocument({ data: data.slice(0) }).promise;
      meta.pages = doc.numPages;
      try {
        const info = (await doc.getMetadata()).info || {};
        if (info.Title && info.Title.length > 2 && info.Title.length < 150 && !/untitled|sans titre|microsoft word|\.(docx?|pdf|indd)$|^document\d*$/i.test(info.Title)) meta.title = info.Title;
        if (info.Author) meta.author = String(info.Author).slice(0, 120);
      } catch {}
      onp(60, 'Création de la couverture…');
      const c = await renderPage(doc, 1, 520);
      const cover = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
      await put('blob', { file, cover }, id);
      try { await doc.cleanup?.(); } catch {}
    } else if (kind === 'docx') {
      onp(45, 'Lecture du document Word…');
      const d = await readDocx(file);
      if (!d.paras.length) throw new Error('Ce document ne contient aucun texte');
      const bad = /untitled|sans titre|microsoft word|python-docx|\.(docx?|pdf)$|^document\d*$/i;
      if (d.title && d.title.length > 2 && d.title.length < 150 && !bad.test(d.title)) meta.title = d.title;
      else { const h1 = d.paras.find((x) => x.startsWith('# ')); if (h1 && h1.length < 120 && meta.title === file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()) meta.title = h1.slice(2); }
      if (d.author && !/^(python-docx|unknown|inconnu|user|utilisateur|admin|microsoft.*|word|openpyxl)$/i.test(d.author)) meta.author = d.author.slice(0, 120);
      onp(75, 'Découpage en pages…');
      const pages = splitText(d.paras.join('\n\n'));
      meta.pages = pages.length;
      await put('blob', { pages }, id);
    } else {
      onp(60, 'Découpage en pages…');
      const pages = splitText(await decodeText(file));
      meta.pages = pages.length;
      await put('blob', { pages }, id);
    }
    await put('meta', meta);
    onp(100);
    return meta;
  }

  // ---------- Routeur (même forme que l'API du serveur) ----------
  const loadCols = () => { try { return JSON.parse(localStorage.getItem('bib.collections') || '[]'); } catch { return []; } };
  const saveCols = (c) => { try { localStorage.setItem('bib.collections', JSON.stringify(c)); } catch {} };
  const libName = () => { try { return localStorage.getItem('bib.libname') || 'Ma Bibliothèque'; } catch { return 'Ma Bibliothèque'; } };
  async function handle(path, opts = {}) {
    const m = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : {};
    let mm;
    if (path === '/api/me') return { library: libName(), setupNeeded: false, role: 'owner', name: 'Propriétaire' };
    if (path === '/api/logout') return { ok: true };
    if (path === '/api/books' && m === 'GET') {
      const metas = (await all('meta')).sort((a, b) => (a.position - b.position) || (b.created - a.created));
      return Promise.all(metas.map(bookOut));
    }
    if ((mm = path.match(/^\/api\/books\/([\w-]+)\/text\/(\d+)$/))) {
      const meta = await get('meta', mm[1]); const n = Number(mm[2]);
      if (!meta || n < 1 || n > meta.pages) throw new Error('Page introuvable');
      if (meta.kind === 'pdf') return { page: n, text: await pdfText(meta.id, n) };
      return { page: n, text: ((await get('blob', meta.id))?.pages || [])[n - 1] || '' };
    }
    if ((mm = path.match(/^\/api\/books\/([\w-]+)$/))) {
      const meta = await get('meta', mm[1]); if (!meta) throw new Error('Livre introuvable');
      if (m === 'PATCH') {
        Object.assign(meta, { title: String(body.title ?? meta.title).slice(0, 200), author: String(body.author ?? meta.author).slice(0, 120), color: String(body.color ?? meta.color) });
        if (body.fav !== undefined) meta.fav = !!body.fav;
        if (body.lib) meta.lib = String(body.lib);
        if (body.state !== undefined) meta.state = ['alire', 'lu'].includes(body.state) ? body.state : '';
        if (Array.isArray(body.cols)) meta.cols = [...new Set(body.cols.map(String))];
        if (body.trashed !== undefined) meta.trashed = body.trashed ? now() : 0;
        await put('meta', meta); return bookOut(meta);
      }
      if (m === 'DELETE') {
        if (meta.src) { try { const ig = JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]'); if (!ig.includes(meta.src)) { ig.push(meta.src); localStorage.setItem('bib.folderIgnored', JSON.stringify(ig)); } } catch {} }
        await del('meta', meta.id); await del('blob', meta.id); await del('prog', meta.id); docs.delete(meta.id);
        const u = coverUrls.get(meta.id); if (u) { URL.revokeObjectURL(u); coverUrls.delete(meta.id); }
        return { ok: true };
      }
      return bookOut(meta);
    }
    if (path === '/api/track' && m === 'POST') {
      const meta = await get('meta', String(body.book || '')); if (!meta) throw new Error('Livre introuvable');
      if (meta.kind !== 'pdf' && Number(body.pages) > 0 && Number(body.pages) !== meta.pages) { meta.pages = Number(body.pages); await put('meta', meta); }
      const page = Math.max(1, Math.min(meta.pages || 1, Number(body.page) || 1)); const t = now();
      let changed = false;
      if (body.type === 'open' && meta.state === 'alire') { meta.state = ''; changed = true; }
      if (body.type === 'page' && meta.pages > 1 && page >= meta.pages && meta.state !== 'lu') { meta.state = 'lu'; changed = true; }
      if (changed) await put('meta', meta);
      const ex = await get('prog', meta.id);
      await put('prog', { book: meta.id, page: body.type === 'open' && body.page == null && ex ? ex.page : page, max_page: Math.max(ex?.max_page || 0, page),
        opens: (ex?.opens || 0) + (body.type === 'open' ? 1 : 0), first: ex?.first || t, last: t, pos: body.pos ?? ex?.pos });
      return { ok: true };
    }
    if (path === '/api/collections') {
      const cols = loadCols();
      if (m === 'POST') {
        const name = String(body.name || '').trim().slice(0, 60); if (!name) throw new Error('Donne un nom à la collection');
        const c = { id: rid(), name, created: now() }; cols.push(c); saveCols(cols); return c;
      }
      return cols;
    }
    if ((mm = path.match(/^\/api\/collections\/([\w-]+)$/))) {
      const cols = loadCols(); const c = cols.find((x) => x.id === mm[1]); if (!c) throw new Error('Collection introuvable');
      if (m === 'PATCH') { c.name = String(body.name || c.name).trim().slice(0, 60) || c.name; saveCols(cols); return c; }
      if (m === 'DELETE') {
        saveCols(cols.filter((x) => x.id !== c.id));
        for (const mt of await all('meta')) if (mt.cols?.includes(c.id)) { mt.cols = mt.cols.filter((x) => x !== c.id); await put('meta', mt); }
        return { ok: true };
      }
      return c;
    }
    if (path === '/api/settings' && m === 'PATCH') {
      if (body.library) { try { localStorage.setItem('bib.libname', String(body.library).slice(0, 80)); } catch {} }
      return { ok: true };
    }
    throw new Error('Non disponible en mode local');
  }

  async function pageCanvas(id, n) {
    const doc = await pdfDoc(id);
    return renderPage(doc, n, Math.min(1800, Math.max(900, Math.round(innerWidth * (devicePixelRatio || 1)))));
  }

  // Demande au navigateur de garder les données (évite l'effacement automatique)
  try { navigator.storage?.persist?.(); } catch {}
  async function paragraphs(id) {
    const rec = await get('blob', id);
    return (rec?.pages || []).join('\n\n').split(/\n{2,}/).filter((x) => x.trim());
  }
  // Ce qui est déjà sur l'étagère, pour ne pas importer deux fois le même livre depuis le dossier
  const clean = (n) => String(n || '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim().toLowerCase();
  async function known(lib = 'main') {
    const src = new Set(), nameSize = new Set(), names = new Set();
    for (const m of await all('meta')) {
      if ((m.lib || 'main') !== lib) continue; // chaque bibliothèque a ses propres livres
      if (m.src) src.add(m.src);
      let fname = m.fname, fsize = m.fsize;
      if (!fname && m.kind === 'pdf') { const rec = await get('blob', m.id); if (rec?.file) { fname = rec.file.name; fsize = rec.file.size; } }
      if (fname) { nameSize.add(fname + '|' + fsize); names.add(clean(fname)); }
      else names.add(clean(m.title)); // anciens livres Word/texte : on compare le titre au nom du fichier
    }
    try { for (const x of JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]')) src.add(x); } catch {}
    return { has: (f) => src.has(f.src) || nameSize.has(f.name + '|' + f.size) || names.has(clean(f.name)) };
  }
  return { handle, upload, pageCanvas, paragraphs, known };
})();
