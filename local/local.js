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
  // Polices standard et tables de caractères : sans elles, le texte de certains PDF ne s'affiche pas (pages blanches)
  const PDF_RES = location.host === 'appassets.local' ? '/pdfjs/' : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/';
  const pdfOpts = (data) => ({ data, standardFontDataUrl: PDF_RES + 'standard_fonts/', cMapUrl: PDF_RES + 'cmaps/', cMapPacked: true, useWorkerFetch: false, isEvalSupported: false });
  const docs = new Map();
  async function pdfDoc(id) {
    if (docs.has(id)) return docs.get(id);
    const rec = await get('blob', id); if (!rec?.file) throw new Error('Livre introuvable');
    const lib = await pdfjs();
    const p = rec.file.arrayBuffer().then((data) => lib.getDocument(pdfOpts(data)).promise);
    docs.set(id, p); if (docs.size > 3) docs.delete(docs.keys().next().value);
    p.catch(() => docs.delete(id));
    return p;
  }
  // Une page est-elle blanche ? (on échantillonne des points)
  function isBlank(c) {
    const g = c.getContext('2d'); const { width: w, height: hh } = c; let dark = 0, n = 0;
    const d = g.getImageData(0, 0, w, hh).data;
    for (let y = 0; y < hh; y += Math.max(1, Math.floor(hh / 120))) for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 80))) { const i = (y * w + x) * 4; n++; if (d[i] + d[i + 1] + d[i + 2] < 690) dark++; }
    return dark / n < 0.004;
  }
  // Couverture : la première page qui n'est pas blanche (beaucoup de PDF commencent par une page vide)
  async function pdfCover(doc) {
    for (let n = 1; n <= Math.min(4, doc.numPages); n++) {
      const c = await renderPage(doc, n, 520);
      if (!isBlank(c)) return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    }
    return null; // tout est blanc : l'étagère dessinera une couverture
  }
  async function renderPage(doc, n, width) {
    const page = await doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(6, width / v1.width);
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
    if (e < 0) throw new Error('Archive invalide ou abîmée');
    const n = dv.getUint16(e + 10, true); let off = dv.getUint32(e + 16, true); const files = new Map(); const td = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      files.set(td.decode(new Uint8Array(buf, off + 46, nlen)), { method: dv.getUint16(off + 10, true), csize: dv.getUint32(off + 20, true), lho: dv.getUint32(off + 42, true) });
      off += 46 + nlen + xlen + clen;
    }
    const read = async (name, raw) => {
      let f = files.get(name);
      if (!f) { const low = name.toLowerCase(); for (const [k, v] of files) if (k.toLowerCase() === low) { f = v; break; } }
      if (!f) return null;
      const start = f.lho + 30 + dv.getUint16(f.lho + 26, true) + dv.getUint16(f.lho + 28, true);
      const data = new Uint8Array(buf, start, f.csize);
      let out = data;
      if (f.method !== 0) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur est trop ancien pour lire ce fichier');
        out = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      }
      return raw ? out : td.decode(out);
    };
    read.names = () => [...files.keys()];
    return read;
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
  // ---------- Autres formats : EPUB, MOBI/AZW, ODT, RTF, HTML, FB2, ancien Word (.doc) ----------
  const clip = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const BLOCKS = new Set(['p', 'div', 'blockquote', 'pre', 'tr', 'dd', 'dt', 'section', 'article', 'figcaption', 'table', 'ul', 'ol', 'dl', 'center', 'aside', 'header', 'footer', 'main', 'hr', 'body', 'poem', 'stanza', 'v', 'epigraph', 'cite']);
  // Transforme du HTML (ou du XML proche) en paragraphes ; les titres deviennent « # titre »
  function htmlParas(root, out) {
    let buf = '';
    const flush = () => { const t = clip(buf); if (t) out.push(t); buf = ''; };
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { buf += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        const t = (c.localName || '').toLowerCase();
        if (['script', 'style', 'head', 'title', 'binary', 'noscript', 'svg', 'math'].includes(t)) continue;
        if (/^h[1-6]$/.test(t)) { flush(); const x = clip(c.textContent); if (x) out.push((Number(t[1]) <= 3 ? '# ' : '') + x); continue; }
        if (t === 'br') { flush(); continue; }
        if (t === 'li') { flush(); buf = '• '; walk(c); flush(); continue; }
        if (BLOCKS.has(t)) { flush(); walk(c); flush(); continue; }
        walk(c);
      }
    };
    walk(root); flush();
    return out;
  }
  // Décode du texte en respectant l'encodage annoncé (<?xml encoding=…?> ou <meta charset=…>)
  function decodeBytes(bytes, fallback = 'utf-8') {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
    const m = head.match(/encoding=["']([\w-]+)["']/i) || head.match(/charset=["']?([\w-]+)/i);
    let enc = (m ? m[1] : fallback).toLowerCase();
    try { new TextDecoder(enc); } catch { enc = 'utf-8'; }
    let t = new TextDecoder(enc).decode(bytes);
    if (enc === 'utf-8' && (t.match(/�/g) || []).length > 3) t = new TextDecoder('windows-1252').decode(bytes);
    return t.replace(/^﻿/, '');
  }
  const parseHtml = (text) => new DOMParser().parseFromString(text, 'text/html');
  const parseXml = (text) => { const d = new DOMParser().parseFromString(text, 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; };
  // Couverture : réduite comme celles des PDF
  async function coverFrom(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      if (bmp.width < 40 || bmp.height < 40) return null;
      const w = Math.min(520, bmp.width), hh = Math.round(w * (bmp.height / bmp.width));
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.drawImage(bmp, 0, 0, w, hh);
      return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    } catch { return null; }
  }
  const imgType = (b) => b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : 'image/webp';
  const DC = 'http://purl.org/dc/elements/1.1/';
  const dcGet = (d, k) => clip(d.getElementsByTagNameNS(DC, k)[0]?.textContent || d.getElementsByTagName('dc:' + k)[0]?.textContent || '');

  async function readEpub(file) {
    const read = await unzip(await file.arrayBuffer());
    const cont = parseXml((await read('META-INF/container.xml')) || '');
    const opfPath = cont?.getElementsByTagName('rootfile')[0]?.getAttribute('full-path') || read.names().find((n) => /\.opf$/i.test(n));
    if (!opfPath) throw new Error('Livre EPUB illisible');
    const opf = parseXml((await read(opfPath)) || '');
    if (!opf) throw new Error('Livre EPUB illisible');
    const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const resolve = (href) => {
      const parts = (base + decodeURIComponent(href.split('#')[0])).split('/'); const out = [];
      for (const x of parts) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }
      return out.join('/');
    };
    const items = new Map();
    for (const it of opf.getElementsByTagName('item')) items.set(it.getAttribute('id'), { href: it.getAttribute('href') || '', type: it.getAttribute('media-type') || '', props: it.getAttribute('properties') || '' });
    let spine = [...opf.getElementsByTagName('itemref')].filter((r) => r.getAttribute('linear') !== 'no').map((r) => items.get(r.getAttribute('idref'))).filter(Boolean);
    if (!spine.length) spine = [...items.values()].filter((x) => /html/.test(x.type));
    const paras = [];
    for (const it of spine) {
      const raw = await read(resolve(it.href), true); if (!raw) continue;
      const d = parseHtml(decodeBytes(raw));
      htmlParas(d.body || d.documentElement, paras);
    }
    const title = dcGet(opf, 'title'), author = dcGet(opf, 'creator');
    // couverture : déclarée par « cover-image », par <meta name="cover">, ou une image nommée « cover »
    let cov = [...items.values()].find((x) => /cover-image/.test(x.props));
    if (!cov) { const id = [...opf.getElementsByTagName('meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content'); if (id) cov = items.get(id); }
    if (!cov) cov = [...items.values()].find((x) => /^image\//.test(x.type) && /cover|couverture/i.test(x.href));
    let cover = null;
    if (cov && /^image\//.test(cov.type)) { const b = await read(resolve(cov.href), true); if (b) cover = await coverFrom(new Blob([b], { type: cov.type })); }
    return { paras, title, author, cover };
  }

  async function readOdt(file) {
    const read = await unzip(await file.arrayBuffer());
    const d = parseXml((await read('content.xml')) || '');
    if (!d) throw new Error('Document OpenDocument illisible');
    const paras = [];
    const txt = (n) => { let t = ''; for (const c of n.childNodes) { if (c.nodeType === 3) t += c.nodeValue; else if (c.nodeType === 1) { const l = c.localName; if (l === 's') t += ' '.repeat(Number(c.getAttribute('text:c')) || 1); else if (l === 'tab') t += ' '; else if (l === 'line-break') t += ' '; else if (l !== 'note' && l !== 'annotation') t += txt(c); } } return t; };
    const walk = (n, inList) => { for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue; const l = c.localName;
      if (l === 'h') { const t = clip(txt(c)); if (t) paras.push('# ' + t); }
      else if (l === 'p') { const t = clip(txt(c)); if (t) paras.push((inList ? '• ' : '') + t); }
      else walk(c, inList || l === 'list-item');
    } };
    walk(d.getElementsByTagName('office:body')[0] || d.documentElement, false);
    let title = '', author = '';
    try { const m = parseXml((await read('meta.xml')) || ''); if (m) { title = dcGet(m, 'title'); author = dcGet(m, 'creator') || clip(m.getElementsByTagName('meta:initial-creator')[0]?.textContent); } } catch {}
    return { paras, title, author };
  }

  function rtfText(s) {
    const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf', 'listtable', 'listoverridetable', 'rsidtbl', 'themedata', 'colorschememapping', 'datastore', 'xmlnstbl', 'latentstyles', 'generator', 'filetbl', 'revtbl', 'fldinst', 'bkmkstart', 'bkmkend', 'footnote']);
    const cp = new TextDecoder('windows-1252');
    let out = '', skip = false, uc = 1, pend = 0; const stack = [];
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === '{') { stack.push([skip, uc]); i++; continue; }
      if (c === '}') { [skip, uc] = stack.pop() || [false, 1]; i++; continue; }
      if (c === '\r' || c === '\n') { i++; continue; }
      if (c !== '\\') { if (pend) pend--; else if (!skip) out += c; i++; continue; }
      const n = s[i + 1];
      if (n === '\\' || n === '{' || n === '}') { if (!skip) out += n; i += 2; continue; }
      if (n === "'") { if (pend) pend--; else if (!skip) out += cp.decode(Uint8Array.of(parseInt(s.substr(i + 2, 2), 16) || 32)); i += 4; continue; }
      if (n === '*') { skip = true; i += 2; continue; }
      if (n === '~') { if (!skip) out += ' '; i += 2; continue; }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40));
      if (!m) { i += 2; continue; }
      i += m[0].length; const w = m[1], arg = m[2] !== undefined ? Number(m[2]) : null;
      if (SKIP.has(w)) skip = true;
      else if (skip) continue;
      else if (w === 'par' || w === 'sect' || w === 'page') out += '\n\n';
      else if (w === 'line') out += '\n';
      else if (w === 'tab' || w === 'cell') out += ' ';
      else if (w === 'emdash') out += '—'; else if (w === 'endash') out += '–';
      else if (w === 'lquote') out += '‘'; else if (w === 'rquote') out += '’'; else if (w === 'ldblquote') out += '“'; else if (w === 'rdblquote') out += '”';
      else if (w === 'uc') uc = arg ?? 1;
      else if (w === 'u' && arg !== null) { out += String.fromCharCode(arg < 0 ? arg + 65536 : arg); pend = uc; }
    }
    return out;
  }

  function readFb2(text) {
    const d = parseXml(text) || parseHtml(text);
    const q = (n, sel) => n.getElementsByTagName(sel);
    const paras = [];
    const walk = (n) => { for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue; const l = c.localName;
      if (l === 'title') { const t = clip(c.textContent); if (t) paras.push('# ' + t); }
      else if (l === 'p' || l === 'v' || l === 'subtitle' || l === 'text-author') { const t = clip(c.textContent); if (t) paras.push(t); }
      else if (l !== 'binary' && l !== 'description') walk(c);
    } };
    for (const b of q(d, 'body')) walk(b);
    const ti = q(d, 'title-info')[0];
    const title = clip(ti && q(ti, 'book-title')[0]?.textContent);
    const a = ti && q(ti, 'author')[0];
    const author = a ? clip(['first-name', 'middle-name', 'last-name'].map((k) => q(a, k)[0]?.textContent || '').join(' ')) : '';
    let coverBlob = null;
    const img = ti && q(ti, 'coverpage')[0]?.getElementsByTagName('*');
    const ref = img && [...img].find((x) => x.localName === 'image');
    const href = ref && [...ref.attributes].find((x) => /href$/.test(x.name))?.value;
    if (href) {
      const bin = [...q(d, 'binary')].find((x) => x.getAttribute('id') === href.replace(/^#/, ''));
      if (bin) { try { const raw = atob(bin.textContent.replace(/\s+/g, '')); const u = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i); coverBlob = new Blob([u], { type: bin.getAttribute('content-type') || imgType(u) }); } catch {} }
    }
    return { paras, title, author, coverBlob };
  }

  async function readMobi(file) {
    const buf = await file.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
    const nrec = dv.getUint16(76), rec = (i) => dv.getUint32(78 + i * 8), end = (i) => (i + 1 < nrec ? rec(i + 1) : buf.byteLength);
    const r0 = rec(0), comp = dv.getUint16(r0), ntext = dv.getUint16(r0 + 8), crypt = dv.getUint16(r0 + 12);
    if (crypt) throw new Error('Ce livre Kindle est protégé (DRM) : impossible de le lire ailleurs que dans Kindle');
    if (comp === 17480) throw new Error('Ce livre Kindle utilise une compression non prise en charge');
    const isMobi = new TextDecoder('latin1').decode(u8.subarray(r0 + 16, r0 + 20)) === 'MOBI';
    const hlen = isMobi ? dv.getUint32(r0 + 20) : 0, encoding = isMobi ? dv.getUint32(r0 + 28) : 1252;
    const flags = isMobi && hlen >= 0xe4 ? dv.getUint16(r0 + 0xf2) : 0;
    const trailing = (d) => {
      let num = 0;
      for (let f = flags >> 1; f; f >>= 1) if (f & 1) { let bit = 0, res = 0, sz = d.length - num; for (;;) { const v = d[sz - 1]; res |= (v & 0x7f) << bit; bit += 7; sz--; if (v & 0x80 || bit >= 28 || sz === 0) break; } num += res; }
      if (flags & 1) num += (d[d.length - num - 1] & 3) + 1;
      return num;
    };
    const palm = (d) => {
      const out = []; let i = 0;
      while (i < d.length) {
        const c = d[i++];
        if (c === 0 || (c >= 9 && c <= 0x7f)) out.push(c);
        else if (c <= 8) { for (let k = 0; k < c && i < d.length; k++) out.push(d[i++]); }
        else if (c <= 0xbf) { const v = (c << 8) | d[i++]; const dist = (v >> 3) & 0x7ff, n = (v & 7) + 3; for (let k = 0; k < n; k++) out.push(out[out.length - dist]); }
        else out.push(0x20, c ^ 0x80);
      }
      return out;
    };
    const parts = []; let total = 0;
    for (let i = 1; i <= ntext && i < nrec; i++) {
      let d = u8.subarray(rec(i), end(i)); d = d.subarray(0, d.length - trailing(d));
      const x = comp === 2 ? Uint8Array.from(palm(d)) : d; parts.push(x); total += x.length;
    }
    const all = new Uint8Array(total); let o = 0; for (const x of parts) { all.set(x, o); o += x.length; }
    const html = new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252').decode(all).replace(/<mbp:pagebreak\s*\/?>/gi, '<p></p>');
    const paras = htmlParas(parseHtml(html).body, []);
    let title = '', author = '', cover = null;
    if (isMobi) {
      try { title = new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252').decode(u8.subarray(r0 + dv.getUint32(r0 + 84), r0 + dv.getUint32(r0 + 84) + dv.getUint32(r0 + 88))).trim(); } catch {}
      try {
        const firstImg = dv.getUint32(r0 + 0x6c);
        if (dv.getUint32(r0 + 0x80) & 0x40) {
          let p = r0 + 16 + hlen; const n = dv.getUint32(p + 8); p += 12;
          for (let k = 0; k < n; k++) {
            const t = dv.getUint32(p), l = dv.getUint32(p + 4), data = u8.subarray(p + 8, p + l);
            if (t === 100 && !author) author = new TextDecoder().decode(data).trim();
            if (t === 503) title = new TextDecoder().decode(data).trim() || title;
            if (t === 201) { const ri = firstImg + new DataView(data.buffer, data.byteOffset, 4).getUint32(0); if (ri < nrec) { const b = u8.subarray(rec(ri), end(ri)); cover = await coverFrom(new Blob([b], { type: imgType(b) })); } }
            p += l;
          }
        }
      } catch {}
    }
    return { paras, title, author, cover };
  }

  // Ancien Word (.doc) : on récupère le texte lisible (la mise en forme est perdue)
  function readDoc(bytes) {
    const runs = (t) => (t.match(/[^\u0000-\u0008\u000e-\u001f�￿]{40,}/g) || []).filter((x) => /[a-zà-ÿ]{3,}\s+[a-zà-ÿ]{2,}/i.test(x) && (x.match(/[a-zà-ÿ ]/gi) || []).length > x.length * 0.7);
    const a = runs(new TextDecoder('utf-16le').decode(bytes.subarray(0, bytes.length & ~1))), b = runs(new TextDecoder('windows-1252').decode(bytes));
    const best = a.join('').length >= b.join('').length ? a : b;
    const paras = best.join('\r').split(/[\r\u0007\u000b\n]+/).map(clip).filter((x) => x.length > 1);
    if (paras.join(' ').length < 40) throw new Error('Texte introuvable dans ce document Word ancien : enregistre-le en .docx dans Word, puis ajoute-le.');
    return { paras };
  }

  // ---------- Livres audio : titre, auteur, couverture, chapitres (ID3 pour MP3, atomes MP4 pour M4B/M4A) ----------
  const latin = new TextDecoder('latin1');
  async function sliceBytes(file, a, b) { return new Uint8Array(await file.slice(a, b).arrayBuffer()); }
  function id3Text(d) {
    const enc = d[0], body = d.subarray(1);
    const dec = enc === 3 ? new TextDecoder('utf-8') : enc === 1 ? new TextDecoder('utf-16') : enc === 2 ? new TextDecoder('utf-16be') : latin;
    return dec.decode(body).replace(/\u0000+$/g, '').split('\u0000')[0].trim();
  }
  async function readId3(file) {
    const head = await sliceBytes(file, 0, 10);
    if (latin.decode(head.subarray(0, 3)) !== 'ID3') return {};
    const ver = head[3], size = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9];
    const d = await sliceBytes(file, 10, 10 + Math.min(size, 30e6));
    const out = { chapters: [] }; let o = 0;
    const readFrames = (buf, start, end, into) => {
      let i = start;
      while (i + 10 <= end) {
        const id = latin.decode(buf.subarray(i, i + 4)); if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const fs = ver === 4 ? (buf[i + 4] << 21) | (buf[i + 5] << 14) | (buf[i + 6] << 7) | buf[i + 7] : ((buf[i + 4] << 24) | (buf[i + 5] << 16) | (buf[i + 6] << 8) | buf[i + 7]) >>> 0;
        const f = buf.subarray(i + 10, i + 10 + fs); i += 10 + fs;
        if (id === 'TIT2') into.title = id3Text(f); else if (id === 'TPE1') into.author = id3Text(f); else if (id === 'TALB') into.album = id3Text(f);
        else if (id === 'APIC' && !into.cover) {
          let k = 1; while (k < f.length && f[k]) k++; const mime = latin.decode(f.subarray(1, k)) || 'image/jpeg'; k += 2; // type d'image
          if (f[0] === 1 || f[0] === 2) { while (k + 1 < f.length && (f[k] || f[k + 1])) k += 2; k += 2; } else { while (k < f.length && f[k]) k++; k++; }
          into.cover = new Blob([f.subarray(k)], { type: mime.includes('/') ? mime : 'image/' + mime.toLowerCase() });
        } else if (id === 'CHAP') {
          let k = 0; while (k < f.length && f[k]) k++; k++;
          const dv = new DataView(f.buffer, f.byteOffset + k, 16); const ch = { start: dv.getUint32(0) / 1000 };
          readFrames(f, k + 16, f.length, ch); out.chapters.push({ start: ch.start, title: ch.title || '' });
        }
      }
    };
    readFrames(d, 0, d.length, out);
    out.chapters.sort((a, b) => a.start - b.start);
    return out;
  }
  async function readMp4(file) {
    const out = { chapters: [] };
    const atoms = async (start, end, fn) => { let o = start; while (o + 8 <= end) { const h = await sliceBytes(file, o, o + 16); const dv = new DataView(h.buffer); let sz = dv.getUint32(0); const ty = latin.decode(h.subarray(4, 8)); let hl = 8; if (sz === 1) { sz = Number(dv.getBigUint64(8)); hl = 16; } else if (sz === 0) sz = end - o; if (sz < 8) break; await fn(ty, o + hl, o + sz); o += sz; } };
    let moov = null; await atoms(0, file.size, async (ty, a, b) => { if (ty === 'moov') moov = [a, b]; });
    if (!moov || moov[1] - moov[0] > 60e6) return out;
    const m = await sliceBytes(file, moov[0], moov[1]); const base = moov[0];
    const dv = new DataView(m.buffer);
    const walk = (a, b, path) => { let o = a; while (o + 8 <= b) {
      let sz = dv.getUint32(o); const ty = latin.decode(m.subarray(o + 4, o + 8)); if (sz < 8 || o + sz > b) break;
      const p = path + '/' + ty;
      if (['/udta', '/udta/meta', '/udta/meta/ilst', '/trak', '/trak/mdia'].some((x) => p.endsWith(x)) || /\/ilst\/[^/]+$/.test(p)) walk(o + 8 + (ty === 'meta' ? 4 : 0), o + sz, p);
      else if (ty === 'data' && /\/ilst\//.test(p)) {
        const key = path.split('/').pop(), payload = m.subarray(o + 16, o + sz), td = new TextDecoder();
        if (key === '©nam') out.title = td.decode(payload); else if (key === '©ART' || (key === 'aART' && !out.author)) out.author = td.decode(payload);
        else if (key === '©alb') out.album = td.decode(payload); else if (key === 'covr' && !out.cover) out.cover = new Blob([payload], { type: imgType(payload) });
      } else if (ty === 'chpl') {
        const v = m[o + 8]; let k = o + 12 + (v === 1 ? 4 : 0); const n = m[k++];
        for (let c = 0; c < n && k + 9 <= o + sz; c++) { const t = Number(new DataView(m.buffer, k, 8).getBigUint64(0)) / 1e7; const l = m[k + 8]; out.chapters.push({ start: t, title: new TextDecoder().decode(m.subarray(k + 9, k + 9 + l)) }); k += 9 + l; }
      }
      o += sz;
    } };
    walk(0, m.length, '');
    return out;
  }
  function durationOf(file) {
    return new Promise((res) => {
      const a = document.createElement('audio'); const url = URL.createObjectURL(file); let done = false;
      const end = (v) => { if (done) return; done = true; URL.revokeObjectURL(url); res(Number.isFinite(v) ? v : 0); };
      a.preload = 'metadata'; a.onloadedmetadata = () => end(a.duration); a.onerror = () => end(0); setTimeout(() => end(0), 10000); a.src = url;
    });
  }
  async function audioMeta(file) {
    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    let m = {};
    try { m = ['.m4b', '.m4a', '.aac'].includes(ext) ? await readMp4(file) : ext === '.mp3' ? await readId3(file) : {}; } catch { m = {}; }
    return { ...m, dur: await durationOf(file) };
  }
  // Un livre audio : un seul fichier, ou plusieurs pistes (les fichiers d'un même dossier, dans l'ordre)
  async function uploadAudio(files, onp, extra = {}) {
    files = [...files].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    const id = rid(); const count = (await all('meta')).length;
    const tracks = []; let first = null;
    for (let i = 0; i < files.length; i++) {
      onp(Math.round((i / files.length) * 90), `Lecture de la piste ${i + 1} sur ${files.length}…`);
      const am = await audioMeta(files[i]); if (!first) first = am;
      tracks.push({ name: files[i].name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim(), title: am.title || '', dur: am.dur || 0 });
    }
    const common = (() => { if (files.length < 2) return ''; let p = files[0].name; for (const f of files) while (p && !f.name.startsWith(p)) p = p.slice(0, -1); return p.replace(/[\s\-_.(\[]*\d*$/, '').trim(); })();
    const chapters = files.length > 1 ? tracks.map((t, i) => ({ track: i, start: 0, title: t.title && !tracks.every((x) => x.title === t.title) ? t.title : t.name }))
      : (first.chapters || []).filter((c) => c.title || c.start >= 0).map((c) => ({ track: 0, start: c.start, title: c.title }));
    const meta = { id, title: (files.length > 1 ? first.album || common : first.title || first.album) || files[0].name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim(), author: first.author || '', kind: 'audio',
      pages: tracks.length, tracks, chapters, dur: tracks.reduce((a, t) => a + t.dur, 0), color: PALETTE[count % PALETTE.length], created: now(), position: -count,
      fname: files[0].name, fsize: files.reduce((a, f) => a + f.size, 0), ...extra };
    const cover = first.cover ? await coverFrom(first.cover) : null;
    if (cover) meta.hasCover = true;
    await put('blob', files.length > 1 ? { files, cover } : { file: files[0], cover }, id);
    await put('meta', meta); onp(100);
    return meta;
  }
  // ---------- Livres en images : bandes dessinées CBZ, photos de pages (plusieurs photos = un livre) ----------
  const IMG_RE = /\.(jpe?g|png|webp|gif|bmp)$/i;
  async function uploadImages(files, onp, extra = {}) {
    const imgs = [];
    for (const f of files) {
      if (IMG_RE.test(f.name)) { imgs.push({ name: f.name, blob: f }); continue; }
      onp(10, 'Ouverture de l\'archive…');
      const read = await unzip(await f.arrayBuffer());
      for (const n of read.names().filter((x) => IMG_RE.test(x) && !/(^|\/)(__MACOSX|\.)/.test(x))) {
        const b = await read(n, true); imgs.push({ name: n, blob: new Blob([b], { type: imgType(b) }) });
      }
    }
    if (!imgs.length) throw new Error('Aucune image de page dans ce fichier');
    imgs.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    onp(70, 'Création de la couverture…');
    const id = rid(); const count = (await all('meta')).length;
    const base = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : (() => { let p = files[0].name; for (const f of files) while (p && !f.name.startsWith(p)) p = p.slice(0, -1); return p.replace(/[\s\-_.(\[]*\d*$/, '').trim() || 'Pages photographiées'; })();
    const cover = await coverFrom(imgs[0].blob);
    const meta = { id, title: base.replace(/_+/g, ' ').trim() || 'Sans titre', author: '', kind: 'images', pages: imgs.length, color: PALETTE[count % PALETTE.length], created: now(), position: -count,
      fname: files[0].name, fsize: files.reduce((a, f) => a + f.size, 0), hasCover: !!cover, ...extra };
    await put('blob', { images: imgs.map((x) => x.blob), file: files.length === 1 ? files[0] : null, cover }, id);
    await put('meta', meta); onp(100);
    return meta;
  }
  async function imageCanvas(id, n, width) {
    const rec = await get('blob', id); const bl = rec?.images?.[n - 1]; if (!bl) throw new Error('Page introuvable');
    const bmp = await createImageBitmap(bl); const w = Math.min(width, bmp.width * 2), hh = Math.round(w * (bmp.height / bmp.width));
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, hh);
    return c;
  }
  // ---------- Texte reconnu sur les pages photographiées (OCR) ----------
  async function ocrGet(id) { return (await get('blob', 'ocr:' + id))?.pages || []; }
  async function ocrSave(id, pages, done) {
    await put('blob', { pages }, 'ocr:' + id);
    const m = await get('meta', id); if (m) { m.ocr = done ? 'done' : 'partial'; await put('meta', m); }
  }
  async function ocrForget(id) { await del('blob', 'ocr:' + id); const m = await get('meta', id); if (m) { delete m.ocr; await put('meta', m); } }
  const audioUrls = new Map();
  async function audioOf(id) {
    const rec = await get('blob', id); const list = rec?.files || (rec?.file ? [rec.file] : []);
    if (!audioUrls.has(id)) audioUrls.set(id, list.map((f) => URL.createObjectURL(f)));
    return audioUrls.get(id);
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
    const p = await get('prog', m.id); const rec = m.kind === 'pdf' || m.hasCover ? await get('blob', m.id) : null;
    return { id: m.id, title: m.title, author: m.author, kind: m.kind, pages: m.pages, status: 'ready', color: m.color, created: m.created,
      tracks: m.tracks, chapters: m.chapters, dur: m.dur, ocr: m.ocr || '',
      fav: !!m.fav, state: m.state || '', lib: m.lib || 'main', src: m.src || '', fname: m.fname || '', summary: m.summary || null, cols: m.cols || [], trashed: m.trashed || 0, size: m.fsize || 0,
      coverUrl: rec?.cover ? coverUrl(m.id, rec.cover) : null, progress: p ? { page: p.page, opens: p.opens, last: p.last, pos: p.pos } : null };
  }
  const BAD_TITLE = /^(untitled|sans titre|document\d*|pdf|adobe .*|microsoft (word|powerpoint) - .*|.*photoshop.*|.*indesign.*|.*acrobat.*|.*\.(docx?|pdf|indd|qxd|psd|tiff?|jpe?g))$/i;
  const KIND_OF = { '.pdf': 'pdf', '.docx': 'docx', '.txt': 'txt', '.md': 'txt', '.text': 'txt', '.markdown': 'txt', '.log': 'txt', '.csv': 'txt',
    '.epub': 'epub', '.mobi': 'mobi', '.azw': 'mobi', '.azw3': 'mobi', '.prc': 'mobi', '.odt': 'odt', '.rtf': 'rtf', '.fb2': 'fb2', '.doc': 'doc',
    '.html': 'html', '.htm': 'html', '.xhtml': 'html',
    '.cbz': 'images', '.jpg': 'images', '.jpeg': 'images', '.png': 'images', '.webp': 'images', '.fbz': 'fb2',
    '.mp3': 'audio', '.m4b': 'audio', '.m4a': 'audio', '.aac': 'audio', '.ogg': 'audio', '.oga': 'audio', '.opus': 'audio', '.flac': 'audio', '.wav': 'audio' };
  async function upload(file, onp, extra = {}) {
    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (KIND_OF[ext] === 'audio') return uploadAudio([file], onp, extra);
    if (KIND_OF[ext] === 'images' || (ext === '.zip' && !/\.fb2\.zip$/i.test(file.name))) return uploadImages([file], onp, extra);
    if (/\.fb2\.zip$/i.test(file.name) || ext === '.fbz') { // FictionBook compressé : on sort le .fb2 de l'archive
      const read = await unzip(await file.arrayBuffer()); const nm = read.names().find((n) => /\.fb2$/i.test(n));
      if (!nm) throw new Error('Aucun livre FB2 dans cette archive');
      const inner = new File([await read(nm, true)], nm.split('/').pop());
      return upload(inner, onp, { ...extra, fname: file.name, fsize: file.size });
    }
    const kind = KIND_OF[ext] || null;
    if (!kind) throw new Error('Formats acceptés : PDF, EPUB, Kindle (MOBI, AZW), Word, OpenDocument, RTF, HTML, FB2 et texte');
    const id = rid(); const count = (await all('meta')).length;
    const meta = { id, title: file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Sans titre', author: '', kind, pages: 0, color: PALETTE[count % PALETTE.length], created: now(), position: -count, fname: file.name, fsize: file.size, ...extra };
    onp(30, 'Lecture du fichier…');
    if (kind === 'pdf') {
      const lib = await pdfjs();
      const data = await file.arrayBuffer();
      const doc = await lib.getDocument(pdfOpts(data.slice(0))).promise;
      meta.pages = doc.numPages;
      try {
        const info = (await doc.getMetadata()).info || {};
        if (info.Title && info.Title.length > 2 && info.Title.length < 150 && !BAD_TITLE.test(info.Title.trim())) meta.title = info.Title;
        if (info.Author) meta.author = String(info.Author).slice(0, 120);
      } catch {}
      onp(60, 'Création de la couverture…');
      const cover = await pdfCover(doc);
      await put('blob', { file, cover }, id);
      if (!cover) meta.noCover = true;
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
      await put('blob', { pages, file }, id);
    } else if (kind !== 'txt') {
      onp(45, 'Lecture du livre…');
      let d;
      if (kind === 'epub') d = await readEpub(file);
      else if (kind === 'mobi') d = await readMobi(file);
      else if (kind === 'odt') d = await readOdt(file);
      else if (kind === 'rtf') { const raw = await decodeText(file); const info = (k) => clip(rtfText('{' + ((raw.match(new RegExp('\\{\\\\' + k + '\\s([^}]*)\\}')) || [])[1] || '') + '}')); d = { paras: rtfText(raw).split(/\n{2,}/).map(clip).filter(Boolean), title: info('title'), author: info('author') }; }
      else if (kind === 'fb2') { d = readFb2(decodeBytes(new Uint8Array(await file.arrayBuffer()))); if (d.coverBlob) d.cover = await coverFrom(d.coverBlob); }
      else if (kind === 'doc') d = readDoc(new Uint8Array(await file.arrayBuffer()));
      else { // page web ou fichier HTML : on garde l'article, sans menus ni pieds de page
        const doc = parseHtml(decodeBytes(new Uint8Array(await file.arrayBuffer())));
        doc.querySelectorAll('nav, footer, aside, form, script, style, noscript, iframe, [role="navigation"], [role="banner"], [role="contentinfo"], .comments, #comments, .share, .social, .advert, .ad, .cookie, .newsletter').forEach((x) => x.remove());
        const arts = [...doc.querySelectorAll('article, main, [role="main"], .post-content, .entry-content, .article-body')].sort((x, y) => y.textContent.length - x.textContent.length);
        const root = arts[0] && arts[0].textContent.trim().length > 400 ? arts[0] : (doc.body || doc.documentElement);
        if (root === doc.body) root.querySelectorAll('header').forEach((x) => x.remove());
        const og = doc.querySelector('meta[property="og:title"]')?.content, by = doc.querySelector('meta[name="author"]')?.content;
        d = { paras: htmlParas(root, []), title: clip(og || doc.querySelector('h1')?.textContent || doc.title).slice(0, 140), author: clip(by) };
      }
      if (!d.paras.length) throw new Error('Ce livre ne contient aucun texte lisible');
      const bad = /untitled|sans titre|unknown|inconnu|microsoft word|calibre|\.(docx?|pdf|epub|html?)$|^document\d*$/i;
      if (d.title && d.title.length > 1 && d.title.length < 150 && !bad.test(d.title)) meta.title = d.title;
      if (d.author && !bad.test(d.author)) meta.author = d.author.slice(0, 120);
      onp(75, 'Découpage en pages…');
      const pages = splitText(d.paras.join('\n\n'));
      meta.pages = pages.length;
      await put('blob', d.cover ? { pages, file, cover: d.cover } : { pages, file }, id);
    } else {
      onp(60, 'Découpage en pages…');
      const pages = splitText(await decodeText(file));
      meta.pages = pages.length;
      await put('blob', { pages, file }, id);
    }
    if (kind !== 'pdf') { const r = await get('blob', id); if (r?.cover) meta.hasCover = true; }
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
      if (meta.kind === 'pdf' || meta.kind === 'images') { // page photographiée : le texte reconnu, s'il existe
        let tx = meta.kind === 'pdf' ? await pdfText(meta.id, n) : '';
        if (tx.trim().length < 20 && meta.ocr) tx = (await ocrGet(meta.id))[n - 1] || tx;
        return { page: n, text: tx };
      }
      return { page: n, text: ((await get('blob', meta.id))?.pages || [])[n - 1] || '' };
    }
    if ((mm = path.match(/^\/api\/books\/([\w-]+)$/))) {
      const meta = await get('meta', mm[1]); if (!meta) throw new Error('Livre introuvable');
      if (m === 'PATCH') {
        Object.assign(meta, { title: String(body.title ?? meta.title).slice(0, 200), author: String(body.author ?? meta.author).slice(0, 120), color: String(body.color ?? meta.color) });
        if (body.fav !== undefined) meta.fav = !!body.fav;
        if (body.lib) meta.lib = String(body.lib);
        if (body.summary !== undefined) meta.summary = body.summary;
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

  async function pageCanvasAt(id, n, width) { if ((await get('meta', id))?.kind === 'images') return imageCanvas(id, n, width); const doc = await pdfDoc(id); return renderPage(doc, n, width); } // plus net pour le zoom
  async function pageCanvas(id, n) {
    if ((await get('meta', id))?.kind === 'images') return imageCanvas(id, n, Math.min(1800, Math.max(900, Math.round(innerWidth * (devicePixelRatio || 1)))));
    const doc = await pdfDoc(id);
    return renderPage(doc, n, Math.min(1800, Math.max(900, Math.round(innerWidth * (devicePixelRatio || 1)))));
  }

  // Demande au navigateur de garder les données (évite l'effacement automatique)
  try { navigator.storage?.persist?.(); } catch {}
  async function paragraphs(id, opts = {}) {
    if (opts.ocr) return (await ocrGet(id)).join('\n\n').split(/\n{2,}/).filter((x) => x.trim());
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
      if (m.srcs) for (const x of m.srcs) src.add(x); // pistes d'un livre audio
      let fname = m.fname, fsize = m.fsize;
      if (!fname && m.kind === 'pdf') { const rec = await get('blob', m.id); if (rec?.file) { fname = rec.file.name; fsize = rec.file.size; } }
      if (fname) { nameSize.add(fname + '|' + fsize); names.add(clean(fname)); }
      else names.add(clean(m.title)); // anciens livres Word/texte : on compare le titre au nom du fichier
    }
    try { for (const x of JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]')) src.add(x); } catch {}
    return { has: (f) => src.has(f.src) || nameSize.has(f.name + '|' + f.size) || names.has(clean(f.name)) };
  }
  // Fichier du livre (l'original si on l'a, sinon le texte) — pour l'ouvrir avec une autre application
  async function fileOf(id, { asText } = {}) {
    const meta = await get('meta', id); const rec = await get('blob', id); if (!meta || !rec) return null;
    const base = (meta.fname || meta.title).replace(/\.[^.]+$/, '');
    if (rec.files) return { files: rec.files, name: meta.title };
    if (rec.images && !rec.file) return { files: rec.images.map((b, i) => new File([b], `${String(i + 1).padStart(3, '0')}.${(b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: b.type })), name: meta.title };
    if (rec.file && !(asText && meta.kind !== 'pdf')) return { file: rec.file, name: meta.fname || rec.file.name || meta.title + '.' + (meta.kind === 'txt' ? 'txt' : meta.kind) };
    if (rec.pages) return { file: new Blob([rec.pages.join('\n\n').replace(/^# /gm, '')], { type: 'text/plain' }), name: base + '.txt', converted: meta.kind === 'docx' && !asText };
    return null;
  }
  // Tout le texte du livre (pour le résumé), avec un plafond
  async function fullText(id, onp, max = 1200000) {
    const meta = await get('meta', id); if (!meta) throw new Error('Livre introuvable');
    if (meta.kind !== 'pdf') { const t = ((await get('blob', id))?.pages || []).join('\n\n'); return { text: t.slice(0, max), truncated: t.length > max, pages: meta.pages }; }
    let out = ''; let n = 1;
    for (; n <= meta.pages && out.length < max; n++) { out += `\n\n[page ${n}]\n` + await pdfText(id, n); if (n % 5 === 0) onp?.(n, meta.pages); }
    return { text: out.slice(0, max), truncated: n <= meta.pages || out.length > max, pages: meta.pages };
  }
  // Position des mots d'une page PDF (coordonnées de 0 à 1), pour définir le mot touché
  async function pageItems(id, n) {
    const doc = await pdfDoc(id); const page = await doc.getPage(n);
    const vb = page.view, W = vb[2] - vb[0], H = vb[3] - vb[1];
    const tc = await page.getTextContent();
    return tc.items.filter((it) => it.str && it.str.trim()).map((it) => {
      const hgt = it.height || Math.abs(it.transform[3]) || 10;
      return { s: it.str, l: (it.transform[4] - vb[0]) / W, t: 1 - (it.transform[5] - vb[1] + hgt) / H, w: (it.width || hgt * it.str.length * 0.5) / W, h: (hgt * 1.25) / H };
    });
  }
  // ---------- Entretien : doublons, titres techniques, couvertures blanches ----------
  const normT = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  async function tidy() {
    const metas = await all('meta'); const live = metas.filter((m) => !m.trashed && !String(m.id).startsWith('ocr:'));
    const progs = new Map((await all('prog')).map((p) => [p.book, p]));
    let renamed = 0, merged = 0;
    for (const m of live) if (BAD_TITLE.test(String(m.title).trim()) && m.fname) { const t2 = m.fname.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(); if (t2 && !BAD_TITLE.test(t2)) { m.title = t2; await put('meta', m); renamed++; } }
    // doublons : même fichier (nom et taille), ou même titre, même format, même nombre de pages et taille presque égale
    const groups = new Map();
    for (const m of live) {
      const keys = [];
      if (m.fname && m.fsize) keys.push('f|' + (m.lib || 'main') + '|' + normT(m.fname) + '|' + m.fsize);
      const nt = normT(m.title); if (nt.length >= 6) keys.push('t|' + (m.lib || 'main') + '|' + nt + '|' + m.kind + '|' + m.pages);
      for (const k of keys) { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    }
    const done = new Set();
    for (const [k, list] of groups) {
      let g = list.filter((m) => !done.has(m.id)); if (g.length < 2) continue;
      if (k.startsWith('t|')) { const s0 = g[0].fsize || 0; g = g.filter((m) => !s0 || !m.fsize || Math.abs(m.fsize - s0) / Math.max(s0, m.fsize) < 0.05); if (g.length < 2) continue; }
      const score = (m) => { const p = progs.get(m.id); return (p?.last || 0) * 10 + (p?.opens || 0); };
      g.sort((a, b) => score(b) - score(a) || (a.created || 0) - (b.created || 0));
      const keep = g[0];
      for (const d of g.slice(1)) { // on garde le livre déjà lu ; ce que l'autre avait (favori, état, collections) le rejoint
        keep.fav = keep.fav || d.fav; if (!keep.state || d.state === 'lu') keep.state = d.state || keep.state;
        keep.cols = [...new Set([...(keep.cols || []), ...(d.cols || [])])]; if (!keep.summary && d.summary) keep.summary = d.summary;
        d.trashed = now(); d.dupOf = keep.id; await put('meta', d); done.add(d.id); merged++;
      }
      await put('meta', keep); // le livre gardé peut encore absorber d'autres copies (autre nom de fichier, même livre)
    }
    return { renamed, merged };
  }
  // Couvertures blanches déjà sur l'étagère : on les refait (une fois par livre)
  async function fixCovers(onEach) {
    let fixed = 0;
    for (const m of await all('meta')) {
      if (m.kind !== 'pdf' || m.trashed || m.coverChecked) continue;
      try {
        const rec = await get('blob', m.id);
        let blank = !rec?.cover;
        if (rec?.cover) { const bmp = await createImageBitmap(rec.cover); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); blank = isBlank(c); }
        if (blank) { const doc = await pdfDoc(m.id); const cover = await pdfCover(doc); rec.cover = cover; await put('blob', rec, m.id); coverUrls.delete(m.id); fixed++; onEach && onEach(); }
      } catch {}
      m.coverChecked = 1; await put('meta', m);
    }
    return fixed;
  }
  async function findDup(file, lib) {
    for (const m of await all('meta')) if (!m.trashed && (m.lib || 'main') === lib && m.fname && normT(m.fname) === normT(file.name) && m.fsize === file.size) return m;
    return null;
  }
  async function isScanned(id) { // peu ou pas de texte dans les premières pages : livre photographié
    const m = await get('meta', id); if (!m) return false; if (m.kind === 'images') return true; if (m.kind !== 'pdf') return false;
    const ns = [1, 2, 3, Math.ceil(m.pages / 2), m.pages].filter((x, i, a) => x >= 1 && x <= m.pages && a.indexOf(x) === i);
    let empty = 0; for (const n of ns) { try { if ((await pdfText(id, n)).replace(/\s/g, '').length < 40) empty++; } catch { empty++; } }
    return empty >= Math.ceil(ns.length * 0.6);
  }
  return { handle, upload, uploadAudio, uploadImages, isScanned, tidy, fixCovers, findDup, ocrGet, ocrSave, ocrForget, audioOf, pageCanvas, pageCanvasAt, paragraphs, known, fileOf, fullText, pageItems };
})();
