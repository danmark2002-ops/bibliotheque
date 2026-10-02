// Bibliothèque — serveur sans dépendance externe (Node 22+, poppler-utils)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 8080);
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC = path.join(__dirname, 'public');
const MAX_UPLOAD = 300 * 1024 * 1024;
const VISIT_GAP_MS = 30 * 60 * 1000;

fs.mkdirSync(path.join(DATA, 'books'), { recursive: true });

// ---------- Base de données ----------
const db = new DatabaseSync(path.join(DATA, 'biblio.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY, title TEXT, author TEXT, kind TEXT, pages INTEGER,
  status TEXT, color TEXT, created INTEGER, size INTEGER, position INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE, label TEXT, kind TEXT,
  active INTEGER DEFAULT 1, created INTEGER);
CREATE TABLE IF NOT EXISTS readers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, invite_id INTEGER, name TEXT, contact TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, role TEXT, reader_id INTEGER, created INTEGER, last INTEGER);
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reader_id INTEGER, start INTEGER, last INTEGER,
  ip TEXT, ua TEXT);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reader_id INTEGER, visit_id INTEGER, book_id TEXT,
  type TEXT, page INTEGER, ts INTEGER);
CREATE TABLE IF NOT EXISTS progress (
  reader_id INTEGER, book_id TEXT, page INTEGER, max_page INTEGER, opens INTEGER,
  first INTEGER, last INTEGER, PRIMARY KEY (reader_id, book_id));
CREATE INDEX IF NOT EXISTS ev_reader ON events(reader_id, ts);
CREATE INDEX IF NOT EXISTS vi_reader ON visits(reader_id, start);
`);
const q = (sql) => db.prepare(sql);
const getSetting = (k) => q('SELECT v FROM settings WHERE k=?').get(k)?.v;
const setSetting = (k, v) => q('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v);

// ---------- Utilitaires ----------
const now = () => Date.now();
const rid = (n = 16) => crypto.randomBytes(n).toString('base64url');
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPw(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
if (process.env.ADMIN_PASSWORD && !getSetting('owner_pw')) setSetting('owner_pw', hashPw(process.env.ADMIN_PASSWORD));
if (!getSetting('library_name')) setSetting('library_name', 'Ma Bibliothèque');

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024, ...opts },
    (err, stdout, stderr) => err ? rej(new Error(stderr?.toString() || err.message)) : res(stdout)));
}
function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(data);
}
const json = (res, body, code = 200) => send(res, code, body);
const fail = (res, code, msg) => send(res, code, { error: msg });
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('trop gros')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) { const b = await readBody(req); try { return JSON.parse(b.toString() || '{}'); } catch { return {}; } }
function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function clientIp(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || ''; }
function isHttps(req) { return req.headers['x-forwarded-proto'] === 'https'; }
function setSession(req, res, role, readerId) {
  const token = rid(32);
  q('INSERT INTO sessions(token,role,reader_id,created,last) VALUES(?,?,?,?,?)').run(token, role, readerId ?? null, now(), now());
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isHttps(req) ? '; Secure' : ''}`);
  return token;
}
function getSession(req) {
  const t = cookies(req).sid || req.headers['x-session'];
  if (!t) return null;
  const s = q('SELECT * FROM sessions WHERE token=?').get(t);
  if (!s) return null;
  if (s.role === 'reader') {
    const r = q('SELECT r.*, i.active FROM readers r LEFT JOIN invites i ON i.id=r.invite_id WHERE r.id=?').get(s.reader_id);
    if (!r || !r.active) return null;
    s.reader = r;
  }
  return s;
}
// Visites : nouvelle visite si inactif depuis plus de 30 min
function touchVisit(req, s) {
  if (s.role !== 'reader') return null;
  const v = q('SELECT * FROM visits WHERE reader_id=? ORDER BY last DESC LIMIT 1').get(s.reader_id);
  const t = now();
  if (v && t - v.last < VISIT_GAP_MS) { q('UPDATE visits SET last=? WHERE id=?').run(t, v.id); return v.id; }
  const r = q('INSERT INTO visits(reader_id,start,last,ip,ua) VALUES(?,?,?,?,?)').run(s.reader_id, t, t, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 300));
  return Number(r.lastInsertRowid);
}
// Limiteur simple : pages par minute
const rate = new Map();
function limited(key, max) {
  const t = now(), w = rate.get(key) || [];
  const recent = w.filter((x) => t - x < 60000); recent.push(t); rate.set(key, recent);
  return recent.length > max;
}
const loginFails = new Map();

// ---------- Livres ----------
const bookDir = (id) => path.join(DATA, 'books', id);
const PALETTE = ['#7a2e2e', '#1f4e5f', '#3b5d3a', '#5b3a6b', '#8a5a1c', '#2c3e66', '#6b2d4f', '#355c55', '#7d4b2a', '#3d3d5c'];

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
  return pages.length ? pages : [''];
}
function decodeText(buf) {
  let t = buf.toString('utf8');
  if ((t.match(/�/g) || []).length > 3) t = buf.toString('latin1');
  return t.replace(/^﻿/, '');
}
async function processBook(id, kind) {
  const dir = bookDir(id);
  try {
    if (kind === 'pdf') {
      const src = path.join(dir, 'original.pdf');
      const info = (await run('pdfinfo', [src])).toString();
      const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 0);
      if (!pages) throw new Error('PDF illisible');
      const title = (info.match(/Title:\s+(.+)/) || [])[1]?.trim();
      const author = (info.match(/Author:\s+(.+)/) || [])[1]?.trim();
      const txt = (await run('pdftotext', ['-enc', 'UTF-8', src, '-'])).toString();
      const texts = txt.split('\f').slice(0, pages);
      while (texts.length < pages) texts.push('');
      await fsp.writeFile(path.join(dir, 'text.json'), JSON.stringify(texts.map((t) => t.replace(/-\n(\w)/g, '$1').replace(/[ \t]+\n/g, '\n').trim())));
      await run('pdftoppm', ['-f', '1', '-l', '1', '-jpeg', '-jpegopt', 'quality=85', '-scale-to', '700', '-singlefile', src, path.join(dir, 'cover')]);
      const useTitle = title && title.length > 2 && title.length < 150 && !/untitled|sans titre|microsoft word|\.(docx?|pdf|indd)$|^document\d*$/i.test(title);
      q('UPDATE books SET pages=?, status=?, author=COALESCE(NULLIF(author,\'\'), ?) WHERE id=?').run(pages, 'ready', author || '', id);
      if (useTitle) q('UPDATE books SET title=? WHERE id=?').run(title, id);
    } else {
      const text = decodeText(await fsp.readFile(path.join(dir, 'original.txt')));
      const pages = splitText(text);
      await fsp.writeFile(path.join(dir, 'text.json'), JSON.stringify(pages));
      q('UPDATE books SET pages=?, status=? WHERE id=?').run(pages.length, 'ready', id);
    }
  } catch (e) {
    console.error('Traitement échoué', id, e.message);
    q('UPDATE books SET status=? WHERE id=?').run('error', id);
  }
}
const textCache = new Map();
async function bookTexts(id) {
  if (textCache.has(id)) return textCache.get(id);
  const t = JSON.parse(await fsp.readFile(path.join(bookDir(id), 'text.json'), 'utf8'));
  textCache.set(id, t); if (textCache.size > 20) textCache.delete(textCache.keys().next().value);
  return t;
}
const rendering = new Map();
async function pageImage(id, n) {
  const dir = path.join(bookDir(id), 'pages'); const file = path.join(dir, `${n}.jpg`);
  try { return await fsp.readFile(file); } catch {}
  const key = id + ':' + n;
  if (!rendering.has(key)) {
    rendering.set(key, (async () => {
      await fsp.mkdir(dir, { recursive: true });
      await run('pdftoppm', ['-f', String(n), '-l', String(n), '-jpeg', '-jpegopt', 'quality=82', '-scale-to', '1600', '-singlefile',
        path.join(bookDir(id), 'original.pdf'), path.join(dir, String(n))]);
    })().finally(() => rendering.delete(key)));
  }
  await rendering.get(key);
  return fsp.readFile(file);
}
function bookOut(b, readerId) {
  const p = q('SELECT page, opens, last FROM progress WHERE reader_id=? AND book_id=?').get(readerId ?? 0, b.id);
  return { id: b.id, title: b.title, author: b.author, kind: b.kind, pages: b.pages, status: b.status, color: b.color,
    created: b.created, progress: p ? { page: p.page, opens: p.opens, last: p.last } : null };
}

// ---------- Statistiques (propriétaire) ----------
function stats() {
  const books = Object.fromEntries(q('SELECT id, title, pages FROM books').all().map((b) => [b.id, b]));
  const readers = q(`SELECT r.*, i.label AS invite_label, i.kind AS invite_kind, i.active FROM readers r
    LEFT JOIN invites i ON i.id=r.invite_id ORDER BY r.created DESC`).all().map((r) => {
    const visits = q('SELECT * FROM visits WHERE reader_id=? ORDER BY start DESC').all(r.id);
    const prog = q('SELECT * FROM progress WHERE reader_id=? ORDER BY last DESC').all(r.id).map((p) => ({
      book_id: p.book_id, title: books[p.book_id]?.title || '(livre supprimé)', pages: books[p.book_id]?.pages || 0,
      page: p.page, max_page: p.max_page, opens: p.opens, first: p.first, last: p.last }));
    const pagesViewed = q("SELECT COUNT(*) c FROM events WHERE reader_id=? AND type='page'").get(r.id).c;
    return { id: r.id, name: r.name, contact: r.contact, created: r.created, invite: r.invite_label, inviteKind: r.invite_kind,
      active: !!r.active, visitCount: visits.length, lastSeen: visits[0]?.last || null, pagesViewed,
      visits: visits.slice(0, 200).map((v) => ({ ...v, events: q(`SELECT book_id, type, page, ts FROM events WHERE visit_id=? AND type IN ('open','audio') ORDER BY ts`).all(v.id)
        .map((e) => ({ ...e, title: books[e.book_id]?.title || '(supprimé)' })) })),
      books: prog };
  });
  const recent = q(`SELECT e.*, r.name FROM events e JOIN readers r ON r.id=e.reader_id WHERE e.type IN ('open','audio') ORDER BY ts DESC LIMIT 60`).all()
    .map((e) => ({ ...e, title: books[e.book_id]?.title || '(supprimé)' }));
  return { readers, recent, totals: {
    readers: readers.length, visits: readers.reduce((a, r) => a + r.visitCount, 0),
    pages: readers.reduce((a, r) => a + r.pagesViewed, 0), books: Object.keys(books).length } };
}

// ---------- Fichiers statiques ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
async function serveStatic(res, rel) {
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) return fail(res, 404, 'introuvable');
  try {
    const data = await fsp.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { fail(res, 404, 'introuvable'); }
}
function joinPage(token, label) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invitation</title><link rel="stylesheet" href="/app.css"></head><body class="join-body">
<form class="join-card" id="f"><div class="join-mark">❦</div><h1>Vous êtes invité</h1>
<p>à consulter <em>${escapeHtml(getSetting('library_name'))}</em>${label ? ' — ' + escapeHtml(label) : ''}.</p>
<label>Votre nom<input name="name" required maxlength="80" autocomplete="name"></label>
<label>Courriel <span>(facultatif)</span><input name="contact" type="email" maxlength="120" autocomplete="email"></label>
<button>Entrer dans la bibliothèque</button><p class="join-err" id="e"></p></form>
<script>f.onsubmit=async(ev)=>{ev.preventDefault();const d=Object.fromEntries(new FormData(f));
const r=await fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,token:${JSON.stringify(token)}})});
if(r.ok)location.href='/';else e.textContent=(await r.json()).error||'Erreur';}</script></body></html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Routeur ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname; const m = req.method;

    // Lien d'invitation
    let mm;
    if ((mm = p.match(/^\/l\/([\w-]+)$/))) {
      const inv = q('SELECT * FROM invites WHERE token=? AND active=1').get(mm[1]);
      if (!inv) return send(res, 410, 'Ce lien n\'est plus valide.');
      if (inv.kind === 'personal') {
        let r = q('SELECT * FROM readers WHERE invite_id=?').get(inv.id);
        if (!r) { q('INSERT INTO readers(invite_id,name,created) VALUES(?,?,?)').run(inv.id, inv.label, now()); r = q('SELECT * FROM readers WHERE invite_id=?').get(inv.id); }
        setSession(req, res, 'reader', r.id);
        res.writeHead(302, { Location: '/' }); return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(joinPage(inv.token, ''));
    }
    if (p === '/api/join' && m === 'POST') {
      const b = await readJson(req);
      const inv = q("SELECT * FROM invites WHERE token=? AND active=1 AND kind='open'").get(String(b.token || ''));
      const name = String(b.name || '').trim().slice(0, 80);
      if (!inv) return fail(res, 410, 'Lien invalide');
      if (!name) return fail(res, 400, 'Nom requis');
      const r = q('INSERT INTO readers(invite_id,name,contact,created) VALUES(?,?,?,?)').run(inv.id, name, String(b.contact || '').slice(0, 120), now());
      setSession(req, res, 'reader', Number(r.lastInsertRowid));
      return json(res, { ok: true });
    }

    if (!p.startsWith('/api/')) {
      if (p === '/' || p === '/index.html') return serveStatic(res, 'index.html');
      return serveStatic(res, p.slice(1));
    }

    // Authentification
    if (p === '/api/me') {
      const s = getSession(req);
      const base = { library: getSetting('library_name'), setupNeeded: !getSetting('owner_pw') };
      if (!s) return json(res, { ...base, role: null });
      touchVisit(req, s);
      return json(res, { ...base, role: s.role, name: s.role === 'owner' ? 'Propriétaire' : s.reader.name });
    }
    if (p === '/api/setup' && m === 'POST') {
      if (getSetting('owner_pw')) return fail(res, 403, 'Déjà configuré');
      const b = await readJson(req);
      if (String(b.password || '').length < 6) return fail(res, 400, 'Mot de passe : 6 caractères minimum');
      setSetting('owner_pw', hashPw(String(b.password)));
      if (b.library) setSetting('library_name', String(b.library).slice(0, 80));
      setSession(req, res, 'owner');
      return json(res, { ok: true });
    }
    if (p === '/api/login' && m === 'POST') {
      const ip = clientIp(req); const f = loginFails.get(ip) || { n: 0, t: 0 };
      if (f.n >= 5 && now() - f.t < 10 * 60000) return fail(res, 429, 'Trop d\'essais, réessaie dans 10 minutes');
      const b = await readJson(req);
      if (!checkPw(String(b.password || ''), getSetting('owner_pw'))) { loginFails.set(ip, { n: f.n + 1, t: now() }); return fail(res, 401, 'Mot de passe incorrect'); }
      loginFails.delete(ip); setSession(req, res, 'owner');
      return json(res, { ok: true });
    }
    if (p === '/api/logout' && m === 'POST') {
      const t = cookies(req).sid; if (t) q('DELETE FROM sessions WHERE token=?').run(t);
      res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0'); return json(res, { ok: true });
    }

    const s = getSession(req);
    if (!s) return fail(res, 401, 'Connexion requise');
    const owner = s.role === 'owner';
    const readerId = owner ? 0 : s.reader_id;
    const visitId = touchVisit(req, s);

    // Livres
    if (p === '/api/books' && m === 'GET') {
      return json(res, q('SELECT * FROM books ORDER BY position, created DESC').all().filter((b) => owner || b.status === 'ready').map((b) => bookOut(b, readerId)));
    }
    if (p === '/api/books' && m === 'POST') {
      if (!owner) return fail(res, 403, 'Réservé au propriétaire');
      const name = decodeURIComponent(String(req.headers['x-filename'] || 'livre'));
      const ext = path.extname(name).toLowerCase();
      const kind = ext === '.pdf' ? 'pdf' : ['.txt', '.md', '.text'].includes(ext) ? 'txt' : null;
      if (!kind) return fail(res, 400, 'Format accepté : PDF ou texte (.txt)');
      const buf = await readBody(req, MAX_UPLOAD);
      if (kind === 'pdf' && buf.subarray(0, 5).toString() !== '%PDF-') return fail(res, 400, 'Ce fichier n\'est pas un PDF valide');
      const id = rid(9); await fsp.mkdir(bookDir(id), { recursive: true });
      await fsp.writeFile(path.join(bookDir(id), 'original.' + kind), buf);
      const title = path.basename(name, ext).replace(/[_]+/g, ' ').trim() || 'Sans titre';
      const count = q('SELECT COUNT(*) c FROM books').get().c;
      q('INSERT INTO books(id,title,author,kind,pages,status,color,created,size,position) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(id, title, '', kind, 0, 'processing', PALETTE[count % PALETTE.length], now(), buf.length, -count);
      await processBook(id, kind);
      return json(res, bookOut(q('SELECT * FROM books WHERE id=?').get(id), 0));
    }
    if ((mm = p.match(/^\/api\/books\/([\w-]+)$/))) {
      const b = q('SELECT * FROM books WHERE id=?').get(mm[1]);
      if (!b) return fail(res, 404, 'Livre introuvable');
      if (m === 'GET') return json(res, bookOut(b, readerId));
      if (!owner) return fail(res, 403, 'Réservé au propriétaire');
      if (m === 'PATCH') {
        const d = await readJson(req);
        q('UPDATE books SET title=?, author=?, color=? WHERE id=?').run(String(d.title ?? b.title).slice(0, 200), String(d.author ?? b.author).slice(0, 120), String(d.color ?? b.color).slice(0, 9), b.id);
        return json(res, bookOut(q('SELECT * FROM books WHERE id=?').get(b.id), 0));
      }
      if (m === 'DELETE') {
        q('DELETE FROM books WHERE id=?').run(b.id); textCache.delete(b.id);
        await fsp.rm(bookDir(b.id), { recursive: true, force: true });
        return json(res, { ok: true });
      }
    }
    if ((mm = p.match(/^\/api\/books\/([\w-]+)\/cover\.jpg$/))) {
      try { const img = await fsp.readFile(path.join(bookDir(mm[1]), 'cover.jpg')); return send(res, 200, img, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }); }
      catch { return fail(res, 404, 'pas de couverture'); }
    }
    if ((mm = p.match(/^\/api\/books\/([\w-]+)\/page\/(\d+)$/))) {
      const b = q("SELECT * FROM books WHERE id=? AND status='ready'").get(mm[1]); const n = Number(mm[2]);
      if (!b || b.kind !== 'pdf' || n < 1 || n > b.pages) return fail(res, 404, 'Page introuvable');
      if (!owner && limited('img' + readerId, 90)) return fail(res, 429, 'Trop de pages demandées, patiente un instant');
      const img = await pageImage(b.id, n);
      return send(res, 200, img, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline; filename="page"' });
    }
    if ((mm = p.match(/^\/api\/books\/([\w-]+)\/text\/(\d+)$/))) {
      const b = q("SELECT * FROM books WHERE id=? AND status='ready'").get(mm[1]); const n = Number(mm[2]);
      if (!b || n < 1 || n > b.pages) return fail(res, 404, 'Page introuvable');
      if (!owner && limited('txt' + readerId, 120)) return fail(res, 429, 'Trop de pages demandées');
      return json(res, { page: n, text: (await bookTexts(b.id))[n - 1] || '' });
    }
    if (p === '/api/track' && m === 'POST') {
      const d = await readJson(req);
      const b = q('SELECT id, pages FROM books WHERE id=?').get(String(d.book || ''));
      if (!b) return fail(res, 404, 'Livre introuvable');
      const type = ['open', 'page', 'audio'].includes(d.type) ? d.type : 'page';
      const page = Math.max(1, Math.min(b.pages || 1, Number(d.page) || 1)); const t = now();
      if (!owner) q('INSERT INTO events(reader_id,visit_id,book_id,type,page,ts) VALUES(?,?,?,?,?,?)').run(readerId, visitId, b.id, type, page, t);
      const ex = q('SELECT * FROM progress WHERE reader_id=? AND book_id=?').get(readerId, b.id);
      if (!ex) q('INSERT INTO progress(reader_id,book_id,page,max_page,opens,first,last) VALUES(?,?,?,?,?,?,?)').run(readerId, b.id, page, page, type === 'open' ? 1 : 0, t, t);
      else q('UPDATE progress SET page=?, max_page=MAX(max_page,?), opens=opens+?, last=? WHERE reader_id=? AND book_id=?')
        .run(type === 'open' && d.page == null ? ex.page : page, page, type === 'open' ? 1 : 0, t, readerId, b.id);
      return json(res, { ok: true });
    }

    // Propriétaire seulement
    if (!owner) return fail(res, 403, 'Réservé au propriétaire');
    if (p === '/api/stats') return json(res, stats());
    if (p === '/api/invites' && m === 'GET') {
      return json(res, q('SELECT i.*, (SELECT COUNT(*) FROM readers r WHERE r.invite_id=i.id) readers FROM invites i ORDER BY created DESC').all());
    }
    if (p === '/api/invites' && m === 'POST') {
      const d = await readJson(req);
      const kind = d.kind === 'open' ? 'open' : 'personal';
      const label = String(d.label || '').trim().slice(0, 80);
      if (kind === 'personal' && !label) return fail(res, 400, 'Indique le nom de la personne');
      const token = rid(12);
      q('INSERT INTO invites(token,label,kind,active,created) VALUES(?,?,?,1,?)').run(token, label || 'Lien ouvert', kind, now());
      return json(res, q('SELECT * FROM invites WHERE token=?').get(token));
    }
    if ((mm = p.match(/^\/api\/invites\/(\d+)$/)) && m === 'PATCH') {
      const d = await readJson(req);
      q('UPDATE invites SET active=? WHERE id=?').run(d.active ? 1 : 0, Number(mm[1]));
      return json(res, { ok: true });
    }
    if (p === '/api/settings' && m === 'PATCH') {
      const d = await readJson(req);
      if (d.library) setSetting('library_name', String(d.library).slice(0, 80));
      if (d.password) { if (String(d.password).length < 6) return fail(res, 400, '6 caractères minimum'); setSetting('owner_pw', hashPw(String(d.password))); }
      return json(res, { ok: true });
    }
    if (p === '/api/order' && m === 'POST') {
      const d = await readJson(req);
      (d.ids || []).forEach((id, i) => q('UPDATE books SET position=? WHERE id=?').run(i, String(id)));
      return json(res, { ok: true });
    }
    return fail(res, 404, 'Route inconnue');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, e.message.includes('trop gros') ? 'Fichier trop volumineux (300 Mo max)' : 'Erreur serveur');
  }
});
server.requestTimeout = 15 * 60 * 1000;
server.listen(PORT, () => console.log(`Bibliothèque prête sur http://localhost:${PORT}  (données : ${DATA})`));
