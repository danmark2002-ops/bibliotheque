/* ============ Bibliothèque — application ============ */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('bib.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bib.' + k, JSON.stringify(v)); } catch {} },
};
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  dict: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 8h6M9 12h4"/>',
  move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 13h6M13.5 10.5 16 13l-2.5 2.5"/>',
  voice: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 6l-8 6 8 6V6z" fill="currentColor" stroke="none"/><path d="M7 6v12"/>',
  next: '<path d="M6 6l8 6-8 6V6z" fill="currentColor" stroke="none"/><path d="M17 6v12"/>',
  type: '<path d="M4 18L9 6l5 12M5.8 14h6.4"/><path d="M15 18l3-7 3 7M15.8 16h4.4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  prof: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
  cast: '<path d="M2 16.1A5 5 0 0 1 5.9 20"/><path d="M2 12.05A9 9 0 0 1 9.95 20"/><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 20h.01"/>',
  tvplay: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M10 8.2v5.6l4.6-2.8z" fill="currentColor"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 19h14"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/>',
  shelf: '<rect x="4" y="4" width="4" height="11" rx=".8"/><rect x="10" y="6" width="4" height="9" rx=".8"/><rect x="16" y="3" width="4" height="12" rx=".8"/><path d="M2 19h20"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  chev: '<path d="M7 10l5 5 5-5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.6 2.6 4.8-5.3"/>',
  merge: '<path d="M6 4v5a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V4"/><path d="M12 15v5"/><circle cx="6" cy="4" r="1.6" fill="currentColor"/><circle cx="18" cy="4" r="1.6" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  starFill: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  checks: '<path d="M2.5 12.5l4 4 8-9"/><path d="M11 15.5l1 1 9-10"/>',
  collection: '<path d="M5 4v16M9 4v16"/><path d="M13.5 5.2l4.6 14.6"/><path d="M3 20h18"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  reading: '<path d="M2.5 6c3-1.5 6.5-1.5 9.5.5 3-2 6.5-2 9.5-.5v13c-3-1.5-6.5-1.5-9.5.5-3-2-6.5-2-9.5-.5z"/><path d="M12 6.5v13"/>',
  dots: '<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const chevR = () => { const s = icon('chev'); s.classList.add('rot-r'); return s; };
const icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = ICONS[n]; return s; };
const PAGED = (k) => k === 'pdf' || k === 'images'; // livres faits de pages-images (PDF, BD, photos)
const KIND = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT', epub: 'EPUB', mobi: 'Kindle', doc: 'DOC', odt: 'ODT', rtf: 'RTF', fb2: 'FB2', html: 'Page web', audio: 'Livre audio', images: 'Images' };
const PALETTE = ['#7a2e2e', '#1f4e5f', '#3b5d3a', '#5b3a6b', '#8a5a1c', '#2c3e66', '#6b2d4f', '#355c55', '#7d4b2a', '#3d3d5c', '#24343f', '#8c3b2a'];
const fmtDate = (t) => t ? new Date(t).toLocaleString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
function ago(t) {
  if (!t) return 'jamais'; const s = (Date.now() - t) / 1000;
  if (s < 60) return 'à l\'instant'; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`; if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}
function lastRead(t) {
  if (!t) return 'pas encore ouvert';
  const d = new Date(t), n = new Date();
  const hm = d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 864e5);
  if (diff <= 0) return `aujourd’hui à ${hm}`;
  if (diff === 1) return `hier à ${hm}`;
  if (diff < 7) return `${d.toLocaleDateString('fr-CA', { weekday: 'long' })} à ${hm}`;
  return `${d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })} à ${hm}`;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
async function api(path, opts = {}) {
  if (window.LocalAPI) return LocalAPI.handle(path, opts);
  const r = await fetch(path, { credentials: 'same-origin', ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) { const e = new Error(data?.error || 'Erreur'); e.status = r.status; throw e; }
  return data;
}
const post = (p, body, method = 'POST') => api(p, { method, body: JSON.stringify(body) });
const isNative = () => !!window.AndroidApp;

if (!store.get('etagere15', false)) { store.set('view', 'shelf'); store.set('etagere15', true); } // retour à l'étagère après la mise à jour
const S = { me: null, books: [], organize: false, filter: '', view: store.get('view', 'shelf') };
document.documentElement.dataset.decor = store.get('decor', 'noyer');

// ================= Démarrage =================
async function boot() {
  Premium.init();
  try { S.me = await api('/api/me'); } catch { S.me = { role: null }; }
  document.title = S.me.library || 'Bibliothèque';
  if (!S.me.role) return renderAuth();
  await loadBooks();
  renderLibrary();
  checkReceived(); // une bibliothèque partagée a peut-être ouvert l'application
  maintenance();
  setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => AutoScan.run(true), { timeout: 4000 }), 2500); // nouveaux livres dans les dossiers, une fois l'application au repos
}
// Faux livre : le fichier n'est qu'une page de publicité d'un site de téléchargement
function baitSheet(b, fromEl, opts) {
  const close = sheet('Ce fichier n\'est pas le livre', h('div', {},
    h('p', {}, `« ${b.title} » ne contient que ${b.pages} page${b.pages > 1 ? 's' : ''} : c'est une page de publicité d'un site de « téléchargement gratuit », avec un faux bouton « Download ». Le vrai livre n'a jamais été dans ce fichier.`),
    h('p', { class: 'muted' }, 'Ces sites diffusent souvent des fichiers trompeurs. Pour un livre récent, passe par une librairie ou le prêt numérique de ta bibliothèque.'),
    h('div', { class: 'actions', style: { justifyContent: 'space-between', marginTop: '16px' } },
      h('button', { class: 'btn', onclick: () => { close(); openBook(b, fromEl, { ...opts, anyway: true }); } }, 'L\'ouvrir quand même'),
      h('button', { class: 'btn danger', onclick: async () => { close(); await trashBook(b); } }, icon('trash'), 'Mettre à la poubelle'))));
}
// Entretien discret au démarrage : doublons regroupés, titres techniques corrigés, couvertures blanches refaites
async function maintenance() {
  if (!window.LocalAPI?.tidy || S.me?.role !== 'owner') return;
  try {
    const r = await LocalAPI.tidy();
    if (r.merged || r.renamed || r.baits) { await loadBooks(); renderLibrary(); }
    if (r.baits) toast(`${r.baits} fichier${r.baits > 1 ? 's' : ''} trompeur${r.baits > 1 ? 's' : ''} repéré${r.baits > 1 ? 's' : ''} (publicités de sites de téléchargement) : marqué${r.baits > 1 ? 's' : ''} « Faux livre »`);
    if (r.merged) toast(`${r.merged} livre${r.merged > 1 ? 's' : ''} en double regroupé${r.merged > 1 ? 's' : ''} : on garde celui que tu lisais (les copies sont dans la poubelle)`);
    let n = 0;
    const fixed = await LocalAPI.fixCovers(() => { if (++n % 5 === 0) loadBooks().then(() => { if (!$('.reader')) renderLibrary(); }); });
    if (fixed) { await loadBooks(); if (!$('.reader')) renderLibrary(); }
  } catch {}
  thumbsSoon();
}
async function loadBooks() { S.books = await api('/api/books'); await loadCols(); }

// ================= Connexion =================
function renderAuth() {
  const setup = S.me.setupNeeded;
  const err = h('div', { class: 'err' });
  const lib = h('input', { name: 'library', value: 'Ma Bibliothèque', maxlength: 80 });
  const pw = h('input', { type: 'password', name: 'password', required: true, minlength: 6, autocomplete: setup ? 'new-password' : 'current-password' });
  const form = h('form', { class: 'auth-card', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await post(setup ? '/api/setup' : '/api/login', { password: pw.value, library: lib.value }); boot(); }
    catch (x) { err.textContent = x.message; }
  } },
    h('div', { class: 'mini-shelf' }, ...['#7a2e2e:70', '#1f4e5f:58', '#d4ab6a:82', '#3b5d3a:64', '#5b3a6b:74'].map((s) => { const [c, hgt] = s.split(':'); return h('i', { style: { background: c, height: hgt + 'px' } }); })),
    h('div', { class: 'plank' }),
    h('h1', {}, setup ? 'Bienvenue' : (S.me.library || 'Bibliothèque')),
    h('p', {}, setup ? 'Crée ta bibliothèque. Ce mot de passe te réserve l\'ajout de livres et le suivi des lecteurs.' : 'Accès propriétaire. Tes invités entrent avec le lien que tu leur as envoyé.'),
    setup ? h('label', { class: 'field' }, 'Nom de la bibliothèque', lib) : null,
    h('label', { class: 'field' }, setup ? 'Choisis un mot de passe (6 caractères min.)' : 'Mot de passe', pw),
    h('button', { class: 'btn primary' }, setup ? 'Créer ma bibliothèque' : 'Entrer'),
    err,
    isNative() ? h('p', { class: 'muted', style: { marginTop: '18px' } }, h('a', { href: '#', style: { color: 'inherit' }, onclick: (e) => { e.preventDefault(); AndroidApp.changeServer(); } }, 'Changer l\'adresse du serveur')) : null,
  );
  $('#app').replaceChildren(h('div', { class: 'auth' }, form));
  pw.focus();
}

// ================= Bibliothèque =================
function perRow() { const w = Math.min(window.innerWidth, 1180); return w < 400 ? 3 : w < 640 ? 4 : w < 900 ? 5 : w < 1100 ? 6 : 7; }
function coverEl(b) {
  const c = h('div', { class: 'cover', style: { '--c': b.color || '#555' } });
  if (((b.kind === 'pdf' && !window.LocalAPI) || b.coverUrl) && b.status === 'ready') { // vraie couverture (PDF, EPUB…) ; sinon on en dessine une
    const img = h('img', { src: b.coverUrl || `/api/books/${b.id}/cover.jpg`, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    img.onerror = () => img.replaceWith(genCover(b));
    c.append(img);
  } else c.append(genCover(b));
  return c;
}
const hashStr = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const svgWrap = (inner) => `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
const DECO = [
  // 0 · anneaux (signal, ondes concentriques)
  svgWrap(`<g fill="none" stroke="currentColor" stroke-width=".8" opacity=".38">${[16, 32, 48, 64, 80, 96, 112].map((r) => `<circle cx="150" cy="258" r="${r}"/>`).join('')}</g><circle cx="150" cy="258" r="5" fill="currentColor" opacity=".7"/>`),
  // 1 · cadre classique à double filet
  svgWrap(`<g fill="none" stroke="currentColor"><rect x="12" y="12" width="176" height="276" stroke-width="1" opacity=".55"/><rect x="18" y="18" width="164" height="264" stroke-width=".5" opacity=".35"/></g><g fill="currentColor" opacity=".6">${[[18, 18], [182, 18], [18, 282], [182, 282]].map(([x, y]) => `<path d="M${x} ${y - 5} l5 5 l-5 5 l-5 -5z"/>`).join('')}</g>`),
  // 2 · horizon (soleil et lignes)
  svgWrap(`<circle cx="100" cy="214" r="50" fill="currentColor" opacity=".16"/><g stroke="currentColor" stroke-width=".8" opacity=".42">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M0 ${222 + i * 9}H200"/>`).join('')}</g>`),
  // 3 · treillis de losanges
  svgWrap(`<g fill="none" stroke="currentColor" stroke-width=".6" opacity=".3">${Array.from({ length: 9 }, (_, i) => `<path d="M${-60 + i * 30} 0L${40 + i * 30} 300M${260 - i * 30} 0L${160 - i * 30} 300"/>`).join('')}</g>`),
  // 4 · ondes
  svgWrap(`<g fill="none" stroke="currentColor" stroke-width=".9" opacity=".42">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M-10 ${196 + i * 13}C30 ${172 + i * 13} 70 ${222 + i * 13} 110 ${196 + i * 13}S190 ${172 + i * 13} 220 ${196 + i * 13}"/>`).join('')}</g>`),
  // 5 · constellation
  svgWrap(`<g stroke="currentColor" stroke-width=".6" opacity=".4" fill="none"><path d="M30 250L70 222L112 240L150 205L176 232"/><path d="M70 222L88 188L120 176L150 205"/></g><g fill="currentColor" opacity=".8">${[[30, 250, 2.2], [70, 222, 3], [112, 240, 2], [150, 205, 3.4], [176, 232, 2], [88, 188, 2.2], [120, 176, 2.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`),
];
function genCover(b) {
  const v = hashStr(b.title + (b.author || '')) % DECO.length;
  return h('div', { class: 'gen v' + v },
    h('div', { class: 'deco', html: DECO[v] }),
    h('div', { class: 'orn' }, '❦'),
    h('div', { class: 'mid' }, h('div', { class: 't' }, b.title), h('div', { class: 'rule' }), h('div', { class: 'a' }, b.author || '')));
}
function bookEl(b) {
  const pct = b.progress && b.pages ? Math.round((b.progress.page / b.pages) * 100) : 0;
  const el = h('button', { class: 'book', title: b.title, 'aria-label': `${b.title}${b.author ? ', ' + b.author : ''}` }, coverEl(b));
  const cv = $('.cover', el);
  if (!b.progress && b.status === 'ready' && !b.state) cv.append(h('span', { class: 'ribbon', title: 'Nouveau' }));
  if (b.fav) cv.append(h('span', { class: 'fav-badge', title: 'Favori' }, icon('starFill')));
  if (b.bait) cv.append(h('span', { class: 'status-pill bait' }, 'Faux livre'));
  if (b.status === 'processing') cv.append(h('span', { class: 'status-pill' }, 'Préparation…'));
  if (b.status === 'error') cv.append(h('span', { class: 'status-pill' }, 'Fichier illisible'));
  el.append(h('span', { class: 'under' }, h('span', { class: 'tag k-' + b.kind }, KIND[b.kind] || b.kind.toUpperCase()),
    b.state === 'lu' ? h('span', { class: 'tag st' }, 'Lu') : b.state === 'alire' ? h('span', { class: 'tag st' }, 'À lire') : pct ? h('span', { class: 'tag pct' }, pct >= 99 ? 'Terminé' : pct + ' %') : null));
  if (S.me.role === 'owner' && window.LocalAPI && !b.trashed) $('.under', el).after(tinyIcons(b));
  if (Sel.on) { el.classList.add('selecting'); if (Sel.ids.has(b.id)) el.classList.add('picked'); $('.cover', el).append(h('span', { class: 'selbox', 'aria-hidden': 'true' }, icon('check'))); }
  el.addEventListener('click', (e) => { if (el._lp && Date.now() - el._lp < 800) { e.preventDefault(); return; } if (Sel.on) { e.preventDefault(); return selToggle(b, el); } if (e.target.closest('.tiny')) return; if (S.organize || b.trashed) return editBook(b); if (b.status === 'ready') openBook(b, el); });
  ownerGestures(el, b);
  return el;
}
// Le « clic » qui suit le relâchement d'un appui long ne doit rien toucher (sinon il fermerait le menu qui vient de s'ouvrir)
addEventListener('click', (e) => { if (window.__lpAt && Date.now() - window.__lpAt < 900) { window.__lpAt = 0; e.preventDefault(); e.stopPropagation(); } }, { capture: true });
function ownerGestures(el, b) {
  if (S.me.role !== 'owner') return;
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); editBook(b); });
  // Tous les écouteurs tactiles sont « passifs » : le téléphone fait défiler l'étagère sans attendre le JavaScript.
  // (Un seul écouteur non passif suffisait pour que chaque glissement attende l'application : départ en retard,
  // à-coups pendant le glissement, saut au moment de lâcher.) Le clic qui suit un appui long est ignoré dans « click ».
  let t; el.addEventListener('touchstart', (e) => { if (e.target.closest('.tiny')) return; t = setTimeout(() => { el._lp = window.__lpAt = Date.now(); editBook(b); }, 600); }, { passive: true });
  el.addEventListener('touchend', () => clearTimeout(t), { passive: true });
  el.addEventListener('touchmove', () => clearTimeout(t), { passive: true });
  el.addEventListener('touchcancel', () => clearTimeout(t), { passive: true });
}
// Vue « liste » : couverture, avancement et date de dernière lecture
function listEl(books) {
  const list = h('div', { class: 'blist' + (S.organize ? ' organize' : '') });
  if (!books.length) return list;
  for (const b of books) {
    const pr = b.progress; const pct = pr && b.pages ? Math.min(100, Math.round((pr.page / b.pages) * 100)) : 0;
    const thumb = h('div', { class: 'thumb' }, coverEl(b));
    const row = h('div', { class: 'brow', role: 'button', tabindex: '0', title: b.title },
      thumb,
      h('div', { class: 'binfo' },
        h('div', { class: 'btitle' }, b.fav ? h('span', { class: 'tstar' }, icon('starFill')) : null, b.title),
        h('div', { class: 'bsub' }, b.author || '\u00a0'),
        h('div', { class: 'bbar' }, h('i', { style: { width: pct + '%' } })),
        h('div', { class: 'bmeta' },
          h('span', { class: 'tag k-' + b.kind }, KIND[b.kind] || b.kind.toUpperCase()),
          h('span', {}, pr ? (pct >= 99 ? 'Terminé' : `Page ${pr.page} sur ${b.pages} · ${pct} %`) : `${b.pages} page${b.pages > 1 ? "s" : ""} · pas encore lu`)),
        h('div', { class: 'blast' }, b.trashed ? `À la poubelle depuis ${lastRead(b.trashed)}` : pr ? `Dernière lecture : ${lastRead(pr.last)}` : 'Jamais ouvert'),
        S.me.role === 'owner' && window.LocalAPI ? quickBar(b) : null));
    if (Sel.on) { row.classList.add('selecting'); if (Sel.ids.has(b.id)) row.classList.add('picked'); thumb.append(h('span', { class: 'selbox', 'aria-hidden': 'true' }, icon('check'))); }
    row.addEventListener('click', (e) => { if (Sel.on) { e.preventDefault(); return selToggle(b, row); } if (e.target.closest('.qbar')) return; if (S.organize || b.trashed) return editBook(b); if (b.status === 'ready') openBook(b, thumb); });
    ownerGestures(row, b);
    list.append(row);
  }
  return list;
}
// ================= Rayons : menu, tri, favoris, collections =================
const NAV = {
  reading: ['Lecture en cours', 'reading'], all: ['Tous les livres', 'book'], fav: ['Favoris', 'star'],
  alire: ['À lire', 'clock'], lu: ['Déjà lu', 'checks'], authors: ['Auteurs', 'person'], trash: ['Poubelle', 'trash'],
};
const FMT = { pdf: 'PDF', images: 'BD et photos', audio: 'Livres audio', epub: 'EPUB', mobi: 'Kindle', docx: 'Word', doc: 'Word ancien', odt: 'OpenDocument', rtf: 'RTF', fb2: 'FictionBook', html: 'Page web', txt: 'Texte' };
const SORTS = { recent: 'Ajout récent', last: 'Dernière lecture', title: 'Titre', author: 'Auteur' };
S.nav = store.get('nav', { k: 'all' }); S.sort = store.get('sort', 'recent'); S.cols = [];
const authorOf = (b) => (b.author || '').trim() || 'Auteur inconnu';
const sameNav = (a, b) => a.k === b.k && (a.v || '') === (b.v || '');
function navTitle(nav = S.nav) {
  if (nav.k === 'author') return nav.v;
  if (nav.k === 'col') return S.cols.find((c) => c.id === nav.v)?.name || 'Collection';
  if (nav.k === 'fmt') return FMT[nav.v] || nav.v;
  return (NAV[nav.k] || NAV.all)[0];
}
function inNav(b, nav = S.nav) {
  if (!inLib(b)) return false;
  if (nav.k === 'trash') return !!b.trashed;
  if (b.trashed) return false;
  switch (nav.k) {
    case 'reading': return !!b.progress && b.state !== 'lu';
    case 'fav': return b.fav;
    case 'alire': return b.state === 'alire';
    case 'lu': return b.state === 'lu';
    case 'author': return authorOf(b) === nav.v;
    case 'col': return (b.cols || []).includes(nav.v);
    case 'fmt': return b.kind === nav.v;
    default: return true;
  }
}
const frCmp = (a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base', numeric: true });
const authorCmp = (a, b) => (a === 'Auteur inconnu') - (b === 'Auteur inconnu') || frCmp(a, b);
function sortBooks(list) {
  const s = S.nav.k === 'reading' && S.sort === 'recent' ? 'last' : S.sort;
  const by = {
    title: (a, b) => frCmp(a.title, b.title),
    author: (a, b) => authorCmp(authorOf(a), authorOf(b)) || frCmp(a.title, b.title),
    last: (a, b) => (b.progress?.last || 0) - (a.progress?.last || 0),
  };
  return by[s] ? [...list].sort(by[s]) : list;
}
function groupByAuthor(books) {
  const m = new Map(); for (const b of books) { const a = authorOf(b); if (!m.has(a)) m.set(a, []); m.get(a).push(b); }
  return [...m.entries()];
}
function go(nav) { S.nav = nav; store.set('nav', nav); S.filter = ''; S.organize = false; renderLibrary(); scrollTo(0, 0); }
async function loadCols() { try { S.cols = window.LocalAPI ? await api('/api/collections') : []; } catch { S.cols = []; } }
async function patchBook(b, data, msg) {
  try { await post('/api/books/' + b.id, data, 'PATCH'); Object.assign(b, data); await loadBooks(); renderLibrary(); if (msg) toast(msg); }
  catch (e) { toast(e.message); }
}
const toggleFav = (b) => patchBook(b, { fav: !b.fav }, b.fav ? 'Retiré des favoris' : 'Ajouté aux favoris');
const toggleState = (b, st) => patchBook(b, { state: b.state === st ? '' : st }, b.state === st ? (st === 'lu' ? 'Retiré de « Déjà lu »' : 'Retiré de « À lire »') : (st === 'lu' ? 'Marqué « Déjà lu »' : 'Ajouté à « À lire »'));
const trashBook = (b) => patchBook(b, { trashed: true }, 'Mis à la poubelle');
const restoreBook = (b) => patchBook(b, { trashed: false }, 'Livre restauré');
async function deleteForever(b) {
  if (!confirm(`Supprimer définitivement « ${b.title} » ?`)) return;
  await api('/api/books/' + b.id, { method: 'DELETE' }); await loadBooks(); renderLibrary(); toast('Supprimé définitivement');
}

// Toutes petites icônes sous chaque livre de l'étagère
function tinyIcons(b) {
  const ic = (name, label, on, fn) => h('span', { class: 'ti' + (on ? ' on' : ''), role: 'button', tabindex: '0', title: label, 'aria-label': label, 'aria-pressed': on ? 'true' : 'false',
    onclick: (e) => { e.stopPropagation(); e.preventDefault(); fn(); } }, icon(name));
  return h('span', { class: 'tiny' },
    ic(b.fav ? 'starFill' : 'star', 'Favori', b.fav, () => toggleFav(b)),
    ic('clock', 'À lire', b.state === 'alire', () => toggleState(b, 'alire')),
    ic('checks', 'Déjà lu', b.state === 'lu', () => toggleState(b, 'lu')),
    libs().find((l) => l.id === (b.lib || 'main'))?.web // dans « Livres du web », ranger passe devant les collections
      ? (() => { const x = ic('move', 'Ranger dans une autre bibliothèque', false, () => moveDialog(b)); x.classList.add('hot'); return x; })()
      : ic('collection', 'Collections', (b.cols || []).length > 0, () => collectionsDialog(b)),
    (() => { const x = ic('dots', 'Options : résumé IA, Professeur, vidéo, ranger…', false, () => editBook(b)); x.classList.add('more'); return x; })());
}
// Bulle de découverte, une seule fois : le menu d'options d'un livre est le cœur de l'application
function coachOptions() {
  $('.coach')?.remove();
  if (store.get('tipOpts', false) || !window.LocalAPI || S.me?.role !== 'owner' || $('.reader') || $('.scrim')) return;
  const first = $('.case .book, .blist .brow'); if (!first) return;
  const r = first.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const done = () => { store.set('tipOpts', true); tip.remove(); };
  const tip = h('div', { class: 'coach', role: 'dialog' },
    h('b', {}, 'Plus d\'options pour chaque livre'),
    h('p', {}, 'Appuie longuement sur un livre, ou touche ', h('span', { class: 'coachdots' }, icon('dots')), ' en dessous : Résumé IA, Professeur, Vidéo, Ranger dans une bibliothèque, Ouvrir avec…'),
    h('div', { class: 'coachact' }, h('button', { class: 'btn', onclick: () => { done(); editBook(S.books.find((x) => first.getAttribute('aria-label')?.startsWith(x.title)) || S.books.find((x) => !x.trashed)); } }, 'Voir'), h('button', { class: 'btn primary', onclick: done }, 'Compris')));
  document.body.append(tip);
  const w = Math.min(320, innerWidth - 24), left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const below = r.bottom + 70 + 170 < innerHeight;
  Object.assign(tip.style, { width: w + 'px', left: left + 'px', top: (below ? r.bottom + 64 + scrollY : r.top - 12 + scrollY) + 'px', transform: below ? 'none' : 'translateY(-100%)' });
  tip.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px'); tip.classList.add(below ? 'down' : 'up');
  first.classList.add('coached');
}
// Boutons rapides de la vue liste
function quickBar(b, { labels } = {}) {
  const btn = (ic, label, on, fn) => h('button', { class: 'qb' + (on ? ' on' : ''), title: label, 'aria-label': label, 'aria-pressed': on ? 'true' : 'false', onclick: (e) => { e.stopPropagation(); fn(); } }, icon(ic), labels ? h('span', {}, label) : null);
  if (b.trashed) return h('div', { class: 'qbar' + (labels ? ' big' : '') },
    btn('restore', 'Restaurer', false, () => restoreBook(b)), btn('trash', 'Supprimer', false, () => deleteForever(b)));
  return h('div', { class: 'qbar' + (labels ? ' big' : '') },
    btn(b.fav ? 'starFill' : 'star', 'Favori', b.fav, () => toggleFav(b)),
    btn('clock', 'À lire', b.state === 'alire', () => toggleState(b, 'alire')),
    btn('checks', 'Déjà lu', b.state === 'lu', () => toggleState(b, 'lu')),
    btn('collection', 'Collections', (b.cols || []).length > 0, () => collectionsDialog(b)),
    window.LocalAPI && !labels ? (() => { const x = btn('move', 'Ranger dans une autre bibliothèque', false, () => moveDialog(b)); if (libs().find((l) => l.id === (b.lib || 'main'))?.web) x.classList.add('hot'); return x; })() : null,
    labels ? null : btn('dots', 'Plus', false, () => editBook(b)));
}
// ---- Ranger un livre dans une autre bibliothèque : un toucher ----
async function moveBooks(list, libId) {
  for (const b of list) await post('/api/books/' + b.id, { lib: libId }, 'PATCH');
  const l = libs().find((x) => x.id === libId);
  await loadBooks(); renderLibrary();
  toast(list.length > 1 ? `${list.length} livres rangés dans « ${l?.name} »` : `Rangé dans « ${l?.name} »`);
}
function newLibPrompt() {
  const name = (prompt('Nom de la nouvelle bibliothèque :', '') || '').trim().slice(0, 60); if (!name) return null;
  const l = libs(); const used = new Set(l.map((x) => x.decor));
  const lib = { id: 'lib' + Date.now().toString(36), name, decor: DECORS.map(([k]) => k).find((k) => !used.has(k)) || 'noyer' };
  l.push(lib); saveLibs(l); return lib;
}
// Rangée de pastilles : la bibliothèque du livre est cochée, on touche une autre pour l'y ranger
function libChips(list, after) {
  const cur = list.length === 1 ? (list[0].lib || 'main') : null;
  const chip = (l) => h('button', { class: 'libchip' + (l.id === cur ? ' sel' : ''), onclick: async () => { if (l.id === cur) return; await moveBooks(list, l.id); after && after(l); } },
    h('span', { class: 'libsw', style: { '--sw': DECOR_SWATCH[l.decor] || '#555' } }), h('span', {}, l.name), l.id === cur ? icon('checks') : null);
  return h('div', { class: 'libchips' }, libs().map(chip),
    h('button', { class: 'libchip add', onclick: async () => { const l = newLibPrompt(); if (!l) return; await moveBooks(list, l.id); after && after(l); } }, icon('plus'), h('span', {}, 'Nouvelle')));
}
function moveDialog(b) {
  const list = Array.isArray(b) ? b : [b];
  const close = sheet(list.length > 1 ? `Ranger ${list.length} livres` : 'Ranger dans…', h('div', {},
    list.length === 1 ? h('p', { class: 'muted', style: { marginTop: '-4px' } }, `« ${list[0].title} »`) : null,
    libChips(list, () => close())));
}

function collectionsDialog(b) {
  const chosen = new Set(b.cols || []);
  const list = h('div', { class: 'checks' });
  const draw = () => list.replaceChildren(...(S.cols.length ? S.cols.map((c) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: chosen.has(c.id), onchange: (e) => e.target.checked ? chosen.add(c.id) : chosen.delete(c.id) }), h('span', {}, c.name))) : [h('p', { class: 'muted' }, 'Aucune collection pour l\'instant.')]));
  draw();
  const name = h('input', { placeholder: 'Nom de la collection', maxlength: 60 });
  const create = async () => {
    try { const c = await post('/api/collections', { name: name.value }); S.cols.push(c); chosen.add(c.id); name.value = ''; draw(); } catch (e) { toast(e.message); }
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  const close = sheet('Collections', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
    h('div', { class: 'newcol' }, name, h('button', { class: 'btn', onclick: create }, icon('plus'), 'Créer')),
    list,
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'flex-end' } },
      h('button', { class: 'btn primary', onclick: async () => { close(); await patchBook(b, { cols: [...chosen] }); } }, 'OK'))));
}
function editCollection(c) {
  const name = h('input', { value: c.name, maxlength: 60 });
  const n = S.books.filter((b) => !b.trashed && (b.cols || []).includes(c.id)).length;
  const close = sheet('Collection', h('div', {},
    h('label', { class: 'field' }, 'Nom', name),
    h('p', { class: 'muted' }, `${n} livre${n > 1 ? 's' : ''}`),
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: async () => { if (!confirm(`Supprimer la collection « ${c.name} » ? Les livres restent dans la bibliothèque.`)) return; await api('/api/collections/' + c.id, { method: 'DELETE' }); close(); await loadBooks(); if (S.nav.k === 'col' && S.nav.v === c.id) S.nav = { k: 'all' }; store.set('nav', S.nav); renderLibrary(); toast('Collection supprimée'); } }, 'Supprimer'),
      h('button', { class: 'btn primary', onclick: async () => { await post('/api/collections/' + c.id, { name: name.value }, 'PATCH'); close(); await loadBooks(); renderLibrary(); } }, 'Enregistrer'))));
}
async function newCollection() {
  const name = prompt('Nom de la nouvelle collection'); if (!name || !name.trim()) return;
  try { const c = await post('/api/collections', { name }); await loadBooks(); go({ k: 'col', v: c.id }); toast('Collection créée. Ajoute des livres avec le bouton collections.'); } catch (e) { toast(e.message); }
}

// Menu latéral
function openDrawer() {
  const count = (nav) => S.books.filter((b) => inNav(b, nav)).length;
  const close = () => scrim.remove();
  const item = (nav, label, ic, extra) => h('div', { class: 'ditem-row' },
    h('button', { class: 'ditem' + (sameNav(nav, S.nav) ? ' sel' : ''), onclick: () => { close(); go(nav); } }, icon(ic), h('span', {}, label), h('em', {}, nav.k === 'authors' ? new Set(S.books.filter((b) => !b.trashed && inLib(b)).map(authorOf)).size : count(nav))),
    extra || null);
  const fmts = Object.keys(FMT).filter((k) => count({ k: 'fmt', v: k }));
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Menu' },
    h('button', { class: 'dhead', onclick: () => { close(); openLibraries(); } }, h('div', { class: 'dmark' }, '❦'), h('span', { class: 'dlib' }, h('b', {}, libName()), h('small', {}, 'Changer de bibliothèque')), icon('chev')),
    ['reading', 'all', 'fav', 'alire', 'lu'].map((k) => item({ k }, NAV[k][0], NAV[k][1])),
    h('div', { class: 'dsec' }, 'Collections'),
    S.cols.map((c) => item({ k: 'col', v: c.id }, c.name, 'collection', h('button', { class: 'dedit', 'aria-label': 'Modifier ' + c.name, onclick: () => { close(); editCollection(c); } }, icon('pencil')))),
    h('button', { class: 'ditem add', onclick: () => { close(); newCollection(); } }, icon('plus'), h('span', {}, 'Créer une collection')),
    h('div', { class: 'dsec' }, 'Classer'),
    item({ k: 'authors' }, NAV.authors[0], NAV.authors[1]),
    fmts.map((k) => item({ k: 'fmt', v: k }, FMT[k], 'layers')),
    h('div', { class: 'dline' }),
    item({ k: 'trash' }, 'Poubelle', 'trash'),
    window.AndroidBilling && Premium.st.play ? h('button', { class: 'ditem', onclick: () => { close(); Premium.offer(); } }, icon('spark'), h('span', {}, Premium.ok() ? 'Premium activé ✓' : 'Bibliothèque Premium')) : null);
  const scrim = h('div', { class: 'scrim drawer-scrim', onclick: (e) => { if (e.target === scrim) close(); } }, panel);
  document.body.append(scrim);
}

function authorsEl(q) {
  const groups = groupByAuthor(S.books.filter((b) => !b.trashed && inLib(b))).filter(([a]) => !q || fold(a).includes(fold(q))).sort((x, y) => authorCmp(x[0], y[0]));
  if (!groups.length) return h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Aucun auteur.');
  return h('div', { class: 'authors' }, groups.map(([a, bs]) => h('button', { class: 'author', onclick: () => go({ k: 'author', v: a }) },
    h('span', { class: 'ini' }, a === 'Auteur inconnu' ? '?' : a.trim()[0].toUpperCase()),
    h('span', { class: 'aname' }, a), h('em', {}, `${bs.length} livre${bs.length > 1 ? 's' : ''}`))));
}
const EMPTY = {
  reading: 'Aucune lecture en cours. Ouvre un livre pour le retrouver ici.',
  fav: 'Aucun favori. Touche ☆ sous un livre (vue liste) ou fais un appui long sur sa couverture.',
  alire: 'Rien à lire pour l\'instant. Touche l\'horloge sous un livre pour l\'ajouter ici.',
  lu: 'Aucun livre terminé. Un livre lu jusqu\'à la dernière page arrive ici tout seul.',
  col: 'Cette collection est vide. Touche le bouton collections sous un livre pour l\'y ranger.',
  trash: 'La poubelle est vide.',
};
function caseFor(groups, owner) {
  const n = perRow();
  const caseEl = h('div', { class: 'case' + (S.organize ? ' organize' : '') });
  for (const [label, bs] of groups) {
    if (label) caseEl.append(h('div', { class: 'shelf-label' }, label, h('em', {}, bs.length)));
    const rows = Math.max(groups.length === 1 ? (owner || bs.length ? 2 : 1) : 1, Math.ceil(bs.length / n));
    for (let r = 0; r < rows; r++) {
      const row = h('div', { class: 'shelf-books', style: { gridTemplateColumns: `repeat(${n}, 1fr)` } }, bs.slice(r * n, r * n + n).map(bookEl));
      caseEl.append(h('div', { class: 'shelf' }, row, h('div', { class: 'plank' })));
    }
  }
  return caseEl;
}

const fold = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Défilement : pendant que le doigt fait glisser l'étagère (ou qu'elle file sur son élan), aucun travail lourd.
// Les mises à jour faites en arrière-plan (vérification des dossiers, couvertures refaites…) attendent la fin du geste :
// redessiner toute l'étagère en plein défilement donnait « une grosse saccade ».
const Glide = { last: 0, tap: 0, down: false, wait: [],
  busy() { return this.down || Date.now() - this.last < 350; },
  later(fn) { this.wait.push(fn); this.kick(); },
  async idle() { do await new Promise((r) => setTimeout(r, this.busy() ? 400 : 30)); while (this.busy()); }, // attend que l'étagère soit immobile
  kick() { clearTimeout(this.t); this.t = setTimeout(() => { if (this.busy()) return this.kick(); const w = this.wait.splice(0); w.forEach((f) => f()); }, 400); },
};
addEventListener('scroll', () => { Glide.last = Date.now(); }, { passive: true, capture: true });
addEventListener('touchstart', () => { Glide.down = true; Glide.tap = Date.now(); }, { passive: true, capture: true });
addEventListener('touchend', () => { Glide.down = false; }, { passive: true, capture: true });
addEventListener('touchcancel', () => { Glide.down = false; }, { passive: true, capture: true });
addEventListener('click', () => { Glide.tap = Date.now(); }, { capture: true });
// Couvertures : chargées « paresseusement » pour un démarrage rapide, puis préparées quelques-unes à la fois,
// seulement quand l'étagère est immobile — sinon chacune se charge pendant le défilement et l'étagère saccade.
let warmTimer = 0;
function warmCovers() {
  clearTimeout(warmTimer);
  const step = () => {
    if (Glide.busy()) { warmTimer = setTimeout(step, 500); return; }
    const imgs = [...document.querySelectorAll('.room img[loading="lazy"]')].slice(0, 6);
    if (!imgs.length) return;
    imgs.forEach((i) => { i.loading = 'eager'; i.decode?.().catch(() => {}); }); // décodée d'avance : rien à préparer au moment où elle arrive à l'écran
    warmTimer = setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(step, { timeout: 1500 }), 120);
  };
  warmTimer = setTimeout(step, 800);
}
// Vignettes des couvertures à la taille de l'écran, préparées une à une quand l'étagère est immobile
let thumbsRun = null;
function thumbsSoon() {
  if (!window.LocalAPI?.makeThumbs || thumbsRun) return;
  const pause = async () => { do await new Promise((r) => setTimeout(r, Glide.busy() ? 500 : 40)); while (Glide.busy() || window.__reader); };
  thumbsRun = LocalAPI.makeThumbs(null, pause).then(async (n) => { if (n) { await loadBooks(); if (!$('.reader')) renderLibrary(); } })
    .catch(() => {}).finally(() => { thumbsRun = null; });
}
let pendingRender = null;
function renderLibrary(opts = {}) {
  // Appel venu de l'arrière-plan pendant un défilement (pas d'un toucher de l'utilisateur) : on attend la fin du geste
  if (!opts.now && Glide.busy() && Date.now() - Glide.tap > 600) {
    const first = !pendingRender; pendingRender = opts;
    if (first) Glide.later(() => { const o = pendingRender; pendingRender = null; if (!$('.reader')) renderLibrary({ ...o, now: true }); });
    return;
  }
  pendingRender = null;
  warmCovers();
  const owner = S.me.role === 'owner';
  const local = !!window.LocalAPI;
  if (local && !store.get('libnames16', false)) { // une fois : la bibliothèque prend le nom de son dossier
    const m = folderMap(); for (const l of libs()) if (m[l.id]?.ok !== false && m[l.id]?.name) nameLibAfter(l.id, m[l.id].name);
    store.set('libnames16', true);
  }
  if (!local) S.nav = { k: 'all' };
  if (S.nav.k === 'col' && !S.cols.some((c) => c.id === S.nav.v)) S.nav = { k: 'all' };
  const q = S.filter.toLowerCase();
  // recherche sans tenir compte des accents ni des majuscules : « depart » trouve « Départ »
  const nq = fold(S.filter);
  const books = sortBooks(S.books.filter((b) => inNav(b) && (!nq || fold(b.title + ' ' + (b.author || '')).includes(nq))));
  const asList = S.view === 'list';
  const live = S.books.filter((b) => !b.trashed && inLib(b));
  let body;
  if (S.nav.k === 'authors') body = authorsEl(q);
  else {
    const groups = S.sort === 'author' && S.nav.k !== 'author' && books.length ? groupByAuthor(books) : [[null, books]];
    body = asList ? h('div', {}, groups.map(([g, bs]) => [g ? h('h3', { class: 'group-h' }, g, h('em', {}, bs.length)) : null, listEl(bs)]).flat()) : caseFor(groups, owner);
    if (local && curLib()?.web && live.length && S.nav.k !== 'trash') {
      const note = h('div', { class: 'webnote' }, icon('globe'),
        h('span', {}, 'Les livres téléchargés arrivent ici. Touche le dossier doré sous un livre pour le ', h('b', {}, 'ranger'), ' dans une autre bibliothèque.'),
        h('button', { class: 'btn', onclick: () => moveDialog(live) }, icon('move'), 'Tout ranger…'));
      body.prepend(note);
    }
    if (!live.length && S.nav.k !== 'trash') {
      const msg = h('div', { class: 'empty' },
        h('h3', {}, owner ? 'Tes rayons t\'attendent' : 'Les rayons sont encore vides'),
        h('p', {}, owner ? (local ? 'Ajoute un livre (PDF, EPUB, Word…), un dossier entier, ou trouve des livres gratuits.' : 'Ajoute un PDF ou un fichier texte. Tu peux aussi glisser des fichiers ici.') : 'Reviens bientôt, de nouveaux livres arrivent.'),
        owner ? h('div', { class: 'actions', style: { justifyContent: 'center' } },
          h('button', { class: 'btn primary', onclick: pickFiles }, icon('plus'), 'Ajouter un livre'),
          local ? h('button', { class: 'btn', onclick: openAddMenu }, icon('dots'), 'Autres façons') : null) : null);
      asList ? body.prepend(msg) : (body.querySelector('.shelf') || body).prepend(msg);
    } else if (!books.length) {
      const msg = h('div', { class: 'empty' }, h('p', {}, q ? 'Aucun livre ne correspond à ta recherche.' : (EMPTY[S.nav.k] || 'Aucun livre ici.')));
      asList ? body.prepend(msg) : (body.querySelector('.shelf') || body).prepend(msg);
    }
  }
  const ready = live.filter((b) => b.status === 'ready');
  const current = ['all', 'reading'].includes(S.nav.k) && !q ? ready.filter((b) => b.progress && b.progress.page < b.pages && b.state !== 'lu').sort((a, b) => b.progress.last - a.progress.last)[0] : null;
  const actions = h('div', { class: 'actions' },
    owner ? h('button', { class: 'btn primary', onclick: local ? openAddMenu : pickFiles }, icon('plus'), h('span', { class: 'lbl' }, 'Ajouter')) : null,
    owner && local && S.lib !== 'all' ? h('button', { class: 'btn', title: 'Dossier source', onclick: () => openFolder() }, icon('folder'), h('span', { class: 'lbl' }, folderInfo() ? folderInfo().name : 'Dossier')) : null,
    owner && local && (folderInfo() || (S.lib === 'all' && libsWithFolder().length)) ? h('button', { class: 'btn icon refresh' + (FOLDER.busy ? ' spin' : ''), title: S.lib === 'all' ? 'Actualiser tous les dossiers' : 'Actualiser le dossier', 'aria-label': 'Actualiser', onclick: () => refreshFolders() }, icon('refresh')) : null,
    owner && local && window.AndroidShare ? h('button', { class: 'btn icon', title: 'Partager cette bibliothèque', 'aria-label': 'Partager cette bibliothèque', onclick: () => shareLibraryPick() }, icon('share')) : null,
    owner && !local ? h('button', { class: 'btn', onclick: openShare, title: 'Partager' }, icon('share'), h('span', { class: 'lbl' }, 'Partager')) : null,
    owner && !local ? h('button', { class: 'btn', onclick: openDashboard, title: 'Lecteurs' }, icon('people'), h('span', { class: 'lbl' }, 'Lecteurs')) : null,
    TV.canCast() ? h('button', { class: 'btn icon', title: 'Caster sur la télé', 'aria-label': 'Caster sur la télé', onclick: () => TV.cast() }, icon('cast')) : null,
    Tele.on() ? h('button', { class: 'btn icon', title: 'Vidéo sur la télé', 'aria-label': 'Vidéo sur la télé', onclick: () => Tele.open() }, icon('tvplay')) : null,
    h('button', { class: 'btn icon', title: 'Réglages', onclick: openSettings }, icon('gear')),
  );
  const count = S.nav.k === 'authors' ? `${new Set(live.map(authorOf)).size} auteurs` : `${books.length} livre${books.length > 1 ? 's' : ''}`;
  const toolbar = S.books.length ? h('div', { class: 'toolbar' },
    h('input', { class: 'search', placeholder: S.nav.k === 'authors' ? 'Rechercher un auteur' : 'Rechercher un titre ou un auteur', value: S.filter, type: 'search', enterkeyhint: 'search', autocomplete: 'off', oninput: (e) => { S.filter = e.target.value; clearTimeout(renderLibrary.t); renderLibrary.t = setTimeout(() => renderLibrary({ keepSearch: true }), 220); } }),
    S.nav.k !== 'authors' ? h('label', { class: 'sortsel', title: 'Trier' }, h('span', {}, 'Trier'),
      h('select', { onchange: (e) => { S.sort = e.target.value; store.set('sort', S.sort); renderLibrary(); } },
        Object.entries(SORTS).map(([k, l]) => h('option', { value: k, selected: k === S.sort }, l)))) : null,
    S.nav.k !== 'authors' ? h('button', { class: 'btn icon', title: asList ? 'Voir l\'étagère' : 'Voir la liste', onclick: () => { S.view = asList ? 'shelf' : 'list'; store.set('view', S.view); renderLibrary(); } }, icon(asList ? 'shelf' : 'list')) : null,
    owner && local && S.nav.k !== 'authors' && S.nav.k !== 'trash' && books.length ? h('button', { class: 'btn icon' + (Sel.on ? ' on' : ''), title: 'Sélectionner plusieurs livres', 'aria-label': 'Sélectionner plusieurs livres', onclick: () => (Sel.on ? selEnd() : selStart()) }, icon('checkbox')) : null,
    owner && S.nav.k !== 'authors' && S.nav.k !== 'trash' && books.length ? h('button', { class: 'btn icon' + (S.organize ? ' on' : ''), title: 'Organiser', onclick: () => { S.organize = !S.organize; renderLibrary(); if (S.organize) toast('Touche un livre pour le modifier'); } }, icon('pencil')) : null,
    S.nav.k === 'trash' && books.length ? h('button', { class: 'btn danger', onclick: async () => { if (!confirm(`Supprimer définitivement les ${books.length} livres de la poubelle ?`)) return; for (const b of books) await api('/api/books/' + b.id, { method: 'DELETE' }); await loadBooks(); renderLibrary(); toast('Poubelle vidée'); } }, 'Vider') : null,
  ) : null;
  const navBack = ['author', 'col', 'fmt'].includes(S.nav.k);
  const room = h('div', { class: 'room' }, h('div', { class: 'wrap' },
    h('header', { class: 'top' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-row' },
          local ? h('button', { class: 'btn icon menu-btn', title: 'Menu', 'aria-label': 'Menu', onclick: openDrawer }, icon('menu')) : null,
          local ? h('button', { class: 'libswitch', title: 'Changer de bibliothèque', onclick: openLibraries }, h('h1', {}, libName()), icon('chev')) : h('h1', {}, S.me.library || 'Bibliothèque')),
        h('p', { class: 'navline' },
          navBack ? h('button', { class: 'crumb', onclick: () => go({ k: S.nav.k === 'author' ? 'authors' : 'all' }) }, icon('back'), S.nav.k === 'author' ? 'Auteurs' : 'Tous') : null,
          h('b', {}, navTitle()), ` · ${count}${owner ? '' : ' · Bonjour ' + S.me.name}`,
          S.nav.k === 'col' ? h('button', { class: 'crumb', onclick: () => editCollection(S.cols.find((c) => c.id === S.nav.v)) }, icon('pencil')) : null)),
      actions),
    local && owner ? libTabs() : null,
    current ? heroEl(current) : null,
    toolbar,
    body,
    owner && books.length && S.nav.k !== 'trash' && S.nav.k !== 'authors' ? h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '18px' } }, asList ? (local ? 'Appui long sur un livre (ou ⋮) : résumé IA, Professeur, vidéo, ranger et plus.' : 'Les boutons sous chaque livre : favori, à lire, déjà lu, collections.') : (local ? 'Appui long sur un livre (ou ⋮) : résumé IA, Professeur, vidéo, ranger et plus.' : 'Sous chaque livre : favori, à lire, déjà lu, collections. Appui long pour modifier.')) : null,
  ));
  // pendant une recherche, le champ reste en place : sinon le clavier d'Android perd le mot en cours de frappe
  if (document.activeElement && document.activeElement.classList.contains('search')) opts.keepSearch = true; // toute mise à jour pendant la frappe épargne le champ
  const ow = $('#app .wrap'), nw = $('.wrap', room), ot = ow && $(':scope > .toolbar', ow), nt = $(':scope > .toolbar', nw);
  if (opts.keepSearch && ot && nt) {
    const before = [], after = []; let seen = false;
    for (const c of [...nw.children]) { if (c === nt) { seen = true; continue; } (seen ? after : before).push(c); }
    [...ow.children].forEach((c) => { if (c !== ot) c.remove(); });
    ot.before(...before); ot.after(...after);
  } else $('#app').replaceChildren(room);
  setTimeout(coachOptions, 900);
  // hors de #app : les messages d'envoi survivent au rafraîchissement de l'étagère
  if (!$('#uploads')) document.body.append(h('div', { class: 'uploads', id: 'uploads' }));
  if (!$('#dz')) document.body.append(h('div', { class: 'dropzone', id: 'dz' }, h('div', {}, 'Dépose tes livres ici')));
  AutoSync.schedule();
  selBarRender();
}
function heroEl(b) {
  const pct = Math.round((b.progress.page / b.pages) * 100);
  const mini = h('div', { class: 'mini' }, coverEl(b));
  return h('section', { class: 'hero' }, mini, h('div', {},
    h('small', {}, 'Reprendre la lecture'),
    h('h2', {}, b.title), b.author ? h('p', { class: 'by' }, b.author) : h('p', { class: 'by' }),
    h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })),
    h('div', { class: 'meta' }, `Page ${b.progress.page} sur ${b.pages} · ${pct} % · lu ${lastRead(b.progress.last)}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => openBook(b, mini) }, icon('book'), 'Continuer'),
      h('button', { class: 'btn', onclick: () => openBook(b, mini, { audio: true }) }, icon('headphones'), 'Écouter'))));
}
// l'étagère dépend seulement de la largeur : l'ouverture du clavier (qui change la hauteur) ne doit rien reconstruire,
// sinon le champ de recherche perd le focus et le clavier se referme aussitôt
let resizeT, lastW = innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    if ($('.case') && !$('.reader')) renderLibrary({ keepSearch: document.activeElement?.classList.contains('search') });
  }, 150);
});

// ================= Ajout de livres =================
const BOOK_ACCEPT = '.cbz,.fbz,.zip,.jpg,.jpeg,.png,.webp,image/*,.mp3,.m4b,.m4a,.aac,.ogg,.opus,.flac,audio/*,.pdf,.epub,.mobi,.azw,.azw3,.prc,.docx,.doc,.odt,.rtf,.fb2,.html,.htm,.xhtml,.txt,.md,.markdown,.text,application/pdf,application/epub+zip,text/plain,text/html,application/rtf,application/msword,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function pickFiles() {
  const inp = h('input', { type: 'file', accept: window.LocalAPI ? BOOK_ACCEPT : '.pdf,.txt,.md,application/pdf,text/plain', multiple: true });
  inp.style.display = 'none'; document.body.append(inp);
  inp.onchange = () => { uploadFiles([...inp.files]); inp.remove(); };
  inp.click();
}
async function uploadFiles(files, { lib: target } = {}) {
  const added = [];
  const pics = window.LocalAPI ? files.filter((f) => IMAGE_EXT.test(f.name)) : [];
  if (pics.length) { // des photos de pages choisies ensemble = un livre
    files = files.filter((f) => !pics.includes(f));
    const box = h('div', { class: 'up' }, h('b', {}, `Livre en photos · ${pics.length} page${pics.length > 1 ? 's' : ''}`), h('span', { class: 'muted' }, 'Préparation…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    try { const m = await LocalAPI.uploadImages(pics, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = msg; }, { lib: target || (S.lib === 'all' ? firstLibId() : curLib().id) }); added.push(m); box.remove(); toast(`« ${m.title} » est sur l'étagère · touche ⋮ puis « Convertir en texte » pour le lire en texte`); }
    catch (e) { $('span', box).textContent = e.message; setTimeout(() => box.remove(), 6000); }
  }
  const aud = window.LocalAPI ? files.filter((f) => AUDIO_EXT.test(f.name)) : [];
  if (aud.length > 1) { // plusieurs pistes choisies ensemble = un seul livre audio
    files = files.filter((f) => !aud.includes(f));
    const box = h('div', { class: 'up' }, h('b', {}, `Livre audio · ${aud.length} pistes`), h('span', { class: 'muted' }, 'Lecture…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    try { const m = await LocalAPI.uploadAudio(aud, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = msg; }, { lib: target || (S.lib === 'all' ? firstLibId() : curLib().id) }); added.push(m); box.remove(); toast(`« ${m.title} » est sur l'étagère`); }
    catch (e) { $('span', box).textContent = e.message; setTimeout(() => box.remove(), 6000); }
  }
  for (const f of files) {
    if (window.LocalAPI?.findDup) { const d = await LocalAPI.findDup(f, target || (S.lib === 'all' ? firstLibId() : curLib().id)); if (d) { toast(`« ${d.title} » est déjà sur l'étagère`); added.push(d); continue; } }
    const box = h('div', { class: 'up' }, h('b', {}, f.name), h('span', { class: 'muted' }, 'Envoi…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    try {
      if (window.LocalAPI) added.push(await LocalAPI.upload(f, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = msg; }, { lib: target || (S.lib === 'all' ? firstLibId() : curLib().id) }));
      else await new Promise((res, rej) => {
        const x = new XMLHttpRequest(); x.open('POST', '/api/books');
        x.setRequestHeader('X-Filename', encodeURIComponent(f.name));
        x.upload.onprogress = (e) => { if (e.lengthComputable) { $('i', box).style.width = Math.round((e.loaded / e.total) * 100) + '%'; if (e.loaded === e.total) $('span', box).textContent = 'Préparation des pages…'; } };
        x.onload = () => x.status < 300 ? res() : rej(new Error((() => { try { return JSON.parse(x.responseText).error; } catch { return 'Erreur'; } })()));
        x.onerror = () => rej(new Error('Connexion perdue'));
        x.send(f);
      });
      box.remove(); toast(`« ${f.name.replace(/\.[^.]+$/, '')} » est sur l'étagère`);
    } catch (e) { $('span', box).textContent = e.message; $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000); }
  }
  await loadBooks(); renderLibrary();
  return added;
}
// Les livres venus d'Internet (catalogues, liens) ont leur propre bibliothèque, créée au premier téléchargement
function webLib() {
  const l = libs(); let lib = l.find((x) => x.web);
  if (!lib) { lib = { id: 'web' + Date.now().toString(36), name: 'Livres du web', decor: 'olivier', web: true }; l.push(lib); saveLibs(l); }
  return lib;
}

// ================= Version Premium (achat unique sur Google Play) =================
// L'essentiel reste gratuit. Premium débloque le Professeur, les résumés IA, les tons expressifs,
// la conversion photo → texte (un livre offert pour essayer) et le partage de bibliothèques.
// Copies installées hors de Google Play (APK, version web) : tout est débloqué.
const PREMIUM_FEATS = [
  ['prof', 'prof', 'Le Professeur bizarroïde', 'Pose tes questions sur le livre, il t’explique en vidéo'],
  ['summary', 'spark', 'Résumés IA', 'Le résumé de chaque livre en un toucher'],
  ['tones', 'voice', 'Tons de voix expressifs', 'Conteur, Enjoué, Passionné'],
  ['ocr', 'type', 'Photo → texte illimité', 'Convertis tous tes livres photographiés en vrai texte'],
  ['share', 'share', 'Partage de bibliothèques', 'Envoie une bibliothèque entière à un proche'],
];
const PREMIUM_TONES = new Set(['conteur', 'enjoue', 'passionne']);
const Premium = {
  st: { play: false, premium: false, price: '', pending: false, ready: false },
  close: null,
  init() { try { if (window.AndroidBilling) this.st = { ...this.st, ...JSON.parse(AndroidBilling.state()) }; } catch {} },
  ok() { return !window.AndroidBilling || !this.st.play || !!this.st.premium; },
  need(what) { if (this.ok()) return true; this.offer(what); return false; },
  badge() { return this.ok() ? null : h('span', { class: 'pbadge' }, '★'); },
  offer(what) {
    stopAllAudio?.();
    const st = this.st;
    const feats = h('div', { class: 'pfeats' }, PREMIUM_FEATS.map(([k, ic, t, d]) => h('div', { class: 'pfeat' + (k === what ? ' hi' : '') }, h('span', { class: 'pic' }, icon(ic)), h('span', {}, h('b', {}, t), h('small', {}, d)))));
    const buy = h('button', { class: 'btn primary big', disabled: st.ready ? null : true, onclick: () => { try { AndroidBilling.buy(); } catch { toast('Achat impossible pour l’instant'); } } },
      st.pending ? 'Paiement en attente…' : st.price ? `Débloquer Premium · ${st.price}` : 'Prix en cours de chargement…');
    this.close = sheet('Bibliothèque Premium', h('div', { class: 'premium' },
      h('p', {}, 'Lire, écouter et ranger tes livres reste gratuit, sans publicité. Premium ajoute :'), feats,
      h('div', { class: 'pbuy' }, buy, h('small', {}, 'Paiement unique par Google Play, valable pour toujours sur tes appareils Android avec le même compte Google.')),
      h('button', { class: 'btn small', onclick: () => { try { AndroidBilling.restore(); toast('Vérification de tes achats…'); } catch {} } }, 'J’ai déjà payé : restaurer mon achat')));
    if (window.AndroidBilling && !st.ready) try { AndroidBilling.restore(); } catch {}
  },
};
window.__premium = (j) => {
  let x; try { x = JSON.parse(j); } catch { return; }
  const was = Premium.ok(); Premium.st = { ...Premium.st, ...x };
  if (!was && Premium.ok()) { Premium.close?.(); Premium.close = null; toast('Merci ! Bibliothèque Premium est activée'); if (!$('.reader')) renderLibrary(); return; }
  if (x.event === 'pending') toast('Paiement en attente : Premium s’activera dès qu’il sera confirmé');
  if (x.event === 'error') toast('Le paiement n’a pas abouti');
  if (Premium.close && $('.premium')) { Premium.close(); Premium.close = null; if (!Premium.ok()) Premium.offer(); } // prix ou état mis à jour
};
// ================= Menu « Ajouter » =================
// Deux grands choix évidents (un livre, un dossier), puis les autres façons ; les catalogues viennent après
function openAddMenu() {
  const lib = curLib();
  const big = (ic, title, sub, fn) => h('button', { class: 'addbig', onclick: () => { close(); fn(); } }, h('span', { class: 'addic' }, icon(ic)), h('span', { class: 'addtx' }, h('b', {}, title), h('small', {}, sub)));
  const small = (ic, title, fn) => h('button', { class: 'addsmall', onclick: () => { close(); fn(); } }, icon(ic), h('span', {}, title));
  const f = lib ? folderOf(lib.id) : null;
  const close = sheet('Ajouter', h('div', {},
    h('div', { class: 'addgrid' },
      big('file', 'Un livre', 'Choisis un ou plusieurs fichiers sur le téléphone : PDF, EPUB, Kindle, Word, texte…', pickFiles),
      big('folder', 'Un dossier entier', f ? `Tous les livres d'un autre dossier, dans une nouvelle bibliothèque. Celle-ci suit déjà « ${f.name} ».` : 'Tous les livres d\'un dossier, d\'un coup. Les nouveaux s\'ajouteront quand tu actualises.', () => (lib && !f ? chooseFolder(lib.id, { adopt: true }) : addFolderLib()))),
    h('div', { class: 'addrow' },
      window.AndroidWeb ? small('link', 'Depuis un lien', addFromLink) : null,
      small('paste', 'Coller un texte', pasteText)),
    window.AndroidWeb ? h('button', { class: 'addfind', onclick: () => { close(); openCatalogues(); } },
      icon('globe'), h('span', {}, h('b', {}, 'Trouver des livres'), h('small', {}, 'Des milliers de livres gratuits en français')), chevR()) : null,
    lib ? h('p', { class: 'hint', style: { marginTop: '14px' } }, `Ils iront dans « ${lib.name} ».`) : null));
}

function addFromLink() {
  const inp = h('input', { type: 'url', placeholder: 'https://…', autocomplete: 'off' });
  const go = () => { const u = inp.value.trim(); if (!/^https?:\/\/\S+/i.test(u)) return toast('Colle une adresse qui commence par https://'); close();
    if (/gofile\.io\/d\//i.test(u)) { AndroidWeb.open(u, 'Bibliothèque partagée'); toast('Touche « Download » : la bibliothèque s\'ajoute toute seule'); return; } // lien de partage d'une bibliothèque
    AndroidWeb.fetch(u); };
  const close = sheet('Ajouter depuis un lien', h('div', {},
    h('p', { class: 'muted' }, 'Le lien d\'un livre (PDF, EPUB…) ou d\'un article : l\'article devient un livre que tu peux lire ou écouter.'),
    h('label', { class: 'field' }, 'Adresse', inp),
    h('div', { class: 'actions', style: { justifyContent: 'flex-end', marginTop: '14px' } },
      navigator.clipboard?.readText ? h('button', { class: 'btn', onclick: async () => { try { inp.value = (await navigator.clipboard.readText()).trim(); } catch { toast('Colle l\'adresse dans la case'); } } }, icon('paste'), 'Coller') : null,
      h('button', { class: 'btn primary', onclick: go }, icon('plus'), 'Ajouter'))));
  inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  setTimeout(() => inp.focus(), 250);
}
function pasteText() {
  const title = h('input', { placeholder: 'Titre', maxlength: 120 });
  const area = h('textarea', { rows: 10, placeholder: 'Colle ou écris ton texte ici…', style: { width: '100%', resize: 'vertical' } });
  const close = sheet('Coller un texte', h('div', {},
    h('label', { class: 'field' }, 'Titre', title), area,
    h('div', { class: 'actions', style: { justifyContent: 'flex-end', marginTop: '14px' } },
      h('button', { class: 'btn primary', onclick: () => {
        const t = area.value.trim(); if (t.length < 2) return toast('Le texte est vide');
        const name = safeName(title.value.trim() || t.split('\n')[0].slice(0, 60)) + '.txt';
        close(); uploadFiles([new File([t], name, { type: 'text/plain' })]);
      } }, icon('plus'), 'Ajouter à l\'étagère'))));
}
// ================= Trouver des livres =================
// Les livres sont montrés DANS l'application (catalogues publics lisibles par une app) : couverture, titre, bouton « Ajouter ».
// Seulement des livres gratuits du domaine public (Projet Gutenberg, Wikisource) : aucun site où se perdre.
const WebQ = { n: 0, cb: {} };
window.__webGot = (j) => { let r; try { r = JSON.parse(j); } catch { return; } const f = WebQ.cb[r.id]; delete WebQ.cb[r.id]; if (f) f(r); };
function webCall(kind, url, ms = 25000) {
  return new Promise((res) => { const id = 'g' + (++WebQ.n); WebQ.cb[id] = res; try { AndroidWeb[kind](url, id); } catch { delete WebQ.cb[id]; res({ error: 'x' }); } setTimeout(() => { if (WebQ.cb[id]) { delete WebQ.cb[id]; res({ error: 'délai' }); } }, ms); });
}
async function webGet(url) {
  if (window.AndroidWeb?.get) { const r = await webCall('get', url); if (r.error || !r.status || r.status >= 400) throw new Error('Pas de connexion'); return r.body; }
  const r = await fetch(url); if (!r.ok) throw new Error('Pas de connexion'); return r.text();
}
// Classiques québécois libres de droits : un toucher et le livre arrive (Gutenberg, sinon Wikisource en EPUB)
const QC_CLASSICS = [
  ['Maria Chapdelaine', 'Louis Hémon', '#3b5d3a'], ['Les Anciens Canadiens', 'Philippe Aubert de Gaspé', '#7a2e2e'], ['Poésies complètes', 'Émile Nelligan', '#2c3e66'],
  ['La Chasse-galerie', 'Honoré Beaugrand', '#5b3a6b'], ['Angéline de Montbrun', 'Laure Conan', '#6b2d4f'], ['La Scouine', 'Albert Laberge', '#7d4b2a'],
  ['Jean Rivard, le défricheur', 'Antoine Gérin-Lajoie', '#355c55'], ['La Terre paternelle', 'Patrice Lacombe', '#8a5a1c'], ['Charles Guérin', 'Pierre-Joseph-Olivier Chauveau', '#1f4e5f'],
  ['Contes vrais', 'Pamphile Le May', '#3d3d5c'], ['Chez nos gens', 'Adjutor Rivard', '#5d6233'], ['Les Rapaillages', 'Lionel Groulx', '#7a2f22'],
];
const gutEpub = (r) => r.formats?.['application/epub+zip'] || Object.entries(r.formats || {}).find(([k]) => k.includes('epub'))?.[1];
const gutAuthor = (r) => (r.authors || []).map((a) => a.name.split(', ').reverse().join(' ')).join(', ');
const wsExport = (title) => 'https://ws-export.wmcloud.org/?format=epub&lang=fr&page=' + encodeURIComponent(title.replace(/ /g, '_'));
function grabBook(url, title) { toast(`Téléchargement de « ${title} »…`); AndroidWeb.fetch(url); }
// Trouve l'adresse du livre (Gutenberg, sinon Wikisource) ; gardée une semaine
async function resolveClassic(t, a) {
  const cache = store.get('qcUrls', {}) || {}; const c = cache[t];
  if (c && Date.now() - c.t < 6048e5) return c.url;
  let url = null;
  const last = a.split(' ').pop();
  try {
    const j = JSON.parse(await webGet('https://gutendex.com/books/?languages=fr&search=' + encodeURIComponent(t + ' ' + last)));
    const r = (j.results || []).find((x) => fold(x.title).includes(fold(t).split(',')[0]) && gutEpub(x)); if (r) url = gutEpub(r);
  } catch { return null; }
  if (!url) try {
    const j = JSON.parse(await webGet('https://fr.wikisource.org/w/api.php?action=query&list=search&format=json&srlimit=8&srnamespace=0&srsearch=' + encodeURIComponent(t + ' ' + last)));
    const hits = j.query?.search || [];
    const hit = hits.find((x) => fold(x.title).startsWith(fold(t).split(',')[0]) && !x.title.includes('/')) || hits.find((x) => fold(x.title).startsWith(fold(t).split(',')[0]));
    if (hit) url = wsExport(hit.title.split('/')[0]);
  } catch { return null; }
  cache[t] = { url: url || '', t: Date.now() }; store.set('qcUrls', cache);
  return url || '';
}
async function getClassic(t, a) {
  const url = await resolveClassic(t, a);
  if (url) return grabBook(url, t);
  toast('Pas de connexion Internet pour l\'instant.');
}
function bookCard({ title, author, cover, onAdd, color }) {
  const have = S.books.some((b) => !b.trashed && fold(b.title).startsWith(fold(title).slice(0, 24)));
  const cv = h('div', { class: 'cover', style: { '--c': color || '#5b3a2a' } });
  if (cover) { const img = h('img', { src: cover, alt: '', loading: 'lazy' }); img.onerror = () => img.replaceWith(genCover({ title, author })); cv.append(img); } else cv.append(genCover({ title, author }));
  const btn = h('button', { class: 'btn' + (have ? '' : ' primary'), onclick: (e) => { e.currentTarget.disabled = true; e.currentTarget.replaceChildren(icon('download'), 'Ajout…'); onAdd(); } }, icon(have ? 'checks' : 'plus'), have ? 'Déjà là' : 'Ajouter');
  return h('div', { class: 'fbook' }, cv, h('b', {}, title), h('small', {}, author || ''), btn);
}
function openCatalogues() {
  const q = h('input', { type: 'search', placeholder: 'Titre ou auteur (ex. : Jules Verne)', enterkeyhint: 'search' });
  const results = h('div', { class: 'fgrid' }), resHead = h('h3', { class: 'vh', hidden: true }, 'Résultats');
  const popular = h('div', { class: 'fgrid' }, h('p', { class: 'muted' }, 'Chargement des livres…'));
  const CATS = [['Populaires', ''], ['Romans', 'fiction'], ['Aventure', 'adventure'], ['Poésie', 'poetry'], ['Contes', 'tales'], ['Théâtre', 'drama'], ['Histoire', 'history'], ['Philosophie', 'philosophy'], ['Sciences', 'science']];
  const catBar = h('div', { class: 'fcats' }, CATS.map(([n, topic], i) => h('button', { class: 'fcat' + (i ? '' : ' sel'), onclick: (e) => {
    $$('.fcat', catBar).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel');
    popular.replaceChildren(h('p', { class: 'muted' }, 'Chargement des livres…')); more.hidden = true;
    loadGut('https://gutendex.com/books/?languages=fr' + (topic ? '&topic=' + topic : ''), popular, false);
  } }, n)));
  let next = null;
  const more = h('button', { class: 'btn', hidden: true, onclick: () => loadGut(next, popular, true) }, 'Voir plus de livres');
  async function loadGut(url, into, append) {
    try {
      const j = JSON.parse(await webGet(url)); next = j.next || null;
      const cards = (j.results || []).filter(gutEpub).map((r) => bookCard({ title: r.title.split(/[:;]/)[0].trim(), author: gutAuthor(r), cover: r.formats['image/jpeg'], onAdd: () => grabBook(gutEpub(r), r.title) }));
      if (append) into.append(...cards); else into.replaceChildren(...(cards.length ? cards : [h('p', { class: 'muted' }, 'Aucun livre trouvé.')]));
      if (into === popular) more.hidden = !next;
    } catch { into.replaceChildren(h('p', { class: 'muted' }, 'Pas de connexion Internet. Réessaie dans un moment.')); }
  }
  async function search() {
    const t = q.value.trim(); if (!t) return; resHead.hidden = false;
    results.replaceChildren(h('p', { class: 'muted' }, 'Recherche…'));
    await loadGut('https://gutendex.com/books/?languages=fr&search=' + encodeURIComponent(t), results, false);
    try { // aussi sur Wikisource (œuvres entières seulement)
      const j = JSON.parse(await webGet('https://fr.wikisource.org/w/api.php?action=query&list=search&format=json&srlimit=12&srnamespace=0&srsearch=' + encodeURIComponent(t)));
      const seen = new Set(); const ws = (j.query?.search || []).map((x) => x.title.split('/')[0]).filter((x) => !seen.has(x) && seen.add(x)).slice(0, 8);
      if (ws.length) { if ($('.muted', results)) results.replaceChildren(); results.append(...ws.map((title) => bookCard({ title, author: 'Wikisource', onAdd: () => grabBook(wsExport(title), title) }))); }
    } catch {}
    resHead.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  q.onkeydown = (e) => { if (e.key === 'Enter') search(); };
  // classiques québécois : on ne garde que ceux qu'on peut vraiment télécharger
  const qcRow = h('div', { class: 'qcrow' });
  QC_CLASSICS.forEach(([t, a, c]) => {
    const item = h('div', { class: 'qcitem pending' }, bookCard({ title: t, author: a, color: c, onAdd: () => getClassic(t, a) }));
    qcRow.append(item);
    resolveClassic(t, a).then((u) => { if (u === '') item.remove(); else if (u) item.classList.remove('pending'); });
  });
  const close = sheet('Trouver des livres', h('div', {},
    h('div', { class: 'fsearch' }, q, h('button', { class: 'btn primary', onclick: search }, 'Chercher')),
    resHead, results,
    h('section', { class: 'qcbox' },
      h('div', { class: 'qchead' }, h('span', { class: 'qcflag', 'aria-hidden': 'true' }), h('div', {}, h('b', {}, 'Lire québécois'), h('small', {}, 'Les grands classiques d\'ici : touche « Ajouter »'))),
      qcRow),
    h('h3', { class: 'vh', style: { marginTop: '18px' } }, 'Livres gratuits en français'),
    catBar, popular, h('div', { class: 'actions', style: { justifyContent: 'center', marginTop: '10px' } }, more),
    h('p', { class: 'hint', style: { marginTop: '16px' } }, 'Des livres du domaine public, gratuits et légaux (Projet Gutenberg et Wikisource). Ils arrivent dans « Livres du web ».')), { wide: true });
  loadGut('https://gutendex.com/books/?languages=fr', popular, false);
}
window.__webBookStart = (name) => toast(`Téléchargement de « ${String(name || 'livre').replace(/\.[^.]+$/, '')} »…`);
window.__webBook = async (j) => {
  let r = null; try { r = JSON.parse(j); } catch {}
  if (!r || r.error) return toast(r?.error || 'Téléchargement impossible');
  try {
    const resp = await fetch('/__web?f=' + encodeURIComponent(r.file));
    if (!resp.ok) throw new Error('Fichier illisible');
    const lib = webLib();
    const [meta] = await uploadFiles([new File([await resp.blob()], r.name, { lastModified: Date.now() })], { lib: lib.id });
    if (S.lib !== lib.id) switchLib(lib.id);
    const b = meta && S.books.find((x) => x.id === meta.id);
    if (b) {
      const close = sheet('Livre ajouté', h('div', {},
        h('div', { class: 'gotbook' }, coverEl(b), h('div', {}, h('b', {}, b.title), b.author ? h('small', {}, b.author) : null, h('small', { class: 'muted' }, 'Laisse-le dans « Livres du web » ou range-le ailleurs :'))),
        h('div', { style: { marginTop: '12px' } }, libChips([b], (l) => { if (S.lib !== l.id) switchLib(l.id); })),
        h('div', { class: 'actions', style: { justifyContent: 'flex-end', marginTop: '16px' } },
          h('button', { class: 'btn', onclick: () => { close(); openCatalogues(); } }, icon('globe'), 'Trouver d\'autres livres'),
          h('button', { class: 'btn primary', onclick: () => { close(); openBook(b, null); } }, icon('book'), 'Lire maintenant'))));
    }
  } catch (e) { toast(e.message); }
  finally { try { AndroidWeb.done(r.file); } catch {} }
};

// ================= Bibliothèques et dossiers sources =================
// Chaque bibliothèque a son nom, son décor et (si on veut) son dossier source. « Toutes » les montre ensemble.
const DECORS = [['noyer', 'Noyer'], ['chene', 'Chêne clair'], ['acajou', 'Acajou'], ['ebene', 'Ébène'], ['ardoise', 'Ardoise'], ['olivier', 'Olivier'], ['bouleau', 'Bouleau']];
const DECOR_SWATCH = { noyer: '#6d4427', chene: '#cfa977', acajou: '#7a2f22', ebene: '#2a2a30', ardoise: '#3e5566', olivier: '#5d6233', bouleau: '#d9d4c7' };
const FOLDER = { busy: false };
const hasNativeFolder = () => !!window.AndroidFolder;
function libsRaw() {
  let l = store.get('libs', null);
  if (!l || !l.length) {
    let name = 'Ma Bibliothèque'; try { name = localStorage.getItem('bib.libname') || name; } catch {}
    l = [{ id: 'main', name, decor: store.get('decor', 'noyer') }]; store.set('libs', l);
  }
  return l;
}
// Seulement les bibliothèques visibles : une bibliothèque supprimée n'apparaît plus nulle part
function libs() {
  const r = libsRaw(); const v = r.filter((x) => !x.gone);
  if (v.length) return v;
  const m = r.find((x) => x.id === 'main') || r[0]; delete m.gone; store.set('libs', r); return [m];
}
const saveLibs = (l) => store.set('libs', l.concat(libsRaw().filter((x) => x.gone && !l.some((y) => y.id === x.id))));
const firstLibId = () => libs()[0].id;
S.lib = store.get('lib', 'main');
const curLib = () => (S.lib === 'all' ? null : libs().find((x) => x.id === S.lib) || libs()[0]);
const libName = () => (curLib() ? curLib().name : 'Toutes les bibliothèques');
const inLib = (b) => S.lib === 'all' || (b.lib || 'main') === curLib().id;
function applyDecor() { document.documentElement.dataset.decor = curLib() ? curLib().decor : store.get('decorAll', 'ebene'); }
applyDecor();
function switchLib(id) { S.lib = id; store.set('lib', id); applyDecor(); S.nav = { k: 'all' }; store.set('nav', S.nav); S.filter = ''; renderLibrary(); scrollTo(0, 0); }

// Dossiers : Android garde l'autorisation ; dans un navigateur on retient seulement le nom
function folderMap() {
  if (hasNativeFolder()) {
    try { const m = {}; for (const f of JSON.parse(AndroidFolder.list() || '[]')) m[f.id] = f; return m; } catch { return {}; }
  }
  const m = store.get('folders', null) || {};
  const old = store.get('folder', null); if (old && !m.main) { m.main = old; store.set('folders', m); store.set('folder', null); }
  return m;
}
const folderOf = (id) => folderMap()[id] || null;
function folderInfo() { return S.lib === 'all' ? null : folderOf(curLib().id); }
const libsWithFolder = () => { const m = folderMap(); return libs().filter((l) => m[l.id]); };
function nativeCall(cb, start) {
  return new Promise((res) => { window[cb] = (j) => { window[cb] = null; try { res(j ? JSON.parse(j) : null); } catch { res(null); } }; start(); });
}
function pickWebFolder() {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', multiple: true, webkitdirectory: true });
    inp.style.display = 'none'; document.body.append(inp);
    inp.onchange = () => { const files = [...inp.files]; inp.remove(); res(files); };
    inp.click();
  });
}
const BOOK_EXT = /\.(pdf|epub|mobi|azw3?|prc|docx?|odt|rtf|fb2|fbz|cbz|html?|xhtml|txt|md|markdown|text|mp3|m4b|m4a|aac|ogg|oga|opus|flac|wav)$|\.fb2\.zip$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const AUDIO_EXT = /\.(mp3|m4b|m4a|aac|ogg|oga|opus|flac|wav)$/i;
function nameLibAfter(libId, folderName, force) {
  const l = libs(); const lib = l.find((x) => x.id === libId); if (!lib || !folderName) return;
  if (force || lib.name === 'Ma Bibliothèque' || lib.name === 'Nouvelle bibliothèque') { lib.name = folderName.slice(0, 60); saveLibs(l); if (lib.id === 'main') { try { localStorage.setItem('bib.libname', lib.name); } catch {} } }
}
async function chooseFolder(libId, { adopt, rename } = {}) {
  const old = folderOf(libId)?.name; // si la bibliothèque portait le nom de l'ancien dossier, elle prend celui du nouveau
  if (old && libs().find((x) => x.id === libId)?.name === old) rename = true;
  if (hasNativeFolder()) {
    const r = await nativeCall('__folderPicked', () => AndroidFolder.pick(libId));
    if (!r) return false;
    nameLibAfter(libId, r.name, rename); renderLibrary(); toast(`Dossier « ${r.name} » choisi`);
    await scanFolder(libId, null, { adopt }); return true;
  }
  const files = await pickWebFolder(); if (!files.length) return false;
  const name = (files[0].webkitRelativePath || '').split('/')[0] || 'Dossier';
  const m = folderMap(); m[libId] = { name }; store.set('folders', m); nameLibAfter(libId, name, rename); renderLibrary();
  await scanFolder(libId, files, { adopt }); return true;
}
// Ajouter un autre dossier = une nouvelle bibliothèque, à son nom ; les autres bibliothèques ne bougent pas
async function addFolderLib() {
  const l = libs(); const used = new Set(l.map((x) => x.decor));
  const order = ['acajou', 'ardoise', 'olivier', 'ebene', 'chene', 'bouleau', 'noyer'];
  const decor = order.find((k) => !used.has(k)) || order[l.length % order.length];
  const lib = { id: 'lib' + Date.now().toString(36), name: 'Nouvelle bibliothèque', decor };
  l.push(lib); saveLibs(l);
  const prev = S.lib;
  const ok = await chooseFolder(lib.id, { adopt: true, rename: true }).catch(() => false);
  if (!ok) { saveLibs(libs().filter((x) => x.id !== lib.id)); switchLib(prev); return; }
  switchLib(lib.id);
}
// Actualiser : la bibliothèque affichée, ou toutes celles qui ont un dossier
// Recherche automatique : à l'ouverture de l'application et quand on y revient, chaque dossier est vérifié
// sans rien afficher ; seuls les nouveaux livres sont ajoutés (avec leur barre d'avancement)
const AutoScan = {
  on: () => store.get('autoScan', true),
  last: 0,
  async run(force) {
    if (!this.on() || !hasNativeFolder() || S.me?.role !== 'owner' || FOLDER.busy || window.__reader) return;
    if (!force && Date.now() - this.last < 3 * 60e3) return; // pas plus d'une fois toutes les 3 minutes
    const list = libsWithFolder(); if (!list.length) return;
    this.last = Date.now();
    let total = 0;
    for (const l of list) total += (await scanFolder(l.id, null, { quiet: true, silent: true })) || 0;
    if (total) toast(`${total} nouveau${total > 1 ? 'x' : ''} livre${total > 1 ? 's' : ''} ajouté${total > 1 ? 's' : ''} depuis tes dossiers`);
  },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => AutoScan.run(), 1200); });
async function refreshFolders() {
  if (S.lib !== 'all') return scanFolder(curLib().id);
  const list = libsWithFolder(); if (!list.length) return toast('Aucune bibliothèque n\'a de dossier source');
  if (!hasNativeFolder()) return toast('Dans un navigateur, actualise chaque bibliothèque séparément');
  let total = 0;
  for (const l of list) total += (await scanFolder(l.id, null, { quiet: true })) || 0;
  toast(total ? `${total} nouveau${total > 1 ? 'x' : ''} livre${total > 1 ? 's' : ''} ajouté${total > 1 ? 's' : ''}` : 'Aucun nouveau livre dans les dossiers');
}
// Les recherches passent une à la fois (une seule réponse d'Android à la fois)
FOLDER.queue = Promise.resolve();
function scanFolder(libId, webFiles, opts) {
  const run = FOLDER.queue.then(() => scanOne(libId, webFiles, opts || {}));
  FOLDER.queue = run.catch(() => 0);
  return run;
}
async function scanOne(libId, webFiles, { quiet, adopt, silent } = {}) {
  const lib = libs().find((l) => l.id === libId); if (!lib) return 0;
  let entries, touched = !silent;
  // vérification discrète : on ne redessine pas l'étagère (ça faisait sauter le défilement), seul le bouton tourne
  FOLDER.busy = true; if (silent) $('.btn.refresh')?.classList.add('spin'); else renderLibrary();
  try {
    if (hasNativeFolder()) {
      const box = silent ? h('i') : h('div', { class: 'up' }, h('b', {}, `${lib.name} · ${folderOf(libId)?.name || 'Dossier'}`), h('span', { class: 'muted' }, 'Recherche de nouveaux livres…'), h('div', { class: 'bar' }, h('i', { class: 'indet' }))); $('#uploads')?.append(box);
      const r = await nativeCall('__folderScanned', () => AndroidFolder.scan(libId));
      box.remove();
      if (!r || r.error) { if (!silent) toast(`${lib.name} : ${r?.error || 'lecture du dossier impossible'}`); return 0; }
      entries = r.files.map((f) => ({ src: 'saf:' + f.id, name: f.name, path: f.path, size: f.size, mtime: f.mtime || 0, get: async () => {
        const resp = await fetch('/__dossier?lib=' + encodeURIComponent(libId) + '&id=' + encodeURIComponent(f.id));
        if (!resp.ok) throw new Error('Fichier illisible');
        return new File([await resp.blob()], f.name, { lastModified: f.mtime || Date.now() });
      } }));
    } else {
      if (!webFiles) { webFiles = await pickWebFolder(); if (!webFiles.length) return 0; }
      entries = webFiles.filter((f) => BOOK_EXT.test(f.name) && !f.name.startsWith('.')).map((f) => ({ src: 'web:' + (f.webkitRelativePath || f.name), name: f.name, path: f.webkitRelativePath || f.name, size: f.size, mtime: f.lastModified || 0, get: async () => f }));
    }
    let moved = 0;
    if (adopt) {
      const bySrc = new Map(S.books.filter((b) => b.src && b.lib !== libId).map((b) => [b.src, b]));
      for (const e of entries) { const b = bySrc.get(e.src); if (b) { await post('/api/books/' + b.id, { lib: libId }, 'PATCH'); moved++; } }
      if (moved) { await loadBooks(); touched = true; }
    }
    const k = await LocalAPI.known(libId);
    // nouveaux livres, et nouvelles versions de livres déjà là (même nom, fichier modifié depuis)
    const st = new Map(entries.map((e) => [e, k.status ? k.status(e) : { k: k.has(e) ? 'same' : 'new' }]));
    for (const [e, x] of st) if (x.stamp) await LocalAPI.stamp(x.stamp, e.mtime);
    const changed = entries.filter((e) => st.get(e).k === 'changed');
    let fresh = entries.filter((e) => st.get(e).k === 'new').sort((a, b) => a.path.localeCompare(b.path, 'fr'));
    let updated = 0;
    for (const e of changed) {
      const old = st.get(e).old;
      if (AUDIO_EXT.test(e.name)) { await LocalAPI.stamp(old.id, e.mtime); continue; }
      const box = h('div', { class: 'up' }, h('b', {}, e.name), h('span', { class: 'muted' }, 'Nouvelle version : mise à jour…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
      $('#uploads')?.append(box);
      try {
        const m = await LocalAPI.upload(await e.get(), (pct) => { $('i', box).style.width = pct + '%'; }, { src: e.src, lib: libId, fmtime: e.mtime });
        await LocalAPI.replaceBook(old.id, m.id); updated++; touched = true;
      } catch (err) { await LocalAPI.stamp(old.id, e.mtime); } // version illisible : on garde l'ancienne
      box.remove(); await new Promise((r) => setTimeout(r, 60)); // laisse respirer l'application
    }
    for (const e of fresh) if (st.get(e).unignore) LocalAPI.unignore(e.src);
    { // les pistes audio d'un même dossier forment un seul livre
      const byDir = new Map(), rest = [];
      for (const e of fresh) { if (AUDIO_EXT.test(e.name) && !/\.m4b$/i.test(e.name)) { const d = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : ''; if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(e); } else rest.push(e); }
      for (const [d, list] of byDir) {
        if (list.length < 2) { rest.push(...list); continue; }
        rest.push({ src: list[0].src, name: (d.split('/').pop() || 'Livre audio') + ' (' + list.length + ' pistes)', path: list[0].path, size: list.reduce((a, x) => a + (x.size || 0), 0), group: list });
      }
      fresh = rest.sort((a, b) => a.path.localeCompare(b.path, 'fr'));
    }
    const last = store.get('folderLast', {}); store.set('folderLast', { ...(typeof last === 'object' ? last : {}), [libId]: Date.now() });
    if (updated) toast(`${updated} livre${updated > 1 ? 's' : ''} mis à jour (nouvelle version du fichier)`);
    if (!fresh.length) { if (!quiet && !updated) toast(moved ? `${moved} livre${moved > 1 ? 's' : ''} retrouvé${moved > 1 ? 's' : ''} et rangé${moved > 1 ? 's' : ''} ici` : entries.length ? 'Aucun nouveau livre dans le dossier' : 'Aucun livre trouvé dans ce dossier'); return 0; }
    let ok = 0, fail = 0;
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i];
      const box = h('div', { class: 'up' }, h('b', {}, e.name), h('span', { class: 'muted' }, `${lib.name} : livre ${i + 1} sur ${fresh.length}`), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
      $('#uploads')?.append(box);
      try {
        if (e.group) {
          const files = []; for (const x of e.group) files.push(await x.get());
          await LocalAPI.uploadAudio(files, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = `${i + 1}/${fresh.length} · ${msg}`; }, { src: e.src, srcs: e.group.map((x) => x.src), lib: libId });
          box.remove(); ok++; touched = true; continue;
        }
        const file = await e.get();
        await LocalAPI.upload(file, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = `${i + 1}/${fresh.length} · ${msg}`; }, { src: e.src, lib: libId, fmtime: e.mtime || 0 });
        box.remove(); ok++; touched = true;
        await new Promise((r) => setTimeout(r, 60)); // un livre à la fois, l'application reste fluide
        if (ok % 5 === 0) { await loadBooks(); renderLibrary(); } // l'étagère se remplit pendant l'import
      } catch (err) { fail++; $('span', box).textContent = err.message; $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000); }
    }
    if (!quiet) toast(`${ok} nouveau${ok > 1 ? 'x' : ''} livre${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (fail ? ` · ${fail} refusé${fail > 1 ? 's' : ''}` : ''));
    return ok + updated;
  } finally {
    FOLDER.busy = false;
    if (touched) { await loadBooks(); renderLibrary(); thumbsSoon(); } else $('.btn.refresh')?.classList.remove('spin');
  }
}
function openFolder(libId = curLib()?.id) {
  if (!libId) return openLibraries();
  const lib = libs().find((l) => l.id === libId);
  const f = folderOf(libId); const last = (store.get('folderLast', {}) || {})[libId] || 0;
  let ignored = []; try { ignored = JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]').filter((x) => typeof x === 'string' || !x.lib || x.lib === libId); } catch {}
  const close = sheet('Dossiers sources', h('div', {},
    f ? h('div', { class: 'srcbox' },
      h('div', { class: 'srcname' }, icon('folder'), h('span', {}, h('b', {}, f.name), h('small', {}, `Bibliothèque « ${lib.name} » · dernière recherche : ${last ? lastRead(last) : 'jamais'}`))),
      h('button', { class: 'btn primary', onclick: () => { close(); scanFolder(libId); } }, icon('refresh'), 'Actualiser'))
      : h('p', { class: 'muted' }, `La bibliothèque « ${lib.name} » n'a pas encore de dossier. Choisis-en un : ses livres (PDF, EPUB, Kindle, Word, texte…) y seront ajoutés, et « Actualiser » ira chercher les nouveaux.`),
    !f ? h('div', { class: 'actions', style: { marginBottom: '6px' } }, h('button', { class: 'btn primary', onclick: () => { close(); chooseFolder(libId); } }, icon('folder'), 'Choisir un dossier')) : null,
    f ? h('div', { class: 'addsrc' },
      h('p', {}, 'Un autre dossier devient une autre bibliothèque. Celle-ci reste telle quelle et tu passes de l\'une à l\'autre avec les onglets en haut.'),
      h('button', { class: 'btn primary', onclick: () => { close(); addFolderLib(); } }, icon('plus'), 'Ajouter un autre dossier')) : null,
    ignored.length ? h('details', { class: 'more ignored' }, h('summary', {}, `${ignored.length} livre${ignored.length > 1 ? 's' : ''} retiré${ignored.length > 1 ? 's' : ''} : ne revien${ignored.length > 1 ? 'nent' : 't'} pas`),
      ignored.map((x) => { const o = typeof x === 'string' ? { src: x } : x; const nm = o.name || decodeURIComponent(String(o.src).split('/').pop() || o.src); return h('div', { class: 'ignrow' }, h('span', {}, nm),
        h('button', { class: 'btn', onclick: () => { LocalAPI.unignore(o.src); close(); toast(`« ${nm} » reviendra`); scanFolder(libId); } }, 'Réimporter')); })) : null,
    false ? h('p', { class: 'hint' }, `${ignored.length} livre${ignored.length > 1 ? 's' : ''} retiré${ignored.length > 1 ? 's' : ''} ne ser${ignored.length > 1 ? 'ont' : 'a'} pas réimporté${ignored.length > 1 ? 's' : ''}. `,
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); try { localStorage.removeItem('bib.folderIgnored'); } catch {} close(); toast('Ils reviendront à la prochaine actualisation'); } }, 'Les réimporter')) : null,
    !hasNativeFolder() && f ? h('p', { class: 'hint' }, 'Dans un navigateur, il faut rechoisir le dossier à chaque actualisation.') : null,
    f && hasNativeFolder() ? h('label', { class: 'check autoscan' }, h('input', { type: 'checkbox', checked: AutoScan.on(), onchange: (e) => { store.set('autoScan', e.target.checked); toast(e.target.checked ? 'Les nouveaux livres seront ajoutés automatiquement' : 'Recherche automatique arrêtée : utilise 🔄'); } }),
      h('span', {}, h('b', {}, 'Ajouter automatiquement les nouveaux livres'), h('small', {}, 'Vérifié à l\'ouverture de l\'application et quand tu y reviens.'))) : null,
    f ? h('div', { class: 'actions', style: { marginTop: '16px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: () => { close(); removeFolder(libId); } }, icon('trash'), 'Supprimer ce dossier'),
      h('button', { class: 'btn', onclick: () => { if (!confirm(`Remplacer le dossier de « ${lib.name} » ? Les livres déjà là restent, et les nouveaux viendront du dossier choisi.`)) return; close(); chooseFolder(libId); } }, 'Remplacer')) : null));
}
// ---- Menu d'un onglet : actualiser, modifier, supprimer ----
function tabMenu(id) {
  const lib = libs().find((x) => x.id === id); if (!lib) return;
  const f = folderOf(id);
  const n = S.books.filter((b) => !b.trashed && (b.lib || 'main') === id).length;
  const canDelete = true;
  const item = (ic, label, sub, fn, danger) => h('button', { class: 'addbig' + (danger ? ' danger' : ''), onclick: () => { close(); fn(); } },
    h('span', { class: 'addic' }, icon(ic)), h('span', { class: 'addtx' }, h('b', {}, label), sub ? h('small', {}, sub) : null));
  const close = sheet(lib.name, h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, `${n} livre${n > 1 ? 's' : ''}${f ? ' · dossier « ' + f.name + ' »' : ''}`),
    h('div', { class: 'sharechoices' },
      f ? item('refresh', 'Actualiser', 'Chercher les nouveaux livres du dossier', () => { if (S.lib !== id) switchLib(id); scanFolder(id); }) : null,
      item('pencil', 'Modifier', 'Nom, décor, dossier', () => editLib(id)),
      canDelete ? item('trash', 'Supprimer', 'La bibliothèque, son dossier et ses livres', () => removeFolder(id), true) : null)));
}
// Deuxième fenêtre, contre les accidents
function confirmDelete(title, text, yes, fn) {
  const close = sheet(title, h('div', {},
    h('p', {}, text),
    h('p', { class: 'hint' }, 'Les fichiers sur ton téléphone ne sont pas effacés.'),
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn', onclick: () => close() }, 'Annuler'),
      h('button', { class: 'btn danger solid', onclick: () => { close(); fn(); } }, icon('trash'), yes))));
}
// ---- Supprimer une bibliothèque : son dossier, tous ses livres et son onglet ----
// Les fichiers du téléphone ne sont jamais touchés : seuls les livres de l'application sont retirés.
function forgetFolder(libId) { if (hasNativeFolder()) AndroidFolder.forget(libId); else { const m = folderMap(); delete m[libId]; store.set('folders', m); } }
function removeFolder(libId) {
  const lib = libsRaw().find((l) => l.id === libId); if (!lib) return;
  const f = folderOf(libId);
  const all = S.books.filter((b) => (b.lib || 'main') === libId);
  const n = all.filter((b) => !b.trashed).length; const s = n > 1 ? 's' : '';
  const last = libs().length === 1;
  const close = sheet('Supprimer « ' + lib.name + ' »', h('div', {},
    h('p', { class: 'hint' }, 'Les fichiers restent sur ton téléphone : seule la Bibliothèque les oublie.'),
    h('div', { class: 'sharechoices' },
      h('button', { class: 'addbig danger', onclick: () => { close(); confirmDelete('Êtes-vous sûr ?', `Supprimer la bibliothèque « ${lib.name} »${f ? ', son dossier' : ''}${n ? ` et ses ${n} livre${s}` : ''} ? Elle disparaîtra de l'application.`, 'Oui, supprimer', () => deleteLibrary(libId)); } },
        h('span', { class: 'addic' }, icon('trash')), h('span', { class: 'addtx' }, h('b', {}, 'Supprimer la bibliothèque'),
          h('small', {}, [f ? 'le dossier' : '', n ? `les ${n} livre${s}` : '', last ? '' : 'l\'onglet'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' et $1') + (last ? ' (c\'est ta seule bibliothèque : elle reste, vide)' : '')))),
      f && n ? h('button', { class: 'addbig', onclick: () => { close(); confirmDelete('Êtes-vous sûr ?', `Supprimer le dossier « ${f.name} » ? La bibliothèque et ses ${n} livre${s} restent, sans actualisation.`, 'Oui, supprimer', () => { forgetFolder(libId); renderLibrary(); toast('Dossier supprimé, livres gardés'); }); } },
        h('span', { class: 'addic' }, icon('folder')), h('span', { class: 'addtx' }, h('b', {}, 'Supprimer seulement le dossier'), h('small', {}, `La bibliothèque et ses ${n} livre${s} restent.`))) : null)));
}
async function deleteLibrary(libId) {
  const lib = libsRaw().find((l) => l.id === libId); if (!lib) return;
  const all = S.books.filter((b) => (b.lib || 'main') === libId); // tous : dossier, ajoutés à la main, poubelle
  forgetFolder(libId);
  if (all.length) {
    const box = h('div', { class: 'up' }, h('b', {}, `Suppression de « ${lib.name} »`), h('span', { class: 'muted' }, '…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    const srcs = new Set();
    for (let i = 0; i < all.length; i++) {
      if (all[i].src) srcs.add(all[i].src);
      try { await api('/api/books/' + all[i].id, { method: 'DELETE' }); } catch {}
      $('i', box).style.width = Math.round(((i + 1) / all.length) * 100) + '%'; $('span', box).textContent = `${i + 1} sur ${all.length}`;
    }
    // sinon ces livres seraient refusés si tu rajoutes un jour ce dossier
    try { const ig = JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]').filter((x) => !srcs.has(typeof x === 'string' ? x : x.src)); localStorage.setItem('bib.folderIgnored', JSON.stringify(ig)); } catch {}
    box.remove();
  }
  const raw = libsRaw();
  if (libs().length > 1) {
    if (libId === 'main') raw.find((x) => x.id === 'main').gone = true; // la principale garde sa place, invisible
    store.set('libs', libId === 'main' ? raw : raw.filter((x) => x.id !== libId));
  } else { const x = raw.find((y) => y.id === libId); x.name = 'Ma Bibliothèque'; store.set('libs', raw); } // la dernière reste, vide
  await loadBooks();
  switchLib(S.lib === libId || S.lib === 'all' ? libs()[0].id : S.lib);
  toast(`« ${lib.name} » supprimée`);
}

// ================= Partager une bibliothèque entière =================
// Tous les livres d'une bibliothèque partent dans un seul fichier « .biblio » (avec son nom, son décor et les titres).
// L'autre personne l'ouvre avec la même application : la bibliothèque s'ajoute chez elle, prête à lire.
const fmtSize = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' Go' : n >= 1e6 ? Math.max(1, Math.round(n / 1e6)) + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' ko';
const safeName = (x) => String(x || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Bibliotheque';
function shareLibraryPick() {
  if (S.lib !== 'all') return shareLibrary(S.lib);
  const close = sheet('Partager une bibliothèque', h('div', { class: 'libs' }, libs().map((l) => h('div', { class: 'librow' },
    h('button', { class: 'libpick', onclick: () => { close(); shareLibrary(l.id); } }, h('span', { class: 'libsw', style: { '--sw': DECOR_SWATCH[l.decor] || '#555' } }), h('span', { class: 'libtxt' }, h('b', {}, l.name)))))));
}
function shareLibrary(id) {
  if (!Premium.need('share')) return;
  const lib = libs().find((x) => x.id === id); if (!lib) return;
  const books = S.books.filter((b) => !b.trashed && (b.lib || 'main') === id);
  if (!books.length) return toast('Cette bibliothèque est vide');
  const size = books.reduce((a, b) => a + (b.size || 0), 0);
  const close = sheet('Partager « ' + lib.name + ' »', h('div', {},
    h('p', {}, `${books.length} livre${books.length > 1 ? 's' : ''}${size ? ', environ ' + fmtSize(size) : ''}, réunis dans un seul fichier avec le nom et le décor de la bibliothèque.`),
    size > 400e6 ? h('p', { class: 'hint' }, `Gros envoi (${fmtSize(size)}) : utilise le Wi-Fi.`) : null,
    h('div', { class: 'sharechoices' },
      AndroidShare.upload ? h('button', { class: 'addbig', onclick: () => { close(); packLibrary(lib, books, 'link'); } },
        h('span', { class: 'addic' }, icon('link')), h('span', { class: 'addtx' }, h('b', {}, 'Envoyer un lien'), h('small', {}, 'Tout se fait seul : la bibliothèque est mise en ligne et tu reçois un lien à texter. La personne l\'ouvre sur son téléphone, et tout s\'ajoute.'))) : null,
      h('button', { class: 'addbig', onclick: () => { close(); packLibrary(lib, books, 'file'); } },
        h('span', { class: 'addic' }, icon('share')), h('span', { class: 'addtx' }, h('b', {}, 'Envoyer le fichier'), h('small', {}, 'Quick Share (téléphone à côté), WhatsApp, Drive…'))))));
}
async function packLibrary(lib, books, how = 'file') {
  const box = h('div', { class: 'up' }, h('b', {}, `Partage de « ${lib.name} »`), h('span', { class: 'muted' }, 'Préparation…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
  $('#uploads')?.append(box);
  const say = (pct, msg) => { $('i', box).style.width = pct + '%'; $('span', box).textContent = msg; };
  try {
    const items = [], used = new Set();
    const groups = [];
    for (const b of books) {
      const f = await LocalAPI.fileOf(b.id); if (!f) continue;
      if (f.files) { // livre audio en plusieurs pistes : un dossier dans le paquet
        let dir = safeName(b.title), k2 = 2; while (used.has(dir.toLowerCase() + '/')) dir = safeName(b.title) + ` (${k2++})`; used.add(dir.toLowerCase() + '/');
        for (const x of f.files) items.push({ b, f: { file: x, name: x.name }, path: dir + '/' + safeName(x.name), part: true });
        groups.push({ path: dir + '/', title: b.title, author: b.author || '', group: true });
        continue;
      }
      let path = safeName(f.name); const dot = path.lastIndexOf('.'); let k = 2;
      while (used.has(path.toLowerCase())) path = (dot > 0 ? f.name.slice(0, dot) : f.name) + ` (${k++})` + (dot > 0 ? f.name.slice(dot) : '');
      used.add(path.toLowerCase()); items.push({ b, f, path });
    }
    if (!items.length) throw new Error('Aucun fichier à envoyer');
    const manifest = { format: 1, app: 'Bibliotheque', name: lib.name, decor: lib.decor, date: Date.now(),
      books: items.filter((x) => !x.part).map(({ b, path }) => ({ path, title: b.title, author: b.author || '', state: '', fav: false })).concat(groups) };
    if (!AndroidShare.begin(safeName(lib.name) + '.biblio', JSON.stringify(manifest))) throw new Error('Préparation du fichier impossible');
    const total = items.reduce((a, x) => a + x.f.file.size, 0) || 1; let done = 0;
    const CH = 768 * 1024;
    for (let i = 0; i < items.length; i++) {
      const { f, path } = items[i];
      say(Math.round((done / total) * 100), `Livre ${i + 1} sur ${items.length} · ${path}`);
      if (!AndroidShare.fileBegin(path)) throw new Error('Préparation du fichier impossible');
      for (let o = 0; o < f.file.size; o += CH) {
        if (!AndroidShare.append(await blobToB64(f.file.slice(o, o + CH)))) throw new Error('Espace insuffisant sur le téléphone');
        done += Math.min(CH, f.file.size - o); say(Math.round((done / total) * 100), `Livre ${i + 1} sur ${items.length} · ${path}`);
      }
      AndroidShare.fileEnd();
    }
    if (how === 'link' && AndroidShare.upload) {
      say(0, 'Mise en ligne…');
      const r = await new Promise((res) => { window.__upProgress = (pc) => say(Number(pc), `Mise en ligne · ${Math.floor(Number(pc))} %`); window.__upDone = (j) => { try { res(JSON.parse(j)); } catch { res({ error: 'Envoi impossible' }); } }; AndroidShare.upload(lib.name); });
      window.__upProgress = window.__upDone = null;
      if (r.error || !r.link) throw new Error(r.error || 'Envoi impossible');
      box.remove(); shareLinkSheet(lib.name, r.link);
      return;
    }
    say(100, 'Prêt : choisis comment l\'envoyer');
    if (!AndroidShare.finish(lib.name)) throw new Error('Envoi impossible');
    setTimeout(() => box.remove(), 2500);
  } catch (e) {
    try { AndroidShare.abort(); } catch {}
    say(100, e.message); $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000);
  }
}
function shareLinkSheet(name, link) {
  const msg = `Je te partage ma bibliothèque « ${name} ». Ouvre ce lien sur ton téléphone, télécharge le fichier, puis ouvre-le avec l'application Bibliothèque : ${link}`;
  const close = sheet('Lien prêt', h('div', {},
    h('p', {}, 'Ta bibliothèque est en ligne. Envoie ce lien à la personne :'),
    h('div', { class: 'linkbox' }, link),
    h('p', { class: 'hint' }, 'Le lien reste actif quelques jours. Dans l\'application, la personne peut aussi faire Ajouter › Depuis un lien.'),
    h('div', { class: 'actions', style: { justifyContent: 'flex-end', marginTop: '14px' } },
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Lien copié'); } catch { toast('Copie le lien affiché'); } } }, icon('copy'), 'Copier'),
      h('button', { class: 'btn primary', onclick: () => { close(); AndroidShare.text ? AndroidShare.text(msg) : (navigator.share ? navigator.share({ text: msg }) : null); } }, icon('share'), 'Envoyer le lien'))));
}
// Réception : Android a déjà décompressé le fichier ; on propose d'ajouter la bibliothèque
window.__biblioRecue = () => checkReceived();
function checkReceived() {
  if (!window.AndroidShare || !S.me?.role) return;
  let r = null; try { r = JSON.parse(AndroidShare.takeReceived() || 'null'); } catch {}
  if (!r) return;
  if (r.error) return toast(r.error);
  if (r.book) return openReceivedBook(r.book);
  const m = r.manifest || {}, n = r.files.length;
  if (!n) { AndroidShare.clearReceived(); return toast('Ce partage ne contient aucun livre'); }
  const close = sheet('Bibliothèque reçue', h('div', {},
    h('div', { class: 'srcname' }, h('span', { class: 'libsw', style: { '--sw': DECOR_SWATCH[m.decor] || '#555' } }), h('span', {}, h('b', {}, m.name || 'Bibliothèque partagée'), h('small', {}, `${n} livre${n > 1 ? 's' : ''} · ${fmtSize(r.size || 0)}`))),
    h('p', { class: 'muted' }, 'Elle s\'ajoute comme une nouvelle bibliothèque, avec son décor. Tes autres livres ne bougent pas.'),
    h('div', { class: 'actions', style: { marginTop: '16px', justifyContent: 'flex-end' } },
      h('button', { class: 'btn', onclick: () => { AndroidShare.clearReceived(); close(); } }, 'Refuser'),
      h('button', { class: 'btn primary', onclick: () => { close(); importReceived(r); } }, icon('plus'), 'Ajouter à mes livres'))));
}
// Un livre ouvert depuis Messenger, le courriel, Drive… : il rejoint l'étagère et s'ouvre (sans doublon)
async function openReceivedBook(info) {
  try {
    const resp = await fetch('/__recu?f=' + encodeURIComponent(info.file));
    if (!resp.ok) throw new Error();
    const file = new File([await resp.blob()], info.name);
    AndroidShare.clearReceived();
    if (window.__reader) { try { window.__reader.close(); } catch {} }
    let meta = null;
    for (const l of libs()) { meta = await LocalAPI.findDup(file, l.id); if (meta) { if (S.lib !== 'all' && S.lib !== l.id) switchLib(l.id); break; } }
    if (meta) toast(`« ${meta.title} » est déjà sur ton étagère`);
    else { const added = await uploadFiles([file]); meta = added.find((x) => x && x.id) || null; }
    await loadBooks(); renderLibrary();
    const b = meta && S.books.find((x) => x.id === meta.id);
    if (b) openBook(b, null); else toast('Livre ajouté à l\'étagère');
  } catch { toast('Impossible d\'ouvrir ce livre'); }
}
async function importReceived(r) {
  const m = r.manifest || {}, l = libs();
  let name = String(m.name || 'Bibliothèque partagée').slice(0, 60), k = 2;
  while (l.some((x) => x.name === name)) name = `${String(m.name || 'Bibliothèque partagée').slice(0, 54)} (${k++})`;
  const decor = DECORS.some(([d]) => d === m.decor) ? m.decor : 'acajou';
  const lib = { id: 'lib' + Date.now().toString(36), name, decor };
  l.push(lib); saveLibs(l); switchLib(lib.id);
  const info = new Map((m.books || []).map((b) => [b.path, b]));
  let ok = 0, fail = 0;
  for (const g of (m.books || []).filter((x) => x.group)) { // livres audio en plusieurs pistes
    const parts = r.files.filter((f) => f.path.startsWith(g.path)); if (!parts.length) continue;
    r.files = r.files.filter((f) => !parts.includes(f));
    try {
      const files = []; for (const f of parts) { const resp = await fetch('/__recu?f=' + encodeURIComponent(f.file)); files.push(new File([await resp.blob()], f.path.split('/').pop())); }
      const meta = await LocalAPI.uploadAudio(files, () => {}, { lib: lib.id });
      await post('/api/books/' + meta.id, { title: g.title || meta.title, author: g.author || '' }, 'PATCH'); ok++;
    } catch { fail++; }
  }
  for (let i = 0; i < r.files.length; i++) {
    const f = r.files[i], fname = f.path.split('/').pop();
    const box = h('div', { class: 'up' }, h('b', {}, fname), h('span', { class: 'muted' }, `${name} : livre ${i + 1} sur ${r.files.length}`), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    try {
      const resp = await fetch('/__recu?f=' + encodeURIComponent(f.file));
      if (!resp.ok) throw new Error('Fichier illisible');
      const file = new File([await resp.blob()], fname, { lastModified: m.date || Date.now() });
      const meta = await LocalAPI.upload(file, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = `${i + 1}/${r.files.length} · ${msg}`; }, { lib: lib.id, src: 'recu:' + f.path });
      const b = info.get(f.path);
      if (b && (b.title || b.author)) await post('/api/books/' + meta.id, { title: b.title || meta.title, author: b.author || '' }, 'PATCH');
      box.remove(); ok++;
      if (ok % 5 === 0) { await loadBooks(); renderLibrary(); }
    } catch (err) { fail++; $('span', box).textContent = err.message; $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000); }
  }
  AndroidShare.clearReceived();
  await loadBooks(); renderLibrary();
  toast(`« ${name} » : ${ok} livre${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (fail ? ` · ${fail} refusé${fail > 1 ? 's' : ''}` : ''));
}

// Onglets des bibliothèques, sous le titre : on passe de l'une à l'autre d'un geste
// La bibliothèque principale vidée de son dossier et de ses livres n'a plus d'onglet (s'il en reste d'autres)
const visibleLibs = () => libs();
function libTabs() {
  const l = visibleLibs(); const m = folderMap();
  if (!l.length || (l.length < 2 && !m[l[0].id])) return null;
  if (S.lib !== 'all' && !l.some((x) => x.id === S.lib)) setTimeout(() => switchLib(l[0].id), 0);
  const tab = (id, name, decor) => {
    const el = h('button', { class: 'libtab' + (S.lib === id ? ' sel' : ''), onclick: () => { if (el._long) { el._long = false; return; } if (S.lib !== id) switchLib(id); else if (id !== 'all') tabMenu(id); } },
      h('span', { class: 'libsw' + (id === 'all' ? ' all' : ''), style: { '--sw': DECOR_SWATCH[decor] || '#555' } }), h('span', {}, name),
      S.lib === id && id !== 'all' ? h('span', { class: 'tabmore', 'aria-hidden': 'true' }, icon('chev')) : null);
    if (id !== 'all') { // appui long sur n'importe quel onglet : son menu
      let t; const start = () => { t = setTimeout(() => { window.__lpAt = Date.now(); tabMenu(id); }, 550); }; const stop = () => clearTimeout(t);
      el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchend', stop, { passive: true }); el.addEventListener('touchmove', stop, { passive: true });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); tabMenu(id); });
    }
    return el;
  };
  return h('nav', { class: 'libtabs', 'aria-label': 'Bibliothèques' },
    l.map((x) => tab(x.id, x.name, x.decor)),
    l.length > 1 ? tab('all', 'Toutes', store.get('decorAll', 'ebene')) : null,
    h('button', { class: 'libtab add', onclick: addFolderLib, title: 'Ajouter un dossier (nouvelle bibliothèque)' }, icon('plus'), h('span', {}, 'Ajouter un dossier')));
}

// Changer de bibliothèque
function openLibraries() {
  const m = folderMap();
  const live = S.books.filter((b) => !b.trashed);
  const count = (id) => live.filter((b) => (b.lib || 'main') === id).length;
  const n = (k) => `${k} livre${k > 1 ? 's' : ''}`;
  const row = (id, name, decor, sub, k) => h('div', { class: 'librow' + (S.lib === id ? ' sel' : '') },
    h('button', { class: 'libpick', onclick: () => { close(); switchLib(id); } },
      h('span', { class: 'libsw' + (id === 'all' ? ' all' : ''), style: { '--sw': DECOR_SWATCH[decor] || '#555' } }),
      h('span', { class: 'libtxt' }, h('b', {}, name), h('small', {}, sub)), h('em', {}, n(k))),
    id !== 'all' ? h('button', { class: 'dedit', 'aria-label': 'Modifier ' + name, onclick: () => { close(); editLib(id); } }, icon('pencil')) : null);
  const close = sheet('Bibliothèques', h('div', {},
    h('div', { class: 'libs' },
      libs().map((l) => row(l.id, l.name, l.decor, m[l.id] ? '📁 ' + m[l.id].name : 'Sans dossier source', count(l.id))),
      libs().length > 1 ? row('all', 'Toutes ensemble', store.get('decorAll', 'ebene'), 'Toutes les bibliothèques réunies', live.length) : null),
    h('div', { class: 'actions', style: { marginTop: '16px', justifyContent: 'flex-end' } },
      h('button', { class: 'btn primary', onclick: () => { close(); addFolderLib(); } }, icon('plus'), 'Ajouter un dossier'))));
}
function editLib(id) {
  const l = libs(); const lib = l.find((x) => x.id === id); if (!lib) return;
  const name = h('input', { value: lib.name, maxlength: 60 });
  let decor = lib.decor;
  const seg = decorPicker(decor, (k) => { decor = k; if (S.lib === id) document.documentElement.dataset.decor = k; });
  const f = folderOf(id);
  const close = sheet('Bibliothèque', h('div', {},
    h('label', { class: 'field' }, 'Nom', name),
    h('div', { class: 'field' }, 'Décor', seg),
    h('div', { class: 'field' }, 'Dossier source', h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { save(); close(); openFolder(id); } }, icon('folder'), f ? f.name : 'Choisir un dossier'),
      f ? h('button', { class: 'btn danger', onclick: () => { save(); close(); removeFolder(id); } }, icon('trash'), 'Supprimer le dossier') : null)),
    window.AndroidShare ? h('div', { class: 'field' }, 'Partage', h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { save(); close(); shareLibrary(id); } }, icon('share'), 'Envoyer à quelqu\'un'))) : null,
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: () => { save(); close(); removeFolder(id); } }, icon('trash'), 'Supprimer'),
      h('button', { class: 'btn primary', onclick: () => { save(); close(); applyDecor(); renderLibrary(); } }, 'Enregistrer'))));
  function save() { lib.name = name.value.trim().slice(0, 60) || lib.name; lib.decor = decor; saveLibs(l); if (id === 'main') { try { localStorage.setItem('bib.libname', lib.name); } catch {} } }
  // annuler sans enregistrer remet le décor en place
  const scrim = $$('.scrim').pop(); new MutationObserver((_, o) => { if (!scrim.isConnected) { applyDecor(); o.disconnect(); } }).observe(document.body, { childList: true });
}
function decorPicker(sel, onPick) {
  const wrap = h('div', { class: 'decors' }, DECORS.map(([k, l]) => h('button', { class: 'decor' + (k === sel ? ' sel' : ''), onclick: (e) => { $$('.decor', wrap).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); onPick(k); } },
    h('span', { class: 'libsw', style: { '--sw': DECOR_SWATCH[k] } }), l)));
  return wrap;
}
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (S.me?.role !== 'owner' || !e.dataTransfer?.types?.includes('Files')) return; dragDepth++; $('#dz')?.classList.add('show'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dz')?.classList.remove('show'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('#dz')?.classList.remove('show'); if (S.me?.role === 'owner' && e.dataTransfer.files.length) uploadFiles([...e.dataTransfer.files]); });

// ================= Feuilles =================
function sheet(title, body, { wide } = {}) {
  const close = () => scrim.remove();
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } },
    h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'rbtn', onclick: close, 'aria-label': 'Fermer' }, icon('close'))),
      body));
  document.body.append(scrim);
  const onKey = (e) => { if (e.key === 'Escape') { close(); removeEventListener('keydown', onKey); } };
  addEventListener('keydown', onKey);
  return close;
}
function editBook(b) {
  if (!store.get('tipOpts', false)) { store.set('tipOpts', true); $('.coach')?.remove(); } // la personne a trouvé le menu
  const title = h('input', { value: b.title, maxlength: 200 });
  const author = h('input', { value: b.author || '', maxlength: 120, placeholder: 'Auteur' });
  let color = b.color;
  const sw = h('div', { class: 'swatches' }, PALETTE.map((c) => h('button', { class: c === color ? 'sel' : '', style: { background: c }, 'aria-label': c, onclick: (e) => { color = c; $$('button', sw).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); } })));
  const local = !!window.LocalAPI;
  const libSel = h('select', {}, libs().map((l) => h('option', { value: l.id, selected: l.id === (b.lib || 'main') }, l.name)));
  const cols = S.cols.filter((c) => (b.cols || []).includes(c.id)).map((c) => c.name);
  const qb = local ? quickBar(b, { labels: true }) : null;
  if (qb) $$('button', qb).forEach((x) => x.addEventListener('click', () => close(), { capture: true })); // ferme la fenêtre avant l'action
  const actRow = local && !b.trashed ? h('div', { class: 'bookacts' },
    window.__reader?.b?.id === b.id ? null : h('button', { class: 'bact', onclick: () => { close(); openBook(b, null); } }, icon(b.kind === 'audio' ? 'headphones' : 'book'), h('span', {}, b.kind === 'audio' ? 'Écouter' : 'Lire')),
    h('button', { class: 'bact', onclick: () => { close(); openWith(b, 'view'); } }, icon('open'), h('span', {}, 'Ouvrir avec…')),
    h('button', { class: 'bact', onclick: () => { close(); shareBook(b); } }, icon('share'), h('span', {}, 'Partager')),
    PAGED(b.kind) && Ocr.on() ? (b.ocr === 'done'
      ? h('button', { class: 'bact on', onclick: () => { close(); const v = store.get('view:' + b.id, 'text') === 'text' ? 'photo' : 'text'; store.set('view:' + b.id, v); if (window.__reader?.b?.id === b.id) window.__reader.switchView(v); else toast(v === 'text' ? 'Le livre s\'ouvrira en texte' : 'Le livre s\'ouvrira en photos'); } }, icon('type'), h('span', {}, store.get('view:' + b.id, 'text') === 'text' ? 'Revenir aux photos' : 'Lire en texte'))
      : h('button', { class: 'bact', onclick: () => { close(); Ocr.run(b, window.__reader?.b?.id === b.id ? window.__reader.page : 1); } }, icon('type'), h('span', {}, b.ocr === 'partial' ? 'Continuer la conversion en texte' : 'Convertir les photos en texte'))) : null,
    b.kind !== 'audio' ? h('button', { class: 'bact' + (b.summary ? ' on' : ''), onclick: () => { close(); openSummary(b); } }, icon('spark'), h('span', {}, b.summary ? 'Voir le résumé' : 'Résumé IA')) : null,
    Prof.on() && b.kind !== 'audio' ? h('button', { class: 'bact' + (Prof.info(b.id) ? ' on' : ''), onclick: () => { close(); Prof.open(b); } }, icon('prof'), h('span', {}, 'Professeur')) : null,
    Video.on() && b.kind !== 'audio' ? h('button', { class: 'bact' + (Video.exists(b.id) ? ' on' : ''), onclick: () => { close(); Video.open(b); } }, icon('film'), h('span', {}, 'Vidéo')) : null) : null;
  const close = sheet(b.trashed ? 'Dans la poubelle' : b.title, h('div', {},
    actRow,
    qb,
    !b.trashed && local ? h('div', { class: 'field' }, 'Ranger dans', libChips([b], () => close())) : null,
    local && cols.length ? h('p', { class: 'muted' }, 'Collections : ' + cols.join(', ')) : null,
    b.trashed ? null : h('label', { class: 'field' }, 'Titre', title),
    b.trashed ? null : h('label', { class: 'field' }, 'Auteur', author),
    !b.trashed && b.kind !== 'pdf' ? h('div', { class: 'field' }, 'Couleur de la couverture', sw) : null,
    h('p', { class: 'muted' }, `${KIND[b.kind] || b.kind} · ${b.pages} pages${b.size ? ' · ' + (b.size > 1e6 ? (b.size / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b.size / 1e3)) + ' ko') : ''}`),
    h('p', { class: 'muted' }, b.progress ? `Page ${b.progress.page} sur ${b.pages} · dernière lecture : ${lastRead(b.progress.last)} · ouvert ${b.progress.opens} fois` : 'Pas encore ouvert'),
    b.trashed ? null : h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: async () => {
        if (local) { close(); return trashBook(b); }
        if (!confirm(`Retirer « ${b.title} » de la bibliothèque ?`)) return; await api('/api/books/' + b.id, { method: 'DELETE' }); close(); await loadBooks(); renderLibrary(); toast('Livre retiré');
      } }, local ? 'Mettre à la poubelle' : 'Supprimer'),
      h('button', { class: 'btn primary', onclick: async () => { await post('/api/books/' + b.id, { title: title.value, author: author.value, color }, 'PATCH'); close(); await loadBooks(); renderLibrary(); } }, 'Enregistrer'))));
}
function openSettings() {
  const owner = S.me.role === 'owner';
  const local = !!window.LocalAPI;
  const lib = local ? curLib() : null;
  const nameIn = h('input', { value: local ? (lib ? lib.name : '') : S.me.library, maxlength: 80 });
  const pw = h('input', { type: 'password', placeholder: 'Laisser vide pour ne pas changer', autocomplete: 'new-password' });
  let decor = local ? (lib ? lib.decor : store.get('decorAll', 'ebene')) : store.get('decor', 'noyer');
  const picker = decorPicker(decor, (k) => { decor = k; document.documentElement.dataset.decor = k; });
  const close = sheet('Réglages', h('div', {},
    local ? h('p', { class: 'muted', style: { marginTop: '-6px' } }, lib ? 'Bibliothèque : ' + lib.name : 'Toutes les bibliothèques ensemble') : null,
    h('div', { class: 'field' }, local && !lib ? 'Décor de la vue « Toutes ensemble »' : 'Décor', picker),
    owner && (!local || lib) ? h('label', { class: 'field' }, 'Nom de la bibliothèque', nameIn) : null,
    owner && !local ? h('label', { class: 'field' }, 'Nouveau mot de passe', pw) : null,
    window.AndroidAI && KeyGuide.ok() ? h('div', { class: 'field' }, 'IA gratuite (Gemini)', h('div', { class: 'actions' },
      Prof.hasKey() ? h('span', { class: 'muted' }, 'Activée ✓') : null,
      h('button', { class: 'btn', onclick: () => { close(); KeyGuide.start(); } }, icon('spark'), Prof.hasKey() ? 'Changer la clé' : 'Activer l\'IA gratuite'))) : null,
    TTS.supported() ? h('div', { class: 'field' }, 'Lecture audio', h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { close(); openVoices(); } }, icon('voice'), 'Voix et ton : ' + Voice.label()))) : null,
    // Pour les habitués seulement : caché dans « Options avancées », fermé par défaut
    window.AndroidAI ? h('details', { class: 'more' }, h('summary', {}, 'Options avancées'),
      h('div', { class: 'aiopt', style: { marginTop: '10px' } },
        h('h4', {}, 'Clé Claude (payante)'),
        h('p', { class: 'muted' }, 'Facultatif, pour les habitués. Ajoute « Résumer avec Claude » dans le Résumé IA. Clé à créer sur console.anthropic.com → API Keys ; chaque résumé est facturé sur ton compte Claude.'),
        (() => { const ck = h('input', { type: 'password', placeholder: 'sk-ant-…', value: claudeKey(), autocomplete: 'off' });
          return h('div', {}, h('label', { class: 'field' }, 'Clé d\'API Claude', ck),
            h('div', { class: 'actions' },
              claudeKey() ? h('button', { class: 'btn', onclick: () => { store.set('claudeKey', ''); close(); toast('Clé Claude retirée'); } }, 'Retirer') : null,
              h('button', { class: 'btn', onclick: () => { const k = ck.value.trim(); if (!/^sk-ant-/.test(k)) return toast('Colle une clé qui commence par sk-ant-'); store.set('claudeKey', k); close(); toast('Clé Claude enregistrée'); } }, 'Enregistrer'))); })())) : null,
    local ? h('p', { class: 'muted' }, 'Tes livres sont gardés sur cet appareil. Pour en donner une copie à quelqu\'un, utilise le bouton de partage d\'une bibliothèque.') : null,
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('div', { class: 'actions' },
        local ? h('button', { class: 'btn', onclick: () => { close(); openLibraries(); } }, icon('collection'), 'Bibliothèques') : h('button', { class: 'btn', onclick: async () => { await post('/api/logout', {}); close(); boot(); } }, icon('logout'), 'Déconnexion'),
        isNative() ? h('button', { class: 'btn', onclick: () => AndroidApp.changeServer() }, 'Adresse du serveur') : null),
      owner ? h('button', { class: 'btn primary', onclick: async () => {
        try {
          if (local) {
            const l = libs();
            if (lib) { const x = l.find((y) => y.id === lib.id); x.decor = decor; x.name = nameIn.value.trim().slice(0, 60) || x.name; saveLibs(l); if (x.id === 'main') { try { localStorage.setItem('bib.libname', x.name); } catch {} } }
            else store.set('decorAll', decor);
          } else { await post('/api/settings', { library: nameIn.value, password: pw.value || undefined }, 'PATCH'); S.me.library = nameIn.value; store.set('decor', decor); }
          close(); renderLibrary(); toast('Réglages enregistrés');
        } catch (e) { toast(e.message); }
      } }, 'Enregistrer') : null)));
  // fermer sans enregistrer remet le décor d'avant
  const scrim = $$('.scrim').pop(); new MutationObserver((_, o) => { if (!scrim.isConnected) { local ? applyDecor() : (document.documentElement.dataset.decor = store.get('decor', 'noyer')); o.disconnect(); } }).observe(document.body, { childList: true });
}


// ================= Android Auto (rien ne change à l'écran du téléphone) =================
// L'application prépare en arrière-plan, pour le service Android Auto : le catalogue, le texte de chaque livre
// découpé en phrases (avec sa page ou sa position) et les couvertures. Elle récupère aussi la position atteinte dans l'auto.
const AutoSync = {
  on: () => !!(window.AndroidAuto && window.LocalAPI),
  t: null, running: false, again: false,
  schedule(delay = 1500) { if (!this.on()) return; clearTimeout(this.t); this.t = setTimeout(() => this.run(), delay); },
  async run() {
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      await Glide.idle(); // jamais pendant un défilement : ce travail passe après le doigt
      await this.pullProgress();
      this.writeCatalog();
      const done = store.get('autoDone', {});
      const live = S.books.filter((b) => !b.trashed && b.status === 'ready');
      for (const b of live) {
        const ck = `${b.title}|${b.author}|${b.color}|${b.coverUrl ? 1 : 0}`;
        const d = done[b.id] || {};
        if (d.c !== ck || !d.t) await Glide.idle();
        if (d.c !== ck) { if (await this.exportCover(b)) { d.c = ck; done[b.id] = d; store.set('autoDone', done); this.writeCatalog(); } }
        if (!d.t) { if (await this.exportText(b)) { d.t = 1; done[b.id] = d; store.set('autoDone', done); this.writeCatalog(); } }
        if (document.hidden) break; // on reprendra au retour dans l'application
      }
      // livres supprimés : on retire leurs fichiers
      const ids = new Set(live.map((b) => b.id));
      for (const f of JSON.parse(AndroidAuto.list('books') || '[]')) { const id = f.replace(/\.json$/, ''); if (!ids.has(id)) { AndroidAuto.remove('books/' + f); delete done[id]; } }
      for (const f of JSON.parse(AndroidAuto.list('covers') || '[]')) { const id = f.replace(/\.(jpg|png)$/, ''); if (!ids.has(id)) AndroidAuto.remove('covers/' + f); }
      for (const f of JSON.parse(AndroidAuto.list('prof') || '[]')) { const id = f.replace(/\.json$/, ''); if (!ids.has(id)) AndroidAuto.remove('prof/' + f); }
      store.set('autoDone', done);
    } catch (e) { /* Android Auto ne doit jamais gêner l'application */ }
    finally { this.running = false; if (this.again) { this.again = false; this.schedule(500); } }
  },
  writeCatalog() {
    const done = store.get('autoDone', {});
    const L = libs(); const name = (id) => (L.find((l) => l.id === id) || L[0]).name;
    const prof = new Set(JSON.parse(AndroidAuto.list('prof') || '[]').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
    const books = S.books.filter((b) => !b.trashed && b.status === 'ready' && b.kind !== 'audio').map((b) => ({
      id: b.id, title: b.title, author: b.author || '', lib: b.lib || 'main', libName: name(b.lib || 'main'), kind: b.kind,
      cover: done[b.id]?.c ? `covers/${b.id}.${b.coverUrl ? 'jpg' : 'png'}` : '',
      last: b.progress?.last || 0, page: b.progress?.page || 1, pos: b.progress?.pos ?? -1, prof: prof.has(b.id) }));
    const body = JSON.stringify({ libs: L.map((l) => ({ id: l.id, name: l.name })), books, rate: store.get('rate', 1) });
    if (body === this.lastCat) return; this.lastCat = body; // rien de changé : on n'écrit pas
    AndroidAuto.writeText('catalog.json', body.slice(0, -1) + ',"updated":' + Date.now() + '}');
  },
  async pullProgress() {
    let prog = {}; try { prog = JSON.parse(AndroidAuto.readText('progress.json') || '{}'); } catch {}
    const applied = store.get('autoApplied', {}); let changed = false;
    for (const [id, p] of Object.entries(prog)) {
      const b = S.books.find((x) => x.id === id); if (!b || !p.t || applied[id] >= p.t) continue;
      if ((b.progress?.last || 0) < p.t) {
        const body = b.kind === 'pdf' ? { book: id, type: 'page', page: p.page }
          : { book: id, type: 'page', page: Math.max(1, Math.round((p.frac || 0) * (b.pages || 1)) + 1), pages: b.pages, pos: p.pos };
        try { await post('/api/track', body); changed = true; } catch {}
      }
      applied[id] = p.t;
    }
    store.set('autoApplied', applied);
    if (changed) { await loadBooks(); if (!$('.reader')) renderLibrary(); }
  },
  async exportText(b) {
    const u = [];
    if (b.kind === 'pdf') {
      for (let n = 1; n <= b.pages; n++) {
        let t = ''; try { t = (await api(`/api/books/${b.id}/text/${n}`)).text || ''; } catch {}
        for (const x of sentences(t)) u.push([x, n]);
        await Glide.idle(); // laisse respirer l'application, et attend la fin d'un défilement
      }
    } else {
      const paras = await LocalAPI.paragraphs(b.id); let offset = 0;
      for (const raw of paras) {
        const text = raw.replace(/^#{1,3} /, ''); const base = offset + (raw.length - text.length); let cur = 0;
        for (const x of sentences(text)) { let k = text.indexOf(x.slice(0, 24), cur); if (k < 0) k = cur; u.push([x, base + k]); cur = k + Math.floor(x.length / 2); }
        offset += raw.length + 2;
      }
    }
    return AndroidAuto.writeText(`books/${b.id}.json`, JSON.stringify({ v: 1, kind: b.kind, u }));
  },
  async exportCover(b) {
    try {
      if (b.coverUrl) { const blob = await (await fetch(b.coverUrl)).blob(); return AndroidAuto.writeB64(`covers/${b.id}.jpg`, await blobToB64(blob)); }
      const c = document.createElement('canvas'); c.width = 400; c.height = 600; const g = c.getContext('2d');
      g.fillStyle = b.color || '#5b3a2a'; g.fillRect(0, 0, 400, 600);
      const gr = g.createLinearGradient(0, 0, 400, 600); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(0, 0, 400, 600);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 22, 600); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(22, 0, 3, 600);
      g.strokeStyle = 'rgba(255,240,215,.45)'; g.lineWidth = 2; g.strokeRect(46, 34, 330, 532);
      g.fillStyle = '#f6ead6'; g.textAlign = 'center'; g.font = '34px serif'; g.fillText('❦', 211, 110);
      g.font = '600 40px Georgia, serif';
      const lines = []; let line = '';
      for (const w of b.title.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 290 && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      const L = lines.slice(0, 6); const y0 = 300 - (L.length - 1) * 25;
      L.forEach((l, i) => g.fillText(l, 211, y0 + i * 50));
      g.fillRect(181, y0 + L.length * 50 - 18, 60, 2);
      if (b.author) { g.font = 'italic 26px Georgia, serif'; g.fillStyle = 'rgba(246,234,214,.85)'; g.fillText(b.author.slice(0, 32), 211, y0 + L.length * 50 + 26); }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return AndroidAuto.writeB64(`covers/${b.id}.png`, await blobToB64(blob));
    } catch { return false; }
  },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) AutoSync.schedule(300); });

// ================= Sélection de plusieurs livres =================
// Une case « Sélectionner » ; l'appui long garde son rôle (le menu du livre)
const Sel = { on: false, ids: new Set() };
function selStart() { Sel.on = true; Sel.ids.clear(); S.organize = false; renderLibrary(); toast('Touche les livres à choisir'); }
function selEnd() { Sel.on = false; Sel.ids.clear(); renderLibrary(); }
function selBooks() { return [...Sel.ids].map((id) => S.books.find((b) => b.id === id)).filter((b) => b && !b.trashed); } // dans l'ordre où on les a touchés
function selToggle(b, el) {
  Sel.ids.has(b.id) ? Sel.ids.delete(b.id) : Sel.ids.add(b.id);
  el?.classList.toggle('picked', Sel.ids.has(b.id)); selBarRender();
}
function selVisible() { return [...document.querySelectorAll('#app .book, #app .brow')].length ? S.books.filter((b) => !b.trashed && inNav(b)) : []; }
function selBarRender() {
  let bar = $('#selbar');
  if (!Sel.on) { bar?.remove(); document.body.classList.remove('selmode'); return; }
  document.body.classList.add('selmode');
  const n = Sel.ids.size; const books = selBooks();
  const allVis = selVisible(); const all = allVis.length && allVis.every((b) => Sel.ids.has(b.id));
  const act = (ic, label, fn, opts = {}) => h('button', { class: 'selact' + (opts.danger ? ' danger' : ''), disabled: opts.off ? true : null, onclick: fn }, icon(ic), h('span', {}, label));
  const fresh = h('div', { class: 'selbar', id: 'selbar', role: 'toolbar', 'aria-label': 'Livres choisis' },
    h('div', { class: 'selhead' },
      h('button', { class: 'rbtn', 'aria-label': 'Quitter la sélection', onclick: selEnd }, icon('close')),
      h('b', {}, n ? `${n} livre${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''}` : 'Touche les livres'),
      h('button', { class: 'selall', onclick: () => { if (all) Sel.ids.clear(); else allVis.forEach((b) => Sel.ids.add(b.id)); renderLibrary(); } }, all ? 'Aucun' : 'Tout')),
    h('div', { class: 'selacts' },
      act('share', 'Partager', () => shareMany(books), { off: !n }),
      act('spark', 'IA', () => aiChoices(books), { off: n < 1 }),
      act('move', 'Ranger', () => selMove(books), { off: !n }),
      act(books.length && books.every((b) => b.fav) ? 'starFill' : 'star', 'Favori', () => selFav(books), { off: !n }),
      act('trash', 'Poubelle', () => selTrash(books), { off: !n, danger: true })));
  bar ? bar.replaceWith(fresh) : document.body.append(fresh);
}
async function selFav(books) {
  const on = !books.every((b) => b.fav);
  for (const b of books) await post('/api/books/' + b.id, { fav: on }, 'PATCH');
  await loadBooks(); renderLibrary(); toast(on ? `${books.length} livre${books.length > 1 ? 's' : ''} en favori` : 'Retirés des favoris');
}
function selTrash(books) {
  const n = books.length;
  confirmDelete('Êtes-vous sûr ?', `Mettre ${n} livre${n > 1 ? 's' : ''} à la poubelle ? Tu pourras les restaurer.`, 'Oui, à la poubelle', async () => {
    for (const b of books) await post('/api/books/' + b.id, { trashed: true }, 'PATCH');
    Sel.ids.clear(); await loadBooks(); renderLibrary(); toast(`${n} livre${n > 1 ? 's' : ''} à la poubelle`);
  });
}
function selMove(books) {
  const close = sheet(`Ranger ${books.length} livre${books.length > 1 ? 's' : ''}`, h('div', { class: 'libs' }, libs().map((l) => h('div', { class: 'librow' },
    h('button', { class: 'libpick', onclick: async () => {
      close(); for (const b of books) await post('/api/books/' + b.id, { lib: l.id }, 'PATCH');
      await loadBooks(); selEnd(); toast(`Rangés dans « ${l.name} »`);
    } }, h('span', { class: 'libsw', style: { '--sw': DECOR_SWATCH[l.decor] || '#555' } }), h('span', { class: 'libtxt' }, h('b', {}, l.name)))))));
}
// Partager plusieurs livres en un seul envoi
async function shareMany(books, text = '') {
  if (!books.length) return;
  const size = books.reduce((a, b) => a + (b.size || 0), 0);
  const msg = text || (books.length === 1 ? `« ${books[0].title} »` : `${books.length} livres : ` + books.map((b) => `« ${b.title} »`).join(', '));
  if (size > 25e6) toast(`Gros envoi (${Math.round(size / 1e6)} Mo) : préfère WhatsApp, le courriel ou Drive`);
  try {
    if (window.AndroidOpen?.multiReset) {
      AndroidOpen.multiReset(); let skipped = 0;
      for (const b of books) {
        if (b.src && b.src.startsWith('saf:') && AndroidOpen.multiAddFolderDoc(b.lib || 'main', b.src.slice(4))) continue; // fichier d'origine, sans copie
        const f = await LocalAPI.fileOf(b.id);
        if (!f || !f.file) { skipped++; continue; }
        if (!AndroidOpen.multiBegin(f.name)) throw new Error();
        const CH = 3 * 256 * 1024;
        for (let i = 0; i < f.file.size; i += CH) if (!AndroidOpen.append(await blobToB64(f.file.slice(i, i + CH)))) throw new Error();
        AndroidOpen.multiEnd();
      }
      if (skipped) toast(`${skipped} livre${skipped > 1 ? 's' : ''} audio en plusieurs fichiers laissé${skipped > 1 ? 's' : ''} de côté`);
      if (!AndroidOpen.multiSend(msg)) toast('Aucun fichier à partager');
      return;
    }
    const files = [];
    for (const b of books) { const f = await LocalAPI.fileOf(b.id); if (f?.file) files.push(new File([f.file], f.name, { type: f.file.type || 'application/octet-stream' })); }
    if (files.length && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text: msg }); return; }
    for (const b of books) await openWith(b, 'view');
    toast('Livres téléchargés : envoie-les depuis tes fichiers');
  } catch (e) { if (e?.name !== 'AbortError') toast('Partage impossible'); }
}

// ================= Synthèse de plusieurs livres =================
// Rangée dans la bibliothèque « Synthèses », faite exprès ; elle se lit et s'écoute comme un livre
const SYNTH_MAX = 5;
const SYNTH_PROMPT = `Écris en français une synthèse croisée de ces livres, avec exactement ces titres :
## L'essentiel de chaque livre
(2 ou 3 phrases par livre, son titre en gras au début)
## Ce qu'ils ont en commun
## Où ils divergent
## Ce que l'un apporte à l'autre
## Phrases clés de l'ensemble
(5 à 7 phrases ultra concises, 12 mots au plus chacune, une par ligne commençant par « - »)
Reste fidèle aux livres : présente les idées des auteurs telles qu'ils les formulent, sans les juger ni les ramener à un autre cadre. Pas de préambule.`;
function synthLib() {
  let l = libs().find((x) => x.syn);
  if (!l) { const all = libs(); l = { id: 'syn' + Date.now().toString(36), name: 'Synthèses', decor: 'ardoise', syn: true }; all.push(l); saveLibs(all); }
  return l;
}
// Barre de sélection → « IA » : le Professeur sur les livres choisis, ou la synthèse croisée
function aiChoices(books) {
  const n = books.length;
  const close = sheet(n > 1 ? `IA · ${n} livres` : 'IA · 1 livre', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, books.slice(0, 6).map((b) => `« ${b.title} »`).join(', ') + (n > 6 ? ` et ${n - 6} autres` : '')),
    h('div', { class: 'sharechoices' },
      h('button', { class: 'addbig', onclick: () => { close(); ProfMulti.open(books); } },
        h('span', { class: 'addic' }, icon('prof')), h('span', { class: 'addtx' }, h('b', {}, 'Questions au Professeur'),
          h('small', {}, n > 1 ? `Il a lu ces ${n} livres et te répond en les croisant : idéal pour jumeler plusieurs domaines.` : 'Pose-lui tes questions sur ce livre.'))),
      n >= 2 ? h('button', { class: 'addbig', onclick: () => { close(); synthChoices(books); } },
        h('span', { class: 'addic' }, icon('merge')), h('span', { class: 'addtx' }, h('b', {}, 'Synthèse croisée'),
          h('small', {}, n > SYNTH_MAX ? `Choisis ${SYNTH_MAX} livres au plus pour une synthèse.` : 'Ce que chacun dit, leurs points communs et leurs divergences, rangé dans « Synthèses ».'))) : null)));
}

// fenêtre du Professeur d'un livre : marquée pour que « Retour » arrête le cours
function profSheet(...a) { const c = sheet(...a); const s = $$('.scrim').pop(); if (s) s.dataset.prof = 'book'; return c; }

// ---------- Le Professeur sur plusieurs livres : on lui pose des questions, il répond en croisant les livres choisis ----------
const ProfMulti = {
  corpus: null, key: '', history: [], speaking: false,
  async build(books, say) {
    const k = books.map((b) => b.id).sort().join(',');
    if (this.key === k && this.corpus) return this.corpus;
    // budget total raisonnable pour l'offre gratuite de Gemini (≈ 90 000 jetons), partagé entre les livres
    const per = Math.max(4000, Math.floor(360000 / books.length));
    const parts = [];
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      say(`Le Professeur lit les livres… ${i + 1} sur ${books.length}`);
      let txt = '';
      try { txt = (await LocalAPI.fullText(b.id, () => {})).text || ''; } catch {}
      const sum = b.summary?.text && b.summary.model !== 'auto' ? b.summary.text.slice(0, Math.floor(per * 0.3)) : '';
      parts.push(`=== LIVRE ${i + 1} : « ${b.title} »${b.author ? ' de ' + b.author : ''} ===\n${sum ? 'Résumé :\n' + sum + '\n\nExtraits :\n' : ''}${condense(txt, per - sum.length)}`);
    }
    this.corpus = parts.join('\n\n'); this.key = k; this.history = [];
    return this.corpus;
  },
  stopVoice() { this.speaking = false; try { TTS.stop?.(); } catch {} try { window.speechSynthesis?.cancel(); } catch {} },
  speak(text) {
    this.stopVoice(); this.speaking = true;
    const ss = splitSentences(text.replace(/\n+/g, ' ')); let i = 0;
    const next = () => { if (!this.speaking || i >= ss.length) { this.speaking = false; return; } const x = ss[i++]; const sh = Voice.shape(x, i, store.get('rate', 1) * Prof.speed(), Prof.tone()); TTS.speak(Pron.say(x), sh.rate, Voice.effective(), next, sh.pitch); };
    next();
  },
  open(books) {
    if (!window.AndroidAI?.generateOnline) return toast('Le Professeur a besoin de l\'IA gratuite (version Android).');
    if (!Prof.hasKey()) return KeyGuide.start(() => this.open(books));
    stopAllAudio();
    const n = books.length;
    const q = h('textarea', { placeholder: n > 1 ? 'Ta question… (ex. « Qu\'est-ce que ces livres disent ensemble sur la conscience ? »)' : 'Ta question au Professeur…' });
    const out = h('div', { class: 'prof-answer', style: { display: 'none' } });
    const send = async (pro) => {
      const v = q.value.trim(); if (!v) return toast('Écris ou dicte ta question');
      this.stopVoice(); out.style.display = ''; q.value = '';
      const say = (m) => { out.textContent = m; };
      try {
        const corpus = await this.build(books, say);
        say(pro ? 'Le Professeur réfléchit en profondeur (Gemini Pro)…' : 'Le Professeur répond (Gemini Flash)…');
        const hist = this.history.slice(-4).map((x) => `Question : ${x.q}\nTa réponse : ${x.a}`).join('\n\n');
        const prompt = `Tu as lu ${n > 1 ? `ces ${n} livres` : 'ce livre'} (extraits ci-dessous). L'auditeur te pose une question.
${n > 1 ? 'Réponds en CROISANT les livres : ce que chacun apporte, où ils se rejoignent, où ils divergent, et ce que leur rencontre fait naître. Nomme les livres (par leur titre) quand tu t\'appuies sur eux.' : ''}
Reste fidèle aux idées des auteurs, telles qu'ils les formulent, sans les juger ni les ramener à un autre cadre.
Si la réponse n'est pas dans les livres, dis-le franchement, puis donne ton propre éclairage en précisant que c'est ton avis.
Réponds ${pro ? 'de façon approfondie et nuancée, en 8 à 15 phrases' : 'en 4 à 7 phrases'}, avec entrain, comme à voix haute : pas de listes ni de symboles.
${hist ? '\nVos échanges précédents :\n' + hist + '\n' : ''}
<livres>
${corpus}
</livres>

Question : ${v}`;
        const r = Prof.clean(await onlineAsk(Prof.persona + Prof.toneNote(), prompt, !pro, false, say));
        this.history.push({ q: v, a: r });
        out.textContent = r;
        if (pro && !/pro/.test(window.__lastModel || '')) out.prepend(h('p', { class: 'muted', style: { margin: '0 0 6px' } }, 'Gemini Pro est à court pour l\'instant : réponse de Gemini Flash.'));
        this.speak(r);
      } catch (e) { out.textContent = e.message; }
    };
    const mic = window.AndroidAuto?.listen ? h('button', { class: 'btn', 'aria-label': 'Dicter', onclick: () => {
      this.stopVoice();
      window.__heard = (t) => { window.__heard = null; if (t) q.value = t; };
      setTimeout(() => AndroidAuto.listen(), 300);
    } }, icon('mic')) : null;
    const close = sheet(n > 1 ? `Le Professeur · ${n} livres` : 'Le Professeur', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, books.slice(0, 8).map((b) => `« ${b.title} »`).join(', ') + (n > 8 ? ` et ${n - 8} autres` : '')),
      h('div', { class: 'aiopt' },
        h('h4', {}, 'Poser une question'),
        h('p', {}, n > 1 ? 'Le Professeur a lu tous ces livres : il te répond à voix haute en les croisant.' : 'Le Professeur te répond à voix haute à partir du livre.'),
        h('div', { class: 'prof-ask' }, q, mic),
        h('div', { class: 'prof-row', style: { marginTop: '8px' } },
          h('button', { class: 'btn', onclick: () => send(false) }, icon('spark'), 'Réponse flash'),
          h('button', { class: 'btn primary', onclick: () => send(true) }, icon('prof'), 'Réponse pro'),
          h('button', { class: 'btn', onclick: () => this.stopVoice() }, icon('stop'), 'Silence')),
        out)), { wide: true });
    const scrim = $$('.scrim').pop(); scrim.dataset.prof = 'multi';
    new MutationObserver((_, o) => { if (!scrim.isConnected) { this.stopVoice(); o.disconnect(); } }).observe(document.body, { childList: true });
  },
};

function synthChoices(books) {
  if (books.length < 2) return toast('Choisis au moins 2 livres');
  if (books.length > SYNTH_MAX) return toast(`${SYNTH_MAX} livres au plus pour une synthèse`);
  const list = books.map((b) => `« ${b.title} »`).join(', ');
  const close = sheet('Synthèse de ' + books.length + ' livres', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, list),
    h('p', {}, 'Ce que chacun dit, ce qu\'ils ont en commun, où ils divergent, ce que l\'un apporte à l\'autre, et les phrases clés de l\'ensemble. Elle sera rangée dans la bibliothèque « Synthèses », prête à lire ou à écouter.'),
    h('div', { class: 'sharechoices' },
      h('button', { class: 'addbig', onclick: () => { close(); makeSynthesis(books); } },
        h('span', { class: 'addic' }, icon('merge')), h('span', { class: 'addtx' }, h('b', {}, 'Faire la synthèse'), h('small', {}, window.AndroidAI && !AndroidAI.web ? 'Gratuite, sur le téléphone (IA du téléphone si disponible, sinon synthèse automatique)' : 'Gratuite, synthèse automatique sur l\'appareil'))),
      h('button', { class: 'addbig', onclick: () => { close(); shareMany(books, `Fais une synthèse croisée des livres ci-joints (${list}).\n${SYNTH_PROMPT}`); } },
        h('span', { class: 'addic' }, icon('share')), h('span', { class: 'addtx' }, h('b', {}, 'Avec ton application d\'IA'), h('small', {}, 'ChatGPT, Claude, Gemini… Les livres partent avec la demande déjà écrite.'))))));
}
function mdSection(md, re) { // lignes d'une section « ## … » d'un résumé
  const lines = String(md || '').split('\n'); let on = false; const out = [];
  for (const l of lines) { if (/^#{1,3}\s/.test(l)) { if (on) break; on = re.test(l); continue; } if (on && l.trim()) out.push(l.replace(/^[-•*]\s+|^\d+[.)]\s+/, '').trim()); }
  return out;
}
function autoSynthesis(books, sums) {
  const sets = sums.map((t) => new Set(words(t)));
  const freq = new Map(); sums.forEach((t) => words(t).forEach((w) => freq.set(w, (freq.get(w) || 0) + 1)));
  const shared = [...freq.entries()].filter(([w]) => sets.filter((st) => st.has(w)).length >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  let md = '## L\'essentiel de chaque livre\n';
  books.forEach((b, i) => { const ess = mdSection(sums[i], /essentiel/i).slice(0, 3); md += `### ${b.title}\n${(ess.length ? ess : splitSentences(sums[i]).slice(0, 3)).map((x) => '- ' + x).join('\n')}\n`; });
  md += '\n## Ce qu\'ils ont en commun\n';
  if (shared.length) {
    md += `Thèmes partagés : ${shared.join(' · ')}\n`;
    const both = []; sums.forEach((t, i) => splitSentences(t).forEach((x) => { const w = new Set(words(x)); if (shared.filter((k) => w.has(k)).length >= 2 && both.length < 5) both.push(`${x} (${books[i].title})`); }));
    if (both.length) md += both.map((x) => '- ' + x).join('\n') + '\n';
  } else md += 'Ces livres partagent peu de mots-clés : ils abordent des sujets assez différents.\n';
  const keys = []; sums.forEach((t) => mdSection(t, /phrases? clés?/i).slice(0, 2).forEach((x) => keys.push(x)));
  if (keys.length) md += `\n## Phrases clés de l'ensemble\n${keys.map((x) => '- ' + x).join('\n')}\n`;
  md += '\n_Synthèse automatique : sans IA, les points de désaccord entre les livres ne sont pas analysés._';
  return md;
}
async function makeSynthesis(books) {
  const box = h('div', { class: 'up' }, h('b', {}, 'Synthèse de ' + books.length + ' livres'), h('span', { class: 'muted' }, 'Préparation…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
  $('#uploads')?.append(box);
  const say = (t) => { $('span', box).textContent = t; };
  try {
    const sums = [], used = [];
    for (const b of books) {
      let t = b.summary?.text;
      if (!t) { try { t = (await computeSummary(b, (m) => say(`« ${b.title} » : ${m}`))).text; } catch (e) { toast(`« ${b.title} » laissé de côté : ${e.message}`); continue; } }
      sums.push(t); used.push(b);
    }
    if (used.length < 2) throw new Error('Il faut au moins 2 livres avec du texte lisible pour une synthèse.');
    const ctx = (max) => used.map((b, i) => `### ${b.title}${b.author ? ' (' + b.author + ')' : ''}\n${sums[i].slice(0, max)}`).join('\n\n');
    let body = null, model = 'auto';
    if (window.AndroidAI) {
      say('Recherche de l\'IA du téléphone…');
      if ((await nanoStatus()) === 'available') {
        say('IA du téléphone : rédaction de la synthèse…');
        try { body = await nanoAskRetry(`${SYNTH_PROMPT}\n\nRésumés des livres :\n${ctx(Math.floor(5200 / used.length))}`, say); model = 'gemini-nano'; } catch { body = null; }
      }
    }
    if (!body && window.AndroidAI?.generateOnline && Prof.hasKey()) {
      say('Gemini rédige la synthèse…');
      try { body = Prof.clean0(await onlineAsk('', `${SYNTH_PROMPT}\n\nRésumés des livres :\n${ctx(20000)}`, false, false, say)); model = /pro/.test(window.__lastModel || '') ? 'gemini-pro' : 'gemini'; } catch { body = null; }
    }
    if (!body) { say('Synthèse automatique…'); body = autoSynthesis(used, sums); }
    const titles = used.map((b) => b.title);
    const title = ('Synthèse : ' + titles.join(' + ')).slice(0, 150);
    const head = `# ${title}\n\nLivres réunis : ${used.map((b) => `« ${b.title} »${b.author ? ' de ' + b.author : ''}`).join(' ; ')}.\n\n`;
    const lib = synthLib();
    say('Rangement dans « Synthèses »…');
    const fname = ('Synthèse - ' + titles.join(' + ')).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 110) + '.md';
    const meta = await LocalAPI.upload(new File([head + body.replace(/\n{3,}/g, '\n\n')], fname, { type: 'text/markdown' }), () => {}, { lib: lib.id });
    await post('/api/books/' + meta.id, { title, author: `Synthèse de ${used.length} livres`, summary: { text: body, date: Date.now(), model } }, 'PATCH');
    box.remove(); await loadBooks(); Sel.on = false; Sel.ids.clear(); switchLib(lib.id);
    toast('Synthèse rangée dans « Synthèses »');
    const b = S.books.find((x) => x.id === meta.id); if (b) openBook(b, null);
  } catch (e) { say(e.message); $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 12000); }
}

// ================= Ouvrir avec une autre application =================
function blobToB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); }); }
async function openWith(b, mode = 'view', prompt = '') {
  const fname = b.fname || b.title;
  try {
    if (window.AndroidOpen) {
      // livre venu d'un dossier : on passe le fichier d'origine directement
      if (b.src && b.src.startsWith('saf:') && AndroidOpen.openFolderDoc(b.lib || 'main', b.src.slice(4), fname, mode, prompt || '')) return;
      const f = await LocalAPI.fileOf(b.id, { asText: mode === 'ai' && b.kind !== 'pdf' && !b.fname?.match(/\.docx$/i) });
      if (!f) return toast('Fichier introuvable');
      if (!f.file) return toast('Livre en plusieurs fichiers : partage plutôt toute la bibliothèque');
      if (f.converted) toast('Le fichier Word d\'origine n\'a pas été gardé : il s\'ouvre en texte');
      if (!AndroidOpen.begin(f.name)) return toast('Préparation du fichier impossible');
      const CH = 3 * 256 * 1024; // morceaux de 768 ko
      for (let i = 0; i < f.file.size; i += CH) if (!AndroidOpen.append(await blobToB64(f.file.slice(i, i + CH)))) return toast('Préparation du fichier impossible');
      AndroidOpen.finish(mode, prompt || '');
      return;
    }
    // navigateur : on télécharge le fichier
    const f = await LocalAPI.fileOf(b.id); if (!f) return toast('Fichier introuvable');
    const a = h('a', { href: URL.createObjectURL(f.file), download: f.name }); document.body.append(a); a.click(); a.remove();
    if (mode === 'ai') { try { await navigator.clipboard.writeText(prompt); toast('Demande copiée : colle-la dans ton IA avec le fichier'); } catch {} }
  } catch (e) { toast(e.message || 'Impossible d\'ouvrir ce livre'); }
}
window.__openDone = (msg) => { if (msg && msg !== 'ok') toast(msg); };
// Partager un livre : à des amis (Messenger, Messages, courriel, WhatsApp…) ou à une application d'IA
async function shareBook(b) {
  const msg = `« ${b.title} »${b.author ? ' de ' + b.author : ''}`;
  if (window.AndroidOpen) return openWith(b, 'send', msg);
  try { // iPhone et navigateurs : la feuille de partage du téléphone
    const f = await LocalAPI.fileOf(b.id); if (!f || !f.file) return toast('Fichier introuvable');
    const file = new File([f.file], f.name, { type: f.file.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: b.title, text: msg }); return; }
    openWith(b, 'view'); toast('Le livre est téléchargé : envoie-le depuis tes fichiers');
  } catch (e) { if (e?.name !== 'AbortError') toast('Partage impossible'); }
}

// ================= Résumé par une IA =================
// Les phrases clés ne sont pas des citations : l'IA les formule pour dire ce que le livre veut dire et nous apprend
const KEYS_RULE = `des phrases choc que TU formules toi-même (jamais des phrases recopiées du livre), qui disent ce que le livre veut dire et ce qu'il nous apprend. Leur nombre suit la longueur du livre : 3 pour un texte court, jusqu'à 7 pour un long livre, ou une phrase par chapitre si c'est plus pertinent. Chaque phrase va droit au but (15 mots au plus) et résume une partie du livre ou une leçon du livre entier.`;
const SUMMARY_PROMPT = `Fais un résumé bien construit, en français, du livre ci-joint.
Structure :
1. L'essentiel : l'idée centrale en 3 ou 4 phrases.
2. Le déroulement : les grandes parties ou chapitres, dans l'ordre, avec leurs idées clés.
3. Les concepts et arguments importants, expliqués simplement.
4. Ce qu'il faut retenir : 5 à 8 points.
5. Phrases clés : ${KEYS_RULE} Présente-les en liste, sous le titre « Phrases clés ».
Reste fidèle au texte : présente les idées de l'auteur telles qu'il les formule, sans les juger ni les ramener à un autre cadre. Environ 800 à 1200 mots, titres courts, sans préambule.`;
const CLAUDE_MODEL = 'claude-sonnet-5-5';
const claudeKey = () => store.get('claudeKey', '');
function mdToHtml(md) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  let out = '', list = null, keySec = false;
  const flush = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    let m;
    if (!line) { flush(); continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); keySec = /phrases? clés?/i.test(m[2]); const tag = m[1].length >= 3 ? 'h5' : 'h4'; out += `<${tag}${keySec ? ' class="keyh"' : ''}>${inl(m[2])}</${tag}>`; continue; }
    if ((m = line.match(/^[-•*]\s+(.*)$/))) { if (list !== 'ul') { flush(); out += keySec ? '<ul class="keys">' : '<ul>'; list = 'ul'; } out += `<li>${inl(m[1])}</li>`; continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { flush(); out += keySec ? '<ol class="keys">' : '<ol>'; list = 'ol'; } out += `<li>${inl(m[1])}</li>`; continue; }
    flush(); out += `<p>${inl(line)}</p>`;
  }
  flush(); return out;
}
function estimateCost(b) {
  const chars = Math.min(1200000, (b.pages || 1) * (b.kind === 'pdf' ? 2200 : 1500));
  const usd = (chars / 3.5) / 1e6 * 2 + 0.03; // Sonnet 5.5 : 2 $ par million de jetons lus, 10 $ par million écrits
  return usd < 0.05 ? 'moins de 5 ¢ US' : `environ ${usd.toFixed(2).replace('.', ',')} $ US`;
}
// une autre action commence (résumé…) : toute lecture à voix haute s'arrête
function stopAllAudio() {
  try { window.__reader?.pause(); } catch {}
  try { if (window.AndroidAuto?.profStop) AndroidAuto.profStop(); } catch {}
}
function openSummary(b) {
  if (!Premium.need('summary')) return;
  stopAllAudio();
  const s = b.summary;
  if (s?.text) {
    const close = sheet('Résumé', h('div', { class: 'summary' },
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, `${b.title} · ${lastRead(s.date)} · ${s.model === 'gemini-nano' ? 'IA du téléphone (Gemini Nano)' : s.model === 'gemini-pro' ? 'Gemini Pro' : s.model === 'gemini' ? 'Gemini Flash' : s.model === 'auto' ? 'résumé automatique : les passages clés du livre' : 'Claude'}${s.truncated ? ' · livre très long, résumé sur sa plus grande partie' : ''}`),
      h('div', { class: 'sumtext', html: mdToHtml(s.text) }),
      h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
        h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(s.text); toast('Résumé copié'); } catch { toast('Copie impossible'); } } }, icon('copy'), 'Copier'),
        h('button', { class: 'btn', onclick: () => { close(); summaryChoices(b); } }, icon('refresh'), 'Refaire'))), { wide: true });
    return close;
  }
  summaryChoices(b);
}
function summaryChoices(b) {
  const keyIn = h('input', { type: 'password', placeholder: 'sk-ant-…', value: claudeKey(), autocomplete: 'off' });
  const hasKey = !!window.AndroidAI && Prof.hasKey();
  const canGuide = !!window.AndroidAI && KeyGuide.ok();
  const close = sheet('Résumé IA', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
    hasKey ? h('div', { class: 'aiopt' },
      h('h4', {}, 'Résumé par ton IA gratuite'),
      h('p', {}, 'Gemini (Pro si ta clé y a droit, sinon Flash) lit le livre en entier et rédige le résumé, avec des phrases clés qui disent ce que le livre nous apprend. Si Gemini n\'est pas disponible, l\'IA du téléphone ou le résumé automatique prend le relais.'),
      h('button', { class: 'btn primary', onclick: () => { close(); makeFreeSummary(b); } }, icon('spark'), 'Faire le résumé'))
    : canGuide ? h('div', { class: 'aiopt' },
      h('h4', {}, 'Activer l\'IA gratuite'),
      h('p', {}, 'Un vrai résumé rédigé par Gemini, l\'IA gratuite de Google. Il faut une clé gratuite : 4 touchers, moins d\'une minute, une seule fois.'),
      h('button', { class: 'btn primary', onclick: () => { close(); KeyGuide.start(() => makeFreeSummary(b)); } }, icon('spark'), 'Activer l\'IA gratuite')) : null,
    !hasKey ? h('div', { class: 'aiopt' },
      h('h4', {}, canGuide ? 'Sans clé' : 'Résumé gratuit'),
      h('p', {}, window.AndroidAI && !AndroidAI.web
        ? 'Fait sur ton téléphone, sans Internet ni compte : avec l\'IA intégrée de Google (Gemini Nano) si le téléphone l\'a ; sinon, un résumé automatique choisit les passages clés du livre.'
        : 'Un résumé automatique choisit les passages clés du livre, directement sur l\'appareil.'),
      h('button', { class: canGuide ? 'btn' : 'btn primary', onclick: () => { close(); makeFreeSummary(b); } }, icon('spark'), 'Faire le résumé')) : null,
    h('div', { class: 'aiopt' },
      h('h4', {}, 'Avec ton application d\'IA'),
      h('p', {}, 'Claude, Gemini, ChatGPT… Le livre lui est envoyé avec une demande de résumé déjà écrite.'),
      h('button', { class: 'btn', onclick: () => { close(); openWith(b, 'ai', SUMMARY_PROMPT); } }, icon('share'), 'Choisir l\'application')),
    // Claude (payant) : gardé seulement pour qui avait déjà mis sa clé
    claudeKey() ? h('details', { class: 'more' }, h('summary', {}, 'Autres options'),
      h('div', { class: 'aiopt', style: { marginTop: '10px' } },
        h('h4', {}, 'Avec Claude (payant)'),
        h('p', {}, `Avec ta clé d'API Claude, facturée à l'usage : ${estimateCost(b)} pour ce livre.`),
        h('label', { class: 'field' }, 'Clé d\'API Claude', keyIn),
        h('button', { class: 'btn', onclick: () => { const k = keyIn.value.trim(); if (!/^sk-ant-/.test(k)) return toast('Colle une clé qui commence par sk-ant-'); store.set('claudeKey', k); close(); makeSummary(b); } }, icon('spark'), 'Résumer avec Claude'))) : null));
}

// ---------- IA gratuite dans la version web (iPhone, navigateur) ----------
// Sans application Android, le navigateur parle directement à Gemini avec la clé gratuite de la personne
// (gardée seulement dans ce navigateur). Pro d'abord, Flash en relais : mêmes règles que sur Android.
if (!window.AndroidAI) window.AndroidAI = (() => {
  const K = 'bib.geminiKey', P = 'bib.proPause';
  const PRO = ['gemini-pro-latest', 'gemini-2.5-pro'], FLASH = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = 'https://generativelanguage.googleapis.com/v1beta/models';
  async function call(url, key, body) { // clé en en-tête, puis dans l'adresse (selon le format de la clé)
    const opt = (hdr) => ({ method: body ? 'POST' : 'GET', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(hdr ? { 'x-goog-api-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let r = await fetch(url, opt(true));
    if ([400, 401, 403].includes(r.status)) { const r2 = await fetch(url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key), opt(false)); if (r2.ok) r = r2; }
    return r;
  }
  async function ask(system, prompt, json, tell) {
    const key = get(K, ''); if (!key) throw new Error('Il manque la clé Gemini gratuite (Réglages → IA gratuite).');
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: json ? 16384 : 8192, ...(json ? { responseMimeType: 'application/json' } : {}) } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const read = async (r) => { const j = await r.json(); return (j.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('').trim(); };
    if (Date.now() > +get(P, 0)) { // 1) Pro
      for (let m = 0, t = 0; m < PRO.length && t < 3; t++) {
        let r; try { r = await call(`${base}/${PRO[m]}:generateContent`, key, body); } catch { break; }
        if (r.ok) { const x = await read(r); if (x) return { text: x, model: PRO[m] }; break; }
        if (r.status === 404) { m++; t--; continue; }
        if (r.status === 429 && t < 2) { tell('Gemini Pro est occupé : nouvel essai dans 40 s…'); await sleep(40000); tell('Gemini Pro : nouvel essai…'); continue; }
        if (r.status >= 500 && t < 2) { await sleep(6000); continue; }
        tell('Gemini Pro est à court pour aujourd\'hui : Gemini Flash prend le relais…'); set(P, Date.now() + 6 * 3600e3); break;
      }
    }
    let last = 'pas de réponse';
    for (let m = 0, t = 0; m < FLASH.length && t < 6; t++) { // 2) Flash
      let r; try { r = await call(`${base}/${FLASH[m]}:generateContent`, key, body); } catch { last = 'pas de connexion Internet'; await sleep(4000); continue; }
      if (r.ok) { const x = await read(r); if (x) return { text: x, model: FLASH[m] }; last = 'réponse vide'; continue; }
      if (r.status === 404) { m++; continue; }
      if ([400, 401, 403].includes(r.status)) throw new Error('La clé Gemini est refusée. Refais « Activer l\'IA gratuite » dans les Réglages.');
      if (r.status === 429) { last = 'quota gratuit momentanément atteint'; tell('Gemini est occupé : nouvel essai dans 20 s…'); await sleep(20000); continue; }
      last = 'erreur ' + r.status; await sleep(5000);
    }
    throw new Error('Gemini ne répond pas (' + last + ').');
  }
  const gen = (json) => (id, system, prompt) => ask(system, prompt, json, (msg) => window.__aiProgress?.(JSON.stringify({ id, msg })))
    .then((r) => window.__aiResult?.(JSON.stringify({ id, text: r.text, model: r.model })), (e) => window.__aiResult?.(JSON.stringify({ id, error: e.message })));
  return {
    web: true,
    status() { setTimeout(() => window.__aiStatus?.('unavailable'), 0); },
    download() { setTimeout(() => window.__aiDownload?.('error:indisponible'), 0); },
    generate(id) { setTimeout(() => window.__aiResult?.(JSON.stringify({ id, error: 'IA du téléphone indisponible' })), 0); },
    generateOnline: gen(false), generateUrgent: gen(false), generateJson: gen(true),
    hasGeminiKey: () => !!get(K, ''), setGeminiKey: (k) => set(K, String(k || '').trim()),
    checkGeminiKey(k) {
      call(base + '?pageSize=1', k).then((r) => window.__keyChecked?.(JSON.stringify({ ok: r.ok, msg: r.ok ? '' : [400, 401, 403].includes(r.status) ? 'Google refuse cette clé.' : 'Réponse inattendue de Google (' + r.status + ').' })),
        () => window.__keyChecked?.(JSON.stringify({ ok: false, msg: 'Pas de connexion Internet ?' })));
    },
  };
})();

// ---------- IA gratuite : la clé Gemini de la personne, obtenue en 4 touchers ----------
// La page des clés de Google s'ouvre en panneau dans le bas de l'écran ; les 4 touchers restent écrits en haut.
// Quand la personne ferme la page avec le X, l'application lit la clé copiée, la vérifie auprès de Google et l'enregistre.
// Chaque personne utilise SA clé gratuite : l'auteur de l'application n'a rien à payer ni à gérer.
const KeyGuide = {
  ok: () => !!((window.AndroidAI?.openKeyPage && AndroidAI.clip) || window.AndroidAI?.web),
  then: null, active: false, checking: false, lastTried: '',
  find(t) {
    t = String(t || '').trim();
    const m = t.match(/AIza[0-9A-Za-z_\-]{30,}/) || t.match(/\bAQ\.[A-Za-z0-9_\-.]{20,}/); // ancien et nouveau format de Google
    if (m) return m[0];
    return /^[A-Za-z0-9_\-.]{30,200}$/.test(t) ? t : '';
  },
  // then : ce que la personne voulait faire (relancé après le ✅)
  start(then) {
    this.then = then || null;
    if (!this.ok()) return this.manual('');
    if (AndroidAI.web) return this.startWeb();
    try { AndroidAI.keyWarm(); } catch {}
    const close = sheet('IA gratuite en 1 minute', h('div', {},
      h('p', {}, 'Google offre gratuitement son IA, ', h('b', {}, 'Gemini'), '. Il faut seulement une « clé » : un code personnel qui dit à Google que c\'est toi.'),
      h('ol', { class: 'kg-list' },
        h('li', {}, 'La page de Google s\'ouvre en bas de l\'écran.'),
        h('li', {}, 'Les 4 touchers à faire restent écrits en haut.'),
        h('li', {}, 'Tu fermes la page avec le X : l\'application trouve la clé toute seule.')),
      h('p', { class: 'muted' }, '✔ Gratuit, aucune carte de crédit. ✔ La clé reste seulement sur ce téléphone. ℹ️ Avec l\'offre gratuite, Google peut utiliser les textes envoyés pour améliorer son IA.'),
      h('div', { class: 'actions', style: { marginTop: '14px', justifyContent: 'space-between' } },
        h('button', { class: 'btn', onclick: () => { close(); this.manual(''); } }, 'J\'ai déjà une clé'),
        h('button', { class: 'btn primary', onclick: () => { close(); this.open(); } }, icon('spark'), 'C\'est parti'))));
  },
  open() {
    this.panel()?.remove();
    document.body.append(h('div', { class: 'kg-panel', id: 'kgPanel' },
      h('div', { class: 'kg-head' }, 'Dans la page de Google en bas, fais ces 4 touchers :'),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '1'), h('span', {}, 'Appuie sur ', h('span', { class: 'kg-chip' }, 'Créer une clé API'), ' ', h('span', { class: 'kg-where' }, 'en haut à droite'))),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '2'), h('span', {}, 'Une fenêtre s\'ouvre : appuie sur ', h('span', { class: 'kg-chip' }, 'Créer une clé'), ' ', h('span', { class: 'kg-where' }, 'en bas à droite'))),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '3'), h('span', {}, 'Va au bout de la ligne ', h('b', {}, 'Clé API'), ' et appuie sur le petit carré ', h('span', { class: 'kg-chip sq', html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="#3c4043"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>' }), ' Ça fait une copie.')),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '4'), h('span', {}, 'Quand tu as fini, appuie sur le ', h('span', { class: 'kg-chip x' }, '✕'), ' ', h('span', { class: 'kg-where' }, 'en haut à gauche'), ' pour fermer la page. C\'est tout !'))));
    this.active = true;
    AndroidAI.openKeyPage();
  },
  // Version web (iPhone…) : la page de Google s'ouvre dans un nouvel onglet ; en revenant, « Coller ma clé »
  startWeb() {
    const steps = () => h('div', {},
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '1'), h('span', {}, 'Appuie sur ', h('span', { class: 'kg-chip' }, 'Créer une clé API'), ' ', h('span', { class: 'kg-where' }, 'en haut à droite'))),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '2'), h('span', {}, 'Une fenêtre s\'ouvre : appuie sur ', h('span', { class: 'kg-chip' }, 'Créer une clé'), ' ', h('span', { class: 'kg-where' }, 'en bas à droite'))),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '3'), h('span', {}, 'Va au bout de la ligne ', h('b', {}, 'Clé API'), ' et appuie sur le petit carré ', h('span', { class: 'kg-chip sq', html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="#3c4043"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>' }), ' Ça fait une copie.')),
      h('div', { class: 'kg-step' }, h('span', { class: 'kg-num' }, '4'), h('span', {}, 'Reviens ici, à la Bibliothèque, et appuie sur ', h('b', {}, 'Coller ma clé'), '.')));
    const close = sheet('IA gratuite en 1 minute', h('div', {},
      h('p', {}, 'Google offre gratuitement son IA, ', h('b', {}, 'Gemini'), '. Il faut seulement une « clé » : un code personnel qui dit à Google que c\'est toi. La page de Google va s\'ouvrir ; fais-y ces touchers :'),
      steps(),
      h('p', { class: 'muted' }, '✔ Gratuit, aucune carte de crédit. ✔ La clé reste seulement sur cet appareil. ℹ️ Avec l\'offre gratuite, Google peut utiliser les textes envoyés pour améliorer son IA.'),
      h('div', { class: 'actions', style: { marginTop: '14px', justifyContent: 'space-between' } },
        h('button', { class: 'btn', onclick: () => { close(); this.manual(''); } }, 'J\'ai déjà une clé'),
        h('button', { class: 'btn primary', onclick: () => { close(); window.open('https://aistudio.google.com/apikey', '_blank'); this.pasteSheet(steps); } }, icon('spark'), 'Ouvrir la page de Google'))));
  },
  pasteSheet(steps) {
    const close = sheet('Coller ma clé', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, 'Après avoir copié ta clé sur la page de Google, reviens ici :'),
      h('button', { class: 'btn primary', style: { width: '100%', justifyContent: 'center', padding: '16px', fontSize: '17px' }, onclick: async () => {
        let txt = '';
        try { txt = await navigator.clipboard.readText(); } catch { txt = ''; }
        const k = this.find(txt);
        close();
        if (k) { this.lastTried = ''; this.verify(k); } else this.manual(txt ? 'Ce qui est copié n\'est pas une clé : recopie la clé sur la page de Google (le petit carré au bout de la ligne Clé API).' : '');
      } }, icon('copy'), 'Coller ma clé'),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, 'Si l\'iPhone affiche une petite bulle « Coller », appuie dessus.'),
      h('details', { class: 'more' }, h('summary', {}, 'Revoir les étapes'), h('div', { style: { marginTop: '8px' } }, steps(),
        h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: () => window.open('https://aistudio.google.com/apikey', '_blank') }, 'Rouvrir la page de Google')))));
  },
  panel: () => document.getElementById('kgPanel'),
  // l'application reprend la main (page fermée par le X) : on regarde ce qui a été copié
  look() {
    if (!this.active || this.checking) return;
    let open = false; try { open = AndroidAI.keyPageOpen(); } catch {}
    const k = this.find(AndroidAI.clip());
    if (k && k !== this.lastTried) return this.verify(k);
    if (!open) { this.active = false; this.panel()?.remove(); this.notFound(k ? 'Google a refusé la clé copiée. Copie-la de nouveau, sans rien ajouter.' : 'Je n\'ai pas trouvé de clé dans ce que tu as copié.'); }
  },
  verify(k) {
    this.checking = true; this.lastTried = k; this.active = false; this.panel()?.remove();
    const close = sheet('Clé trouvée !', h('div', {}, h('div', { class: 'kg-spin' }), h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Vérification auprès de Google…')));
    window.__keyChecked = (j) => {
      window.__keyChecked = null; this.checking = false; close();
      let r = {}; try { r = JSON.parse(j); } catch {}
      if (!r.ok) return this.notFound((r.msg || 'Google refuse cette clé.') + ' Copie-la de nouveau depuis la page de Google.');
      AndroidAI.setGeminiKey(k);
      const then = this.then; this.then = null;
      const c2 = sheet('IA activée', h('div', {},
        h('div', { class: 'kg-big' }, '✅'),
        h('p', { style: { textAlign: 'center' } }, 'C\'est fait. Le Professeur, les vidéos, les résumés et les synthèses utilisent maintenant ton IA gratuite.'),
        h('div', { class: 'actions', style: { marginTop: '14px', justifyContent: 'center' } },
          h('button', { class: 'btn primary', onclick: () => { c2(); then && then(); } }, 'Continuer'))));
    };
    AndroidAI.checkGeminiKey(k);
  },
  notFound(why) {
    const close = sheet('Pas encore de clé copiée', h('div', {},
      h('p', {}, why),
      h('ol', { class: 'kg-list' },
        h('li', {}, 'Retourne sur la page de Google.'),
        h('li', {}, 'Dans la liste, ta clé est la ligne bleue qui commence par « … ».'),
        h('li', {}, 'Appuie sur le petit carré sur la même ligne, puis ferme la page avec le X.')),
      h('div', { class: 'actions', style: { marginTop: '14px', justifyContent: 'space-between' } },
        h('button', { class: 'btn', onclick: () => { close(); this.manual(''); } }, 'Coller la clé moi-même'),
        h('button', { class: 'btn primary', onclick: () => { close(); this.open(); } }, 'Retourner sur la page'))));
  },
  manual(err) {
    const inp = h('input', { type: 'password', placeholder: 'AQ.… ou AIza…', autocomplete: 'off' });
    const close = sheet('Coller la clé', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, 'Touche longuement la case, puis « Coller ».'),
      h('label', { class: 'field' }, 'Clé', inp),
      err ? h('p', { style: { color: 'var(--danger)' } }, err) : null,
      h('div', { class: 'actions', style: { marginTop: '14px' } },
        h('button', { class: 'btn primary', onclick: () => {
          const k = this.find(inp.value);
          if (!k) { close(); return this.manual('Ce n\'est pas une clé (elle commence par AQ. ou AIza).'); }
          close();
          if (AndroidAI.checkGeminiKey) { this.lastTried = ''; this.verify(k); } else { AndroidAI.setGeminiKey(k); toast('Clé enregistrée'); const t = this.then; this.then = null; t && t(); }
        } }, 'Valider'))));
    setTimeout(() => inp.focus(), 50);
  },
};
window.__focusBack = () => { if (KeyGuide.active) setTimeout(() => KeyGuide.look(), 250); };
window.__keyPageClosed = () => { if (KeyGuide.active) setTimeout(() => KeyGuide.look(), 400); };

// ---------- Le Professeur bizarroïde ----------
// L'IA du téléphone (Gemini Nano) réécrit chaque partie du livre en une explication enjouée, à dire à voix haute.
// Le cours est enregistré dans files/auto/prof/<id>.json : le lecteur audio (téléphone et Android Auto) le joue
// avec une voix plus vivante. On peut l'interrompre pour lui poser une question.
const Prof = {
  on: () => !!(window.AndroidAI && window.AndroidAuto && window.LocalAPI && AndroidAuto.profPlay && AndroidAI.generateOnline),
  // Gemini Nano si le téléphone le permet, sinon Gemini en ligne avec la clé gratuite de la personne
  engine: null,
  async pickEngine(say) {
    if (this.engine) return this.engine;
    let nano = false; try { nano = await this.ensureNano(say); } catch {}
    return (this.engine = nano ? 'nano' : 'online');
  },
  async ai(prompt, say, urgent) {
    const eng = await this.pickEngine(say);
    if (eng === 'nano') return nanoAskRetry(`${this.persona}${this.toneNote()}\n${prompt}`, say);
    return onlineAsk(this.persona + this.toneNote(), prompt, urgent, false, say);
  },
  file: (id) => `prof/${id}.json`,
  info(id) { try { const s = AndroidAuto.readText(this.file(id)); if (!s) return null; const j = JSON.parse(s); return { done: !!j.done, n: j.n || 0, made: (j.parts || []).length, parts: j.parts || [] }; } catch { return null; } },
  who: (b) => `« ${b.title} »${b.author ? ' de ' + b.author : ''}`,
  persona: `Tu es le Professeur bizarroïde : un professeur survolté, passionné et excentrique, qui vibre littéralement pour les idées des livres. Tu parles à voix haute à un auditeur, comme un conteur sur scène. Ne suppose jamais où il se trouve ni ce qu'il fait (route, volant, maison…) : n'en parle pas.
Ton style à l'oral :
- Des phrases courtes et rythmées, qui alternent avec quelques phrases plus longues.
- Beaucoup d'exclamations sincères et d'interjections : « Ah ! », « Oh là là ! », « Tenez-vous bien ! », « Et là… boum ! », « Fascinant, non ? ».
- Des questions lancées à l'auditeur, puis tu y réponds toi-même.
- Des images frappantes, des comparaisons de la vie de tous les jours, un brin d'humour et d'autodérision.
- Des pauses dramatiques avec « … » avant une idée clé.
- Tu tutoies l'auditeur et tu lui parles comme à un ami curieux.
Tu restes fidèle aux idées de l'auteur : tu les présentes telles qu'il les formule, sans les juger ni les ramener à un autre cadre.`,
  clean(t) {
    return t.replace(/\r/g, '').replace(/^\s*#+.*$/gm, '').replace(/^\s*\*\*[^*\n]{1,80}\*\*\s*$/gm, '').replace(/^\s*[-*•]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/\*\*?|__|`/g, '').replace(/\[page \d+\]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  },
  units(parts) {
    const u = [];
    parts.forEach((p, i) => {
      const paras = p.split(/\n{2,}/).map((x) => x.replace(/\n/g, ' ').trim()).filter(Boolean);
      paras.forEach((para, k) => { const s = sentences(para); s.forEach((x, j) => u.push([x, i, j === s.length - 1 ? (k === paras.length - 1 ? 2 : 1) : 0])); });
    });
    return u;
  },
  write(b, work, done) {
    AndroidAuto.writeText(this.file(b.id), JSON.stringify({ v: 1, kind: 'prof', id: b.id, title: b.title, n: work.n, done, parts: work.parts, u: this.units(work.parts) }));
    AutoSync.writeCatalog();
  },
  prompt(b, chunk, i, n, prev) {
    const where = n > 1 ? `la partie ${i + 1} sur ${n} du livre ${this.who(b)}` : `le livre ${this.who(b)}`;
    return `Explique ${where}, à partir de l'extrait ci-dessous.
- Explique les idées et les concepts avec tes propres mots, avec énormément d'énergie et d'émotion : exemples concrets, images frappantes, exclamations, questions à l'auditeur, suspense.
- Ne lis pas l'extrait et ne le recopie pas.
- Reste fidèle aux idées de l'auteur : présente-les telles qu'il les formule, sans les juger ni les ramener à un autre cadre.
- Écris seulement ce qui sera dit à voix haute, en paragraphes : pas de titres, pas de listes, pas de symboles.
- Environ 180 à 250 mots.
${i === 0 ? '- Commence en te présentant en une phrase, avec entrain, et annonce le livre.' : `- Tu viens de dire : « ${prev} ». Enchaîne naturellement, sans saluer de nouveau.`}
${i === n - 1 ? '- Termine par une courte conclusion enthousiaste sur l\'ensemble du livre.' : ''}

Extrait :
${chunk.replace(/\[page \d+\]/g, '')}`;
  },
  async ensureNano(say) {
    let st = await nanoStatus();
    if (st === 'downloadable' || st === 'downloading') {
      say('Préparation de l\'IA du téléphone (téléchargement unique par Android)…');
      try { await nanoDownload((bytes) => say(`Téléchargement de l'IA du téléphone… ${Math.round(bytes / 1e6)} Mo`)); st = 'available'; } catch { st = 'unavailable'; }
    }
    return st === 'available';
  },
  busy: {},
  stopped: {},
  stop(b) { if (this.busy[b.id]) this.stopped[b.id] = true; AndroidAuto.profStop ? AndroidAuto.profStop() : AndroidAuto.profPause(); toast('Cours arrêté. Le Professeur reprendra où il était.'); },
  async prepare(b, restart, autoplay = true) {
    if (this.busy[b.id]) return toast('Le cours est déjà en préparation');
    this.busy[b.id] = true;
    const box = h('div', { class: 'up' }, h('b', {}, 'Professeur : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
    $('#uploads')?.append(box);
    const say = (t) => { $('span', box).textContent = t; };
    const bar = (f) => { const i = $('i', box); i.classList.remove('indet'); i.style.width = Math.round(f * 100) + '%'; };
    // dès que la première partie est prête : un bouton pour écouter tout de suite
    let actions = null;
    const listenBtn = () => {
      if (actions) return;
      actions = h('div', { class: 'prof-row', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: () => AndroidAuto.profPause() }, icon('pause'), 'Pause'),
        h('button', { class: 'btn', onclick: () => AndroidAuto.profPlay(b.id) }, icon('play'), 'Reprendre'),
        h('button', { class: 'btn', onclick: () => this.stop(b) }, icon('stop'), 'Arrêt'));
      box.append(actions);
    };
    try {
      const eng = await this.pickEngine(say);
      const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
      if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?).');
      const chunks = chunkText(t.text);
      const old = restart ? null : this.info(b.id);
      const work = { n: chunks.length, parts: old && old.n === chunks.length ? old.parts : [] };
      for (let i = work.parts.length; i < chunks.length; i++) {
        if (this.stopped[b.id]) { delete this.stopped[b.id]; box.remove(); return; }
        say(i ? `Le Professeur parle · il prépare la partie ${i + 1} sur ${chunks.length}, qui suivra toute seule` : `Le Professeur se prépare… il commencera tout seul dans environ 30 secondes${eng === 'online' ? ' (Gemini)' : ''}`); bar(i / chunks.length);
        if (i) listenBtn();
        const prev = i ? (sentences(work.parts[i - 1]).slice(-2).join(' ')) : '';
        const r = this.clean(await this.ai(this.prompt(b, chunks[i], i, chunks.length, prev), say));
        work.parts.push(r);
        this.write(b, work, i === chunks.length - 1);
        if (i === 0 && autoplay) { AndroidAuto.profPlay(b.id); toast('Le Professeur commence 🎓 La suite se prépare pendant qu\'il parle.'); }
      }
      bar(1); listenBtn();
      say(`✔ Cours complet : ${chunks.length} partie${chunks.length > 1 ? 's' : ''}. Dans Android Auto, il est dans la bibliothèque du livre, avec 🎓 devant le titre.`);
      setTimeout(() => box.remove(), 20000);
      $('b', box).textContent = '🎓 Professeur : ' + b.title;
      toast('Le cours du Professeur est prêt 🎓');
      if (!$('.reader')) renderLibrary();
    } catch (e) {
      say(e.message);
      $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 15000);
    } finally { delete this.busy[b.id]; }
  },
  // Questions : l'IA répond à partir de ce que le Professeur était en train d'expliquer
  where(id, info) {
    let i = 0; try { i = JSON.parse(AndroidAuto.readText('progress.json') || '{}')['prof:' + id]?.i || 0; } catch {}
    let part = 0; try { part = JSON.parse(AndroidAuto.readText(this.file(id))).u[i]?.[1] || 0; } catch {}
    return Math.min(part, Math.max(0, info.parts.length - 1));
  },
  async ask(b, q, out) {
    const info = this.info(b.id); if (!info || !info.made) { out.textContent = 'Le Professeur se prépare encore : pose ta question dès qu\'il aura commencé.'; return; }
    const p = this.where(b.id, info);
    const hmm = ['Ah ! Excellente question… laisse-moi réfléchir une seconde !', 'Oh, j\'adore cette question ! Une petite seconde…', 'Hmm… voilà qui mérite réflexion ! Un instant…'];
    if (AndroidAuto.profThink) AndroidAuto.profThink(hmm[Math.floor(Math.random() * hmm.length)]); else AndroidAuto.profPause();
    out.textContent = 'Le Professeur réfléchit…';
    try {
      const ctx = [info.parts[p - 1], info.parts[p]].filter(Boolean).join('\n\n');
      const r = this.clean(await this.ai(`L'auditeur t'interrompt pendant ton explication du livre ${this.who(b)} pour te poser une question.
Voici ce que tu étais en train d'expliquer :
${ctx}
${b.summary?.text ? '\nRésumé du livre entier :\n' + b.summary.text.slice(0, 2500) + '\n' : ''}
Réponds en 3 à 6 phrases, avec beaucoup d'entrain, comme à voix haute : pas de listes ni de symboles.
Si la réponse n'est pas dans le livre, dis-le franchement, puis donne ton propre éclairage en précisant que c'est ton avis.
Termine en annonçant, en quelques mots, que tu reprends le cours.

Question : ${q}`, (m) => { out.textContent = m; }, true));
      out.textContent = r;
      AndroidAuto.profAnswer(b.id, r);
    } catch (e) { out.textContent = e.message; }
  },
  // Touche « Professeur » : le cours démarre (ou se prépare puis démarre tout seul), et la préparation continue s'il en manque
  // Voix, ton et vitesse du Professeur (cours, réponses aux questions, vidéos)
  // 3 tons bien distincts (avant : 6, trop semblables à l'oreille)
  tones: [['passionne', 'Passionné', 'aigu, rapide, très vivant'], ['serieux', 'Sérieux', 'grave, posé, sobre'], ['conteur', 'Conteur', 'lent et chaleureux']],
  tone: () => ({ enjoue: 'passionne', naturel: 'serieux', calme: 'conteur' })[store.get('profTone', 'passionne')] || store.get('profTone', 'passionne'),
  speed: () => store.get('profSpeed', 1),
  toneNote() {
    return { conteur: '\nTon ton : celui d\'un conteur, posé, chaleureux et imagé, qui prend son temps : peu d\'exclamations.',
      serieux: '\nTon ton : sobre, posé et rigoureux, comme un bon conférencier : presque pas d\'exclamations, pas de bruitages ni d\'onomatopées.' }[this.tone()] || '';
  },
  voicePicker() {
    let vs = []; try { vs = JSON.parse(AndroidAuto.profVoices?.() || '[]'); } catch {}
    const sample = { passionne: 'Ah ! Bonjour, bonjour ! Je suis le Professeur bizarroïde… et aujourd\'hui, tiens-toi bien, on part à l\'aventure !',
      enjoue: 'Bonjour ! Je suis le Professeur. Aujourd\'hui, on découvre ce livre ensemble, tu vas voir, c\'est passionnant.',
      conteur: 'Il était une fois un livre… et dans ce livre, une idée qui allait tout changer. Écoute bien.',
      naturel: 'Bonjour, je suis le Professeur. Voici ce que ce livre nous apprend.',
      serieux: 'Examinons maintenant l\'idée centrale de ce livre, avec rigueur, étape par étape.',
      calme: 'Installe-toi confortablement. Nous allons parcourir ce livre doucement, ensemble.' };
    const cur = store.get('profVoice', '');
    const sel = vs.length >= 2 ? h('select', {}, h('option', { value: '' }, 'Automatique : une voix par ton'), vs.map((v) => h('option', { value: v.name, selected: v.name === cur }, v.label))) : null;
    const speedLbl = h('b', {}, '');
    const showSpeed = () => { speedLbl.textContent = (Math.round(this.speed() * 100) / 100).toString().replace('.', ',') + '×'; };
    const hear = () => {
      try { if (sel) { store.set('profVoice', sel.value); AndroidAuto.profSetVoice(sel.value, ''); } } catch {}
      try { AndroidAuto.profSetStyle?.(this.tone(), this.speed(), sample[this.tone()] || sample.passionne); } catch {}
    };
    const chips = h('div', { class: 'prof-tones' }, this.tones.map(([k, name, hint]) => h('button', { class: 'chip' + (this.tone() === k ? ' on' : ''), title: hint, onclick: (e) => {
      store.set('profTone', k); chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); hear();
    } }, name, h('small', {}, hint))));
    const range = h('input', { type: 'range', min: '0.7', max: '1.5', step: '0.05', value: String(this.speed()), oninput: (e) => { store.set('profSpeed', +e.target.value); showSpeed(); }, onchange: hear });
    showSpeed();
    if (sel) sel.onchange = hear;
    return h('details', { class: 'more' }, h('summary', {}, 'Voix, ton et vitesse du Professeur'),
      h('div', { style: { marginTop: '10px' } },
        h('p', { class: 'muted', style: { margin: '0 0 8px' } }, 'Chaque ton a sa propre voix, son allure et sa façon d\'écrire les cours ; il te le fait entendre aussitôt. (Avec une voix choisie à la main plus bas, les 3 tons gardent cette voix.)'),
        chips,
        h('div', { class: 'prof-row', style: { alignItems: 'center', marginTop: '10px' } }, h('span', {}, 'Vitesse'), range, speedLbl),
        sel ? h('div', { class: 'prof-row', style: { marginTop: '10px' } }, sel, h('button', { class: 'btn', onclick: hear }, icon('play'), 'Écouter')) : h('div', { class: 'prof-row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: hear }, icon('play'), 'Écouter'))));
  },
  clean0: (t) => String(t || '').replace(/\r/g, '').replace(/^```\w*\n?|```$/g, '').trim(),
  hasKey: () => { try { return !!AndroidAI.hasGeminiKey(); } catch { return false; } },
  // la clé Gemini gratuite : parcours guidé (une seule fois)
  askKey(then) { KeyGuide.start(then); },
  async go(b) {
    const eng = await this.pickEngine(() => {});
    if (eng === 'online' && !this.hasKey()) { this.askKey(() => this.open(b)); return false; }
    const info = this.info(b.id);
    if (info?.made) AndroidAuto.profPlay(b.id);
    if (!info?.done && !this.busy[b.id]) this.prepare(b, false, !info?.made);
    return true;
  },
  async open(b) {
    if (!Premium.need('prof')) return;
    if ((await this.go(b)) === false) return;
    const info = this.info(b.id);
    const q = h('textarea', { placeholder: 'Ta question au Professeur…' });
    const out = h('div', { class: 'prof-answer', style: { display: 'none' } });
    const send = () => { const v = q.value.trim(); if (!v) return toast('Écris ou dicte ta question'); out.style.display = ''; this.ask(b, v, out); q.value = ''; };
    const mic = window.AndroidAuto.listen ? h('button', { class: 'btn', 'aria-label': 'Dicter', onclick: () => {
      AndroidAuto.profPause(); // sinon la dictée entend la voix du Professeur au lieu de la tienne
      window.__heard = (t) => { window.__heard = null; if (t) { q.value = t; send(); } };
      setTimeout(() => AndroidAuto.listen(), 450);
    } }, icon('mic')) : null;
    const ready = info && info.made;
    if (!store.get('profMic', 0)) { store.set('profMic', 1); try { AndroidAI.askMic?.(); } catch {} }
    const close = profSheet('Le Professeur bizarroïde', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
      h('div', { class: 'aiopt' },
        h('h4', {}, ready ? 'Le Professeur parle 🎓' : 'Le Professeur se prépare…'),
        h('p', {}, ready
          ? (info.done ? 'Le cours est complet. ' : 'Les parties suivantes se préparent pendant qu\'il parle et s\'enchaînent toutes seules : garde l\'application ouverte jusqu\'à la fin de la préparation. ')
            + 'Dans Android Auto, le cours est dans la bibliothèque du livre, avec 🎓 devant le titre.'
          : 'Il commence tout seul dans environ 30 secondes, puis enchaîne les parties suivantes au fur et à mesure. Garde l\'application ouverte pendant la préparation (Internet requis).'),
        h('div', { class: 'prof-row' },
          h('button', { class: 'btn', onclick: () => AndroidAuto.profPause() }, icon('pause'), 'Pause'),
          h('button', { class: 'btn', onclick: () => this.go(b) }, icon('play'), 'Reprendre'),
          h('button', { class: 'btn', onclick: () => { close(); this.stop(b); } }, icon('stop'), 'Arrêt'))),
      h('div', { class: 'aiopt' },
        h('h4', {}, 'Poser une question'),
        h('p', {}, 'Le cours se met en pause, le Professeur te répond à voix haute, puis il reprend où il était.'),
        h('div', { class: 'prof-ask' }, q, mic, h('button', { class: 'btn primary', onclick: send }, 'Demander')),
        out),
      ready && info.done ? h('details', { class: 'more' }, h('summary', {}, 'Autres options'),
        h('div', { class: 'prof-row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => { close(); AndroidAuto.profPause(); this.prepare(b, true); } }, icon('refresh'), 'Refaire le cours'))) : null,
      this.voicePicker(),
      this.engine === 'online' ? h('details', { class: 'more' }, h('summary', {}, 'IA gratuite (clé Gemini)'),
        h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => { close(); this.askKey(); } }, icon('refresh'), 'Changer la clé'))) : null), { wide: true });
  },
};

// ---------- Condensé vidéo MP4 ----------
// Gemini écrit un condensé en scènes (phrase choc, narration, recherche d'images) ;
// le téléphone trouve des images libres, enregistre la voix et monte un vrai fichier MP4.
const Video = {
  on: () => !!(window.AndroidVideo && window.AndroidAI?.generateOnline && window.LocalAPI),
  exists: (id) => { try { return !!AndroidVideo.exists(id); } catch { return false; } },
  jobs: {},
  prompt(b, text, words, summary) {
    const target = Math.max(600, Math.min(2200, Math.round(words * 0.06)));
    const scenes = Math.max(5, Math.min(18, Math.round(target / 130)));
    return `Tu prépares le « condensé vidéo » du livre « ${b.title} »${b.author ? ' de ' + b.author : ''}.
Ce n'est ni un résumé ni le livre entier : c'est un condensé qui va droit au but et transmet les grands messages du livre, avec force et clarté.
${summary ? `Voici le résumé détaillé du livre. Il sert de colonne vertébrale : CHAQUE grand message, concept et idée clé de ce résumé doit se retrouver dans le condensé, développé avec les arguments, exemples et explications précises tirés du livre. Le condensé doit être plus riche et plus pertinent que ce résumé, jamais moins.
<resume>
${summary}
</resume>
` : ''}Construis d'abord mentalement le plan des grands messages, puis écris les scènes : chacune porte UNE idée forte, expliquée clairement, avec son « pourquoi » et ce que l'auditeur doit en retenir. Évite le remplissage et les généralités.
Écris environ ${target} mots de narration au total, répartis en ${scenes} scènes environ, dans l'ordre du livre.
Pour chaque scène :
- "phrase" : une phrase choc que TU formules (jamais recopiée du livre), 15 mots au plus, qui dit le message de la scène.
- "narration" : le texte dit à voix haute, vivant et passionné (exclamations, questions à l'auditeur, images frappantes), en tutoyant l'auditeur, sans supposer où il se trouve. Pas de listes ni de symboles.
- "images" : 4 recherches d'images courtes en ANGLAIS (2 à 4 mots), propres à CETTE scène : 3 choses concrètes et photographiables tirées de son contenu précis (lieux, objets, personnes au travail, phénomènes, époques), et 1 œuvre évocatrice pour l'idée abstraite de la scène (ex. « surreal painting time », « vintage engraving laboratory », « symbolic illustration unity »). Varie d'une scène à l'autre et évite les images passe-partout (cerveau, livres, ciel étoilé, galaxie, ampoule, points d'interrogation). Les images trouvées seront ensuite triées par une IA qui les regarde : vise juste plutôt que large.
Reste fidèle aux idées de l'auteur : présente-les telles qu'il les formule, sans les juger ni les ramener à un autre cadre.
Dans les textes, n'utilise jamais de guillemets droits ("). Pour citer, utilise les guillemets français « ».
Réponds UNIQUEMENT avec du JSON valide, sans texte autour, de la forme :
{"scenes":[{"phrase":"…","narration":"…","images":["…","…"]}]}

<livre>
${text}
</livre>`;
  },
  parse(raw) {
    let t = String(raw || '').replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    const a = t.indexOf('{'), z = t.lastIndexOf('}');
    if (a < 0 || z <= a) throw new Error('Gemini n\'a pas renvoyé de scénario lisible. Réessaie.');
    t = t.slice(a, z + 1);
    let j;
    try { j = JSON.parse(t); }
    catch { j = JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[\u201C\u201D]/g, '«')); } // petites fautes courantes
    if (!Array.isArray(j.scenes) || !j.scenes.length) throw new Error('Le scénario de Gemini est vide. Réessaie.');
    j.scenes = j.scenes.filter((s) => s && typeof s.narration === 'string' && s.narration.trim()).map((s) => ({
      phrase: String(s.phrase || '').trim(), narration: Prof.clean(String(s.narration)), images: (Array.isArray(s.images) ? s.images : []).map(String).slice(0, 4) }));
    return j;
  },
  async create(b) {
    if (!Prof.hasKey()) return Prof.askKey(() => this.create(b));
    if (AndroidVideo.busy()) return toast('Une vidéo est déjà en préparation.');
    stopAllAudio();
    const box = h('div', { class: 'up' }, h('b', {}, '🎬 Vidéo : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })),
      h('div', { class: 'prof-row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => { AndroidVideo.cancel(); this.jobs[b.id] = 'cancel'; } }, icon('stop'), 'Annuler')));
    $('#uploads')?.append(box);
    const say = (t) => { $('span', box).textContent = t; };
    const bar = (f) => { const i = $('i', box); i.classList.remove('indet'); i.style.width = Math.round(f * 100) + '%'; };
    const fail = (m) => { say(m); $('span', box).style.color = 'var(--danger)'; $('.prof-row', box)?.remove(); setTimeout(() => box.remove(), 15000); };
    this.jobs[b.id] = 'run';
    try {
      const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
      if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?).');
      if (this.jobs[b.id] === 'cancel') throw new Error('Création de la vidéo annulée.');
      // 1) le résumé détaillé (celui du livre s'il a déjà été fait par une IA), 2) le scénario construit dessus
      let summary = b.summary?.text && b.summary.model && b.summary.model !== 'auto' ? b.summary.text : '';
      const book = condense(t.text, 300000);
      if (!summary) {
        say('Gemini lit le livre et en dégage les grands messages… (environ une minute)');
        try {
          summary = Prof.clean0(await onlineAsk('', `${SUMMARY_PROMPT}\n\nTitre : ${b.title}${b.author ? '\nAuteur : ' + b.author : ''}\n\n<livre>\n${book}\n</livre>`, false, false, say));
          // le résumé sert aussi dans la Bibliothèque
          if (summary) { try { await post('/api/books/' + b.id, { summary: { text: summary, date: Date.now(), model: /pro/.test(window.__lastModel || '') ? 'gemini-pro' : 'gemini', truncated: t.truncated } }, 'PATCH'); } catch {} }
        } catch { summary = ''; }
      }
      if (this.jobs[b.id] === 'cancel') throw new Error('Création de la vidéo annulée.');
      say('Gemini écrit le scénario du condensé… (environ une minute)');
      const words = t.text.split(/\s+/).length;
      const raw = await onlineAsk('', this.prompt(b, book, words, summary), false, true, say);
      let script;
      try { script = this.parse(raw); }
      catch {
        // scénario mal formé : Gemini le corrige lui-même
        say('Gemini corrige le format du condensé…');
        script = this.parse(await onlineAsk('', `Le texte ci-dessous devait être du JSON valide de la forme {"scenes":[{"phrase":"…","narration":"…","images":["…","…"]}]} mais il contient une erreur de syntaxe. Renvoie exactement le même contenu, corrigé en JSON valide (remplace les guillemets droits à l'intérieur des textes par « »). Rien d'autre.\n\n${raw}`, false, true));
      }
      if (this.jobs[b.id] === 'cancel') throw new Error('Création de la vidéo annulée.');
      say(`Condensé prêt : ${script.scenes.length} scènes. Recherche des images…`);
      await new Promise((res, rej) => {
        window.__videoProgress = (j) => {
          const r = JSON.parse(j); if (r.id !== b.id) return;
          if (r.error) { window.__videoProgress = null; return rej(new Error(r.error)); }
          if (r.done) { window.__videoProgress = null; return res(); }
          const w = { images: [0, 0.25], voice: [0.25, 0.25], audio: [0.5, 0.02], encode: [0.52, 0.48] }[r.stage] || [0, 0];
          bar(w[0] + w[1] * (r.frac || 0)); say(r.msg + ' · garde l\'application ouverte');
        };
        AndroidVideo.make(b.id, b.title, b.author || '', JSON.stringify(script));
      });
      box.remove();
      toast('🎬 La vidéo est prête !');
      this.open(b);
    } catch (e) { fail(e.message); }
    finally { delete this.jobs[b.id]; }
  },
  open(b) {
    const ready = this.exists(b.id);
    const busy = !!this.jobs[b.id];
    const close = sheet('Condensé vidéo', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
      h('div', { class: 'aiopt' },
        h('h4', {}, ready ? 'La vidéo est prête 🎬' : busy ? 'La vidéo se prépare…' : 'Le livre en vidéo'),
        h('p', {}, ready
          ? 'Un condensé du livre, en images, avec la voix du Professeur et les phrases choc à l\'écran.'
          : 'Gemini écrit un condensé du livre (entre le résumé et le livre complet), le téléphone trouve des images libres de droits pour chaque scène, enregistre la voix et monte un fichier MP4. Compte de 5 à 15 minutes ; garde l\'application ouverte.'),
        h('div', { class: 'prof-row' },
          ready ? h('button', { class: 'btn primary', onclick: () => { if (!AndroidVideo.play(b.id)) toast('Aucun lecteur vidéo trouvé sur le téléphone.'); } }, icon('play'), 'Regarder') : null,
          ready ? h('button', { class: 'btn', onclick: () => { const r = AndroidVideo.save(b.id, b.title); toast(r || 'Vidéo enregistrée dans ta Galerie (Films › Bibliotheque)'); } }, icon('download'), 'Télécharger') : null,
          ready ? h('button', { class: 'btn', onclick: () => AndroidVideo.share(b.id, b.title) }, icon('share'), 'Partager') : null,
          ready && Tele.on() ? h('button', { class: 'btn', onclick: () => { close(); Tele.open(b.id); } }, icon('tvplay'), 'Sur la télé') : null,
          !ready && !busy ? h('button', { class: 'btn primary', onclick: () => { close(); this.create(b); } }, icon('film'), 'Créer la vidéo') : null,
          // bien en vue : refaire avec les dernières améliorations (images, son…)
          ready && !busy ? h('button', { class: 'btn', onclick: () => { close(); this.create(b); } }, icon('refresh'), 'Refaire la vidéo') : null)),
      ready ? h('details', { class: 'more' }, h('summary', {}, 'Autres options'),
        h('div', { class: 'prof-row', style: { marginTop: '10px' } },
          h('button', { class: 'btn', onclick: () => { AndroidVideo.remove(b.id); close(); toast('Vidéo supprimée'); } }, icon('trash'), 'Supprimer'))) : null), { wide: true });
  },
};

// ---------- Vidéo sur la télé en un clic (Google Cast) ----------
const Tele = {
  on: () => !!(window.AndroidTele && !TV.on),
  videos() { let ids = []; try { ids = JSON.parse(AndroidTele.videos() || '[]'); } catch {} return ids.map((id) => S.books.find((b) => b.id === id)).filter(Boolean); },
  open(pickId) {
    const vids = this.videos();
    if (!vids.length) return toast('Aucune vidéo pour l\'instant : crée-en une (appui long sur un livre › Vidéo).');
    const sel = h('select', {}, vids.map((b) => h('option', { value: b.id, selected: b.id === pickId }, b.title)));
    const list = h('div', { class: 'libs' }, h('p', { class: 'muted' }, 'Recherche des télés…'));
    const status = h('p', { class: 'muted', style: { margin: '10px 0 0' } });
    const controls = h('div', { class: 'prof-row', style: { marginTop: '10px', display: 'none' } },
      h('button', { class: 'btn', onclick: () => AndroidTele.seek(-30) }, '−30 s'),
      h('button', { class: 'btn', onclick: () => AndroidTele.pause() }, icon('pause'), 'Pause'),
      h('button', { class: 'btn', onclick: () => AndroidTele.play() }, icon('play'), 'Lecture'),
      h('button', { class: 'btn', onclick: () => AndroidTele.seek(30) }, '+30 s'),
      h('button', { class: 'btn', onclick: () => AndroidTele.stop() }, icon('stop'), 'Arrêter'));
    window.__teleDevices = (j) => {
      const r = JSON.parse(j);
      if (r.error) return list.replaceChildren(h('p', { class: 'muted' }, r.error));
      list.replaceChildren(...(r.devices.length ? r.devices.map((d) => h('button', { class: 'librow', onclick: () => {
        const b = S.books.find((x) => x.id === sel.value);
        AndroidTele.cast(d.id, sel.value, b ? b.title : 'Bibliothèque');
      } }, h('span', { class: 'libsw', style: { '--sw': '#3e5566' } }), h('span', {}, h('b', {}, d.name), h('small', {}, d.desc || 'Google Cast'))))
        : [h('p', { class: 'muted' }, 'Aucune télé Google Cast trouvée pour l\'instant. Vérifie que la télé est allumée et que le téléphone est sur le même Wi-Fi.')]));
    };
    window.__teleState = (j) => {
      const r = JSON.parse(j);
      status.textContent = r.msg; status.style.color = r.state === 'error' ? 'var(--danger)' : '';
      controls.style.display = ['playing', 'loading'].includes(r.state) ? '' : 'none';
    };
    const close = sheet('Vidéo sur la télé', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, 'La télé lit la vidéo directement, par le Wi-Fi ; ton téléphone sert de télécommande. Fonctionne avec Chromecast, Google TV et les télés « Chromecast intégré ».'),
      h('label', { class: 'field' }, 'Vidéo', sel),
      h('div', { class: 'field' }, 'Choisis la télé'),
      list, status, controls), { wide: true });
    AndroidTele.startScan();
    // la recherche s'arrête quand la fenêtre se ferme
    const watch = setInterval(() => { if (!$('.scrim')) { clearInterval(watch); AndroidTele.stopScan(); } }, 1000);
    return close;
  },
};

// ---------- Résumé automatique (sans IA, fonctionne partout) ----------
const STOP = new Set(('a à au aux avec ce ces cet cette c ça d dans de des du elle elles en et eux il ils je j la le les leur leurs l lui ma mais me même mes moi mon ne n nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y été être est sont était étaient a ai as avons avez ont avait avaient sera seront fait faire plus moins très tout tous toute toutes aussi ainsi alors comme donc car si sans sous entre vers chez dont cela celui celle ceux celles leur peut peuvent bien encore autre autres deux trois un une non oui là ici cet chaque quand comment pourquoi lorsque puis après avant depuis pendant tandis selon contre the of and to in is that for it as with be on are this by was'.split(' ')));
const words = (t) => (t.toLowerCase().match(/[a-zà-ÿœæ][a-zà-ÿœæ'-]{2,}/g) || []).map((w) => w.replace(/^[a-z]'/, '')).filter((w) => w.length > 3 && !STOP.has(w));
function splitSentences(t) {
  return t.replace(/^#{1,6}\s.*$/gm, '\n').replace(/\[page \d+\]/g, ' ').split(/\n{2,}/).flatMap((para) => para.replace(/\s+/g, ' ').split(/(?<=[.!?…»])\s+(?=[A-ZÀ-ÖØ-Ý«"(])/)).map((x) => x.trim()).filter((x) => x.length > 40 && x.length < 600 && /[a-zà-ÿ]{3}/.test(x) && (x.match(/[a-zà-ÿ]/gi) || []).length / x.length > .6);
}
function rankSentences(sents, freq) {
  return sents.map((x, i) => { const w = words(x); const sc = w.reduce((a, k) => a + (freq.get(k) || 0), 0) / Math.pow(Math.max(8, w.length), .75); return { x, i, sc }; });
}
// coupe le livre en parties : titres (Word/texte) sinon tranches de pages
function bookParts(text, title) {
  const heads = [...text.matchAll(/^#\s+(.{2,90})$/gm)];
  if (heads.length >= 3 && heads.length <= 60) {
    const parts = []; for (let i = 0; i < heads.length; i++) parts.push({ name: heads[i][1].trim(), text: text.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : undefined) });
    return parts.filter((p) => p.text.length > 300);
  }
  const pages = text.split(/\[page (\d+)\]/); // ['', '1', txt, '2', txt…]
  if (pages.length > 3) {
    const list = []; for (let i = 1; i < pages.length; i += 2) list.push({ n: +pages[i], t: pages[i + 1] || '' });
    const k = Math.min(8, Math.max(2, Math.round(list.length / 15))); const per = Math.ceil(list.length / k); const parts = [];
    for (let i = 0; i < list.length; i += per) { const sl = list.slice(i, i + per); parts.push({ name: `Pages ${sl[0].n} à ${sl.at(-1).n}`, text: sl.map((x) => x.t).join('\n') }); }
    return parts;
  }
  const k = Math.min(6, Math.max(1, Math.round(text.length / 15000))); const per = Math.ceil(text.length / k); const parts = [];
  for (let i = 0; i < k; i++) parts.push({ name: `Partie ${i + 1}`, text: text.slice(i * per, (i + 1) * per) });
  return parts;
}
function autoSummary(text, title) {
  const all = splitSentences(text);
  if (all.length < 3) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?). Essaie « Avec ton application d\'IA ».');
  const freq = new Map(); for (const w of words(text)) freq.set(w, (freq.get(w) || 0) + 1);
  const norm = (x) => x.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, ' ').trim();
  const seen = new Map(); for (const x of all) seen.set(norm(x), (seen.get(norm(x)) || 0) + 1); // phrases répétées dans le livre
  const used = []; // tout ce qui est déjà dans le résumé : pas de redite
  const wset = (x) => new Set(words(x));
  const similar = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size, b.size)); };
  const pick = (sents, n, pool = used) => {
    const r = rankSentences(sents, freq).map((o) => ({ ...o, sc: o.sc / (seen.get(norm(o.x)) || 1), w: wset(o.x) })).sort((a, b) => b.sc - a.sc);
    const out = [];
    for (const o of r) { if (out.length >= n) break; if (pool.some((u) => similar(o.w, u) > .6)) continue; out.push(o); pool.push(o.w); }
    return out.sort((a, b) => a.i - b.i).map((o) => o.x);
  };
  const parts = bookParts(text, title).map((p) => ({ ...p, sents: splitSentences(p.text) })).filter((p) => p.sents.length);
  // L'essentiel : la phrase la plus forte de chaque partie, réparties sur tout le livre
  const step = Math.max(1, Math.ceil(parts.length / 5));
  let ess = []; for (let i = 0; i < parts.length && ess.length < 5; i += step) ess.push(...pick(parts[i].sents, 1));
  if (ess.length < 3) ess.push(...pick(all, 5 - ess.length));
  const top = [...freq.entries()].filter(([w]) => !title.toLowerCase().includes(w)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  let md = `## L'essentiel\n${ess.map((x) => '- ' + x).join('\n')}\n\n## Par parties\n`;
  for (const part of parts) { const got = pick(part.sents, part.sents.length > 40 ? 3 : 2); if (got.length) md += `### ${part.name}\n${got.map((x) => '- ' + x).join('\n')}\n`; }
  // Phrases clés : les phrases courtes les plus fortes, réparties dans le livre
  const short = all.filter((x) => { const n = x.split(/\s+/).length; return n >= 5 && n <= 16; });
  const keys = pick(short.length >= 4 ? short : all, 6, []);
  if (keys.length) md += `\n## Phrases clés\n${keys.map((x) => '- ' + x).join('\n')}\n`;
  md += `\n## Mots-clés\n${top.join(' · ')}`;
  return md;
}
// réduit un texte trop long en gardant ses phrases les plus importantes (dans l'ordre)
function condense(text, maxChars) {
  if (text.length <= maxChars) return text;
  const freq = new Map(); for (const w of words(text)) freq.set(w, (freq.get(w) || 0) + 1);
  const block = 20000; let out = '';
  for (let i = 0; i < text.length; i += block) {
    const piece = text.slice(i, i + block); const budget = Math.floor(piece.length * maxChars / text.length);
    const r = rankSentences(splitSentences(piece), freq).sort((a, b) => b.sc - a.sc); const keep = []; let n = 0;
    for (const o of r) { if (n + o.x.length > budget) continue; keep.push(o); n += o.x.length + 1; }
    out += keep.sort((a, b) => a.i - b.i).map((o) => o.x).join(' ') + '\n\n';
  }
  return out;
}

// ---------- IA du téléphone (Gemini Nano) ----------
function nanoStatus() { return new Promise((res) => { window.__aiStatus = (s) => { window.__aiStatus = null; res(s); }; AndroidAI.status(); }); }
function nanoDownload(onp) {
  return new Promise((res, rej) => { window.__aiDownload = (s) => { if (s.startsWith('progress:')) return onp(+s.slice(9)); window.__aiDownload = null; s === 'done' ? res() : rej(new Error('Téléchargement de l\'IA impossible : ' + s.slice(6))); }; AndroidAI.download(); });
}
let nanoSeq = 0;
function nanoAsk(prompt) {
  const id = 'q' + (++nanoSeq);
  // plusieurs demandes peuvent attendre en même temps (ex. une question pendant la préparation du cours)
  const wait = (window.__aiWait ||= {});
  window.__aiResult = (j) => { const r = JSON.parse(j); const f = wait[r.id]; if (!f) return; delete wait[r.id]; f(r); };
  return new Promise((res, rej) => { wait[id] = (r) => (r.error ? rej(new Error(r.error)) : res((r.text || '').trim())); AndroidAI.generate(id, prompt); });
}
// Gemini en ligne, avec la clé gratuite de la personne : pour les téléphones sans Gemini Nano. Les demandes sont espacées côté Android.
// say : la phrase d'étape de la carte en cours (« Gemini Pro est occupé : nouvel essai dans 40 s… »)
window.__aiProgress = (j) => { try { const r = JSON.parse(j); window.__aiSays?.[r.id]?.(r.msg); } catch {} };
function onlineAsk(system, prompt, urgent, json, say) {
  const id = 'o' + (++nanoSeq);
  if (say) (window.__aiSays ||= {})[id] = say;
  const wait = (window.__aiWait ||= {});
  window.__aiResult = (j) => { const r = JSON.parse(j); const f = wait[r.id]; if (!f) return; delete wait[r.id]; f(r); };
  return new Promise((res, rej) => { wait[id] = (r) => { if (window.__aiSays) delete window.__aiSays[id]; if (r.model) window.__lastModel = r.model; return r.error ? rej(new Error(r.error)) : res((r.text || '').trim()); }; (json && AndroidAI.generateJson ? AndroidAI.generateJson : urgent && AndroidAI.generateUrgent ? AndroidAI.generateUrgent : AndroidAI.generateOnline).call(AndroidAI, id, system || '', prompt); });
}
async function nanoAskRetry(prompt, say) {
  for (let t = 0; ; t++) {
    try { const r = await nanoAsk(prompt); if (r) return r; throw new Error('réponse vide'); }
    catch (e) {
      if (t >= 3) throw new Error('L\'IA du téléphone n\'a pas pu répondre (' + e.message + '). Garde l\'application ouverte pendant la préparation, puis réessaie : elle reprendra où elle en était.');
      say(`L'IA du téléphone est occupée, nouvel essai dans ${10 * (t + 1)} s…`); await new Promise((r) => setTimeout(r, 10000 * (t + 1)));
    }
  }
}
const CHUNK = 6000, MAX_CHUNKS = 24;
function chunkText(text) {
  const out = []; let cur = '';
  for (const para of text.split(/\n{2,}|(?=\[page \d+\])/)) {
    if (cur.length + para.length > CHUNK && cur) { out.push(cur); cur = ''; }
    if (para.length > CHUNK) { for (let i = 0; i < para.length; i += CHUNK) out.push(para.slice(i, i + CHUNK)); continue; }
    cur += (cur ? '\n\n' : '') + para;
  }
  if (cur.trim()) out.push(cur); return out.filter((c) => c.replace(/\[page \d+\]|\s/g, '').length > 100);
}
async function nanoSummary(b, text, say) {
  const who = `« ${b.title} »${b.author ? ' de ' + b.author : ''}`;
  const chunks = chunkText(condense(text, CHUNK * MAX_CHUNKS));
  const key = 'sumwork.' + b.id; let work = store.get(key, null);
  if (!work || work.n !== chunks.length) work = { n: chunks.length, parts: [] };
  for (let i = work.parts.length; i < chunks.length; i++) {
    say(`IA du téléphone : lecture de la partie ${i + 1} sur ${chunks.length}…`);
    const r = await nanoAskRetry(`Voici un extrait (partie ${i + 1} sur ${chunks.length}) du livre ${who}.\nRésume-le en français en 4 à 6 phrases claires et fidèles. Garde les idées, les concepts et les noms importants. N'ajoute rien qui n'est pas dans l'extrait, et ne commente pas.\n\nExtrait :\n${chunks[i].replace(/\[page \d+\]/g, '')}`, say);
    work.parts.push(r); store.set(key, work);
  }
  let parts = work.parts;
  while (parts.join('\n\n').length > CHUNK) { // fusion par étapes si les résumés partiels sont trop longs
    const groups = []; let cur = [];
    for (const x of parts) { if ((cur.join('\n\n') + x).length > CHUNK && cur.length) { groups.push(cur); cur = []; } cur.push(x); }
    if (cur.length) groups.push(cur);
    if (groups.length === parts.length) break;
    const next = [];
    for (let g = 0; g < groups.length; g++) { say(`IA du téléphone : assemblage ${g + 1} sur ${groups.length}…`); next.push(await nanoAskRetry(`Voici les résumés de parties successives du livre ${who}. Fusionne-les en un seul résumé en français de 6 à 10 phrases, fidèle et dans l'ordre, sans commentaire.\n\n${groups[g].join('\n\n')}`, say)); }
    parts = next;
  }
  say('IA du téléphone : rédaction du résumé final…');
  const fin = await nanoAskRetry(`Voici les résumés, dans l'ordre, des parties du livre ${who}.\nÉcris en français un résumé structuré du livre entier, avec exactement ces titres :\n## L'essentiel\n(3 ou 4 phrases sur l'idée centrale)\n## Le déroulement\n(une ligne par grande étape du livre)\n## Les idées clés\n(une liste de 4 à 6 points)\n## À retenir\n(une liste de 5 points)\nReste fidèle au texte : présente les idées de l'auteur telles qu'il les formule, sans les juger ni les ramener à un autre cadre. Pas de préambule.\n\nRésumés des parties :\n${parts.map((x, i) => `${i + 1}. ${x}`).join('\n\n')}`, say);
  say('IA du téléphone : phrases clés…');
  let keys = '';
  try {
    keys = await nanoAskRetry(`Voici le résumé du livre ${who}.\nÉcris les phrases clés du livre : ${KEYS_RULE}\nUne phrase par ligne, chaque ligne commence par « - ». Rien d'autre.\n\n${fin}`, say);
    keys = keys.split('\n').map((x) => x.trim()).filter((x) => /^[-•*]\s+\S/.test(x)).map((x) => '- ' + x.replace(/^[-•*]\s+/, '')).slice(0, 8).join('\n');
  } catch {}
  store.set(key, null);
  return fin.replace(/\n*#{1,3}\s*Phrases clés[\s\S]*$/i, '') + (keys ? `\n\n## Phrases clés\n${keys}` : '');
}

// Résumé gratuit d'un livre, sans fenêtre : IA du téléphone, Gemini en ligne si une clé existe, sinon résumé automatique
async function computeSummary(b, say) {
    const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
    if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?). Essaie « Avec ton application d\'IA ».');
    let text = null, model = 'auto';
    if (window.AndroidAI?.generateOnline && Prof.hasKey()) { // ta clé gratuite : Gemini lit le livre en entier
      say('Gemini rédige le résumé… (environ une minute)');
      try {
        text = Prof.clean0(await onlineAsk('', `${SUMMARY_PROMPT}\n\nTitre : ${b.title}${b.author ? '\nAuteur : ' + b.author : ''}\n\n<livre>\n${condense(t.text, 900000)}\n</livre>`, false, false, say));
        model = /pro/.test(window.__lastModel || '') ? 'gemini-pro' : 'gemini';
      } catch (e) { say('Gemini indisponible (' + e.message + ') : IA du téléphone…'); text = null; }
    }
    if (!text && window.AndroidAI) {
      say('Recherche de l\'IA du téléphone…');
      let st = await nanoStatus();
      if (st === 'downloadable' || st === 'downloading') {
        say('Préparation de l\'IA du téléphone (téléchargement unique par Android)…');
        try { await nanoDownload((bytes) => say(`Téléchargement de l'IA du téléphone… ${Math.round(bytes / 1e6)} Mo`)); st = 'available'; } catch (e) { st = 'unavailable'; }
      }
      if (st === 'available') { text = await nanoSummary(b, t.text, say); model = 'gemini-nano'; }
    }
    if (!text) { say('Résumé automatique…'); await new Promise((r) => setTimeout(r, 30)); text = autoSummary(t.text, b.title); }
    const summary = { text, date: Date.now(), model, truncated: t.truncated };
    await post('/api/books/' + b.id, { summary }, 'PATCH');
    return summary;
}
async function makeFreeSummary(b) {
  const box = h('div', { class: 'up' }, h('b', {}, 'Résumé : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
  $('#uploads')?.append(box);
  const say = (t) => { $('span', box).textContent = t; };
  try {
    const summary = await computeSummary(b, say);
    box.remove(); await loadBooks(); renderLibrary();
    openSummary(S.books.find((x) => x.id === b.id) || { ...b, summary });
  } catch (e) { say(e.message); $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 12000); }
}
function callClaude(key, body) {
  if (window.AndroidOpen?.claude) return new Promise((res) => { window.__claudeDone = (j) => { window.__claudeDone = null; try { res(JSON.parse(j)); } catch { res({ status: 0, body: '' }); } }; AndroidOpen.claude(key, JSON.stringify(body)); });
  return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.text() }), (e) => ({ status: 0, body: e.message }));
}
async function makeSummary(b) {
  const box = h('div', { class: 'up' }, h('b', {}, 'Résumé : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
  $('#uploads')?.append(box);
  const say = (t) => { $('span', box).textContent = t; };
  try {
    const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
    if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?). Essaie « Avec ton application d\'IA ».');
    say('Claude rédige le résumé… (1 à 3 minutes)');
    const r = await callClaude(claudeKey(), { model: CLAUDE_MODEL, max_tokens: 16000,
      messages: [{ role: 'user', content: `${SUMMARY_PROMPT}\n\nTitre : ${b.title}${b.author ? '\nAuteur : ' + b.author : ''}${t.truncated ? '\n(Le livre est très long : seul le début est fourni.)' : ''}\n\n<livre>\n${t.text}\n</livre>` }] });
    let data = null; try { data = JSON.parse(r.body); } catch {}
    if (r.status !== 200) {
      const msg = r.status === 401 ? 'Clé d\'API refusée. Vérifie-la dans console.anthropic.com.'
        : r.status === 0 ? 'Pas de connexion Internet.'
        : [429, 529, 503].includes(r.status) ? 'Le service est occupé. Réessaie dans un moment.'
        : r.status === 400 && /credit|balance/i.test(data?.error?.message || '') ? 'Crédit insuffisant sur ton compte Claude (console.anthropic.com → Billing).'
        : 'Erreur de Claude : ' + (data?.error?.message || r.status);
      throw new Error(msg);
    }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    if (!text) throw new Error('Claude n\'a rien renvoyé. Réessaie.');
    const summary = { text, date: Date.now(), model: CLAUDE_MODEL, truncated: t.truncated };
    await post('/api/books/' + b.id, { summary }, 'PATCH');
    box.remove(); await loadBooks(); renderLibrary();
    openSummary(S.books.find((x) => x.id === b.id) || { ...b, summary });
  } catch (e) { say(e.message); $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 9000); }
}

// ================= Partage =================
async function openShare() {
  let kind = 'personal';
  const name = h('input', { placeholder: 'Ex. : Marie Tremblay', maxlength: 80 });
  const nameField = h('label', { class: 'field' }, 'Nom de la personne', name);
  const explain = h('p', { class: 'muted' });
  const setKind = (k) => { kind = k; $$('button', seg).forEach((b) => b.classList.toggle('sel', b.dataset.k === k)); nameField.style.display = k === 'personal' ? '' : 'none';
    explain.textContent = k === 'personal' ? 'Un lien unique pour une personne : tu sais exactement qui lit.' : 'Un seul lien pour plusieurs personnes : chacune écrit son nom en entrant.'; };
  const seg = h('div', { class: 'seg' }, h('button', { 'data-k': 'personal', onclick: () => setKind('personal') }, 'Lien personnel'), h('button', { 'data-k': 'open', onclick: () => setKind('open') }, 'Lien ouvert'));
  const list = h('div', { class: 'list' });
  const result = h('div');
  const refresh = async () => {
    const inv = await api('/api/invites');
    list.replaceChildren(...(inv.length ? inv.map((i) => h('div', { class: 'item' + (i.active ? '' : ' off') },
      h('div', { class: 'grow' }, h('b', {}, i.label), h('span', {}, `${i.kind === 'open' ? 'Lien ouvert' : 'Personnel'} · ${i.readers} lecteur${i.readers > 1 ? 's' : ''} · créé ${ago(i.created)}${i.active ? '' : ' · désactivé'}`)),
      i.active ? h('button', { class: 'rbtn', title: 'Copier le lien', onclick: () => shareLink(i) }, icon('copy')) : null,
      h('button', { class: 'btn', style: { height: '32px', fontSize: '12px' }, onclick: async () => { await post('/api/invites/' + i.id, { active: !i.active }, 'PATCH'); refresh(); } }, i.active ? 'Désactiver' : 'Réactiver')))
      : [h('p', { class: 'muted' }, 'Aucun lien pour l\'instant.')]));
  };
  sheet('Partager ma bibliothèque', h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Tes invités lisent et écoutent tes livres, sans pouvoir les télécharger. Tu vois qui vient, quand, et jusqu\'où ils lisent.'),
    seg, nameField, explain,
    h('button', { class: 'btn primary', onclick: async () => {
      try { const i = await post('/api/invites', { kind, label: name.value }); name.value = ''; await refresh(); shareLink(i, result); } catch (e) { toast(e.message); }
    } }, icon('plus'), 'Créer le lien'),
    result,
    h('h3', {}, 'Liens existants'), list));
  setKind('personal'); refresh();
}
function linkFor(i) { return `${location.origin}/l/${i.token}`; }
async function shareLink(i, into) {
  const url = linkFor(i);
  if (into) into.replaceChildren(h('div', { class: 'linkbox' }, url));
  const text = `Je t'invite à consulter ma bibliothèque « ${S.me.library} » : ${url}`;
  if (isNative() && AndroidApp.share) { AndroidApp.share(text); return; }
  if (navigator.share) { try { await navigator.share({ title: S.me.library, text, url }); return; } catch {} }
  try { await navigator.clipboard.writeText(url); toast('Lien copié'); } catch { toast('Copie le lien affiché'); }
}

// ================= Tableau de bord =================
const avatarColor = (s) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
function device(ua = '') {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Appareil';
  const br = /BibliothequeApp/.test(ua) ? 'app' : /Edg\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}
function dur(a, b) { const m = Math.max(1, Math.round((b - a) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; }
async function openDashboard() {
  const body = h('div', {}, h('p', { class: 'muted' }, 'Chargement…'));
  sheet('Tes lecteurs', body, { wide: true });
  const st = await api('/api/stats');
  const t = st.totals;
  const tiles = h('div', { class: 'tiles' }, [[t.readers, 'lecteurs'], [t.visits, 'visites'], [t.pages, 'pages consultées'], [t.books, 'livres']].map(([v, l]) => h('div', { class: 'tile' }, h('b', {}, String(v)), h('span', {}, l))));
  const readers = h('div', { class: 'list' }, st.readers.length ? st.readers.map((r) => h('div', { class: 'item reader-card', onclick: () => readerDetail(r) },
    h('div', { class: 'avatar', style: { background: avatarColor(r.name) } }, r.name.trim()[0]?.toUpperCase() || '?'),
    h('div', { class: 'grow' }, h('b', {}, r.name), h('span', {}, `${r.active ? 'Vu ' + ago(r.lastSeen) : 'Accès désactivé'}${r.inviteKind === 'open' ? ' · via lien ouvert' : ''}${r.contact ? ' · ' + r.contact : ''}`)),
    h('div', { class: 'stat-row' }, h('div', {}, h('b', {}, String(r.visitCount)), 'visites'), h('div', {}, h('b', {}, String(r.books.length)), 'livres'))))
    : [h('p', { class: 'muted' }, 'Personne n\'est encore venu. Crée un lien dans « Partager ».')]);
  const feed = h('div', { class: 'feed' }, st.recent.length ? st.recent.map((e) => h('div', {}, h('time', {}, fmtDate(e.ts)), h('span', {}, h('b', {}, e.name), e.type === 'audio' ? ' écoute ' : ' a ouvert ', h('em', {}, `« ${e.title} »`), ` · p. ${e.page}`)))
    : [h('p', { class: 'muted' }, 'Aucune activité.')]);
  body.replaceChildren(tiles, h('h3', {}, 'Lecteurs'), readers, h('h3', {}, 'Activité récente'), feed);
}
function readerDetail(r) {
  const books = r.books.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Livre'), h('th', {}, 'Rendu à'), h('th', {}, 'Ouvert'), h('th', {}, 'Dernière lecture'))),
    h('tbody', {}, r.books.map((b) => { const pct = b.pages ? Math.round((b.page / b.pages) * 100) : 0; return h('tr', {},
      h('td', {}, h('b', {}, b.title), h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } }))),
      h('td', { class: 'num' }, `p. ${b.page} / ${b.pages}`, h('div', { class: 'muted' }, `${pct} %${b.max_page > b.page ? ' · max p. ' + b.max_page : ''}`)),
      h('td', { class: 'num' }, `${b.opens} fois`),
      h('td', { class: 'num' }, fmtDate(b.last))); }))))
    : h('p', { class: 'muted' }, 'N\'a encore ouvert aucun livre.');
  const visits = r.visits.length ? r.visits.map((v) => h('div', { class: 'visit' },
    h('b', {}, fmtDate(v.start)), h('span', { class: 'muted' }, ` · ${dur(v.start, v.last)} · ${device(v.ua)}${v.ip ? ' · ' + v.ip : ''}`),
    v.events.length ? h('ul', {}, v.events.map((e) => h('li', {}, `${new Date(e.ts).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} — ${e.type === 'audio' ? 'écoute' : 'ouvre'} « ${e.title} » (p. ${e.page})`))) : h('ul', {}, h('li', {}, 'A parcouru l\'étagère'))))
    : h('p', { class: 'muted' }, 'Aucune visite.');
  sheet(r.name, h('div', {},
    h('div', { class: 'tiles' }, [[r.visitCount, 'visites'], [r.books.length, 'livres consultés'], [r.pagesViewed, 'pages vues'], [r.lastSeen ? ago(r.lastSeen) : '—', 'dernière visite']].map(([v, l]) => h('div', { class: 'tile' }, h('b', { style: typeof v === 'string' ? { fontSize: '18px' } : {} }, String(v)), h('span', {}, l)))),
    h('p', { class: 'muted' }, `Inscrit le ${fmtDate(r.created)} · ${r.invite || ''}${r.contact ? ' · ' + r.contact : ''}`),
    h('h3', {}, 'Livres'), books, h('h3', {}, 'Visites'), ...[visits].flat()), { wide: true });
}

// ================= Synthèse vocale =================
const TTS = {
  native: () => !!window.AndroidTTS,
  cb: {}, seq: 0,
  voices() {
    if (this.native()) return [];
    return (speechSynthesis.getVoices() || []).filter((v) => /^fr/i.test(v.lang)).concat((speechSynthesis.getVoices() || []).filter((v) => !/^fr/i.test(v.lang)));
  },
  speak(text, rate, voiceName, onend, pitch = 1) {
    const id = String(++this.seq);
    if (this.native()) { this.cb[id] = onend; if (AndroidTTS.speak2) AndroidTTS.speak2(text, rate, pitch, voiceName || '', id); else AndroidTTS.speak(text, rate, id); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = this.voices().find((x) => x.name === voiceName) || this.voices().find((x) => /^fr/i.test(x.lang));
    if (v) u.voice = v; u.lang = v?.lang || 'fr-FR'; u.rate = rate; u.pitch = pitch;
    // Navigateur (iPhone, Chrome) : la fin de phrase peut se perdre ; on surveille aussi la voix elle-même
    let done = false; const fin = () => { if (done) return; done = true; clearInterval(this.watch); onend && onend(); };
    u.onend = fin; u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') fin(); };
    this.u = u; // garder la phrase : Safari l'oublie sinon, et la lecture s'arrête après la première
    clearInterval(this.watch); const t0 = Date.now();
    this.watch = setInterval(() => { if (Date.now() - t0 > 1500 && !speechSynthesis.speaking && !speechSynthesis.pending) fin(); }, 700);
    try { speechSynthesis.resume(); } catch {}
    speechSynthesis.speak(u);
  },
  // iPhone et Chrome n'autorisent la voix que lancée au moment d'un toucher : on la débloque au premier toucher
  unlocked: false,
  unlock() {
    if (this.unlocked || this.native() || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'fr-FR'; speechSynthesis.speak(u); this.unlocked = true; } catch {}
  },
  stop() { this.cb = {}; clearInterval(this.watch); if (this.native()) AndroidTTS.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); },
  supported() { return this.native() || 'speechSynthesis' in window; },
};
['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => TTS.unlock(), { capture: true, passive: true }));
// ---- Voix et ton : la voix du téléphone, avec une intonation qui change selon le ton choisi ----
const TONES = [
  ['calme', 'Calme', 'Posé et doux, pour lire le soir', { p: 0.96, r: 0.88, v: 0.012 }, 'La nuit tombait doucement sur la ville. Au loin, une seule fenêtre restait allumée… On pouvait enfin lire en paix.'],
  ['serieux', 'Sérieux', 'Sobre et clair, pour les essais et la science', { p: 0.92, r: 0.96, v: 0 }, 'L\'information serait le substrat fondamental de la réalité. Examinons cette hypothèse avec rigueur, étape par étape.'],
  ['naturel', 'Naturel', 'Une lecture simple, sans effet', { p: 1, r: 1, v: 0.02 }, 'Bonjour ! Voici comment je vais lire tes livres. Tu peux changer de voix quand tu veux.'],
  ['conteur', 'Conteur', 'Lent et vivant, pour les histoires', { p: 1.02, r: 0.9, v: 0.05 }, 'Il était une fois, au bord d\'une forêt immense, une petite bibliothèque. Personne ne savait qui l\'avait construite… Et chaque nuit, ses livres changeaient de place !'],
  ['enjoue', 'Enjoué', 'Souriant et rythmé', { p: 1.1, r: 1.06, v: 0.04 }, 'Bonne nouvelle : ton prochain livre t\'attend ! On commence tout de suite ? Allez, c\'est parti.'],
  ['passionne', 'Passionné', 'La voix monte, accélère et vibre', { p: 1.12, r: 1.06, v: 0.07, x: true }, 'Imagine ! Et si l\'univers tout entier n\'était qu\'information ? C\'est fascinant… Et ce n\'est que le début !'],
];
const VOICE_NAMES = ['Camille', 'Dominique', 'Sacha', 'Alex', 'Charlie', 'Morgan', 'Lou', 'Eden', 'Noa', 'Claude', 'Ariel', 'Jo', 'Sam', 'Andréa', 'Maxime', 'Gaby'];
const REGION = { CA: 'Québec', FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg' };
const Voice = {
  tone: () => { const t = store.get('tone', 'naturel'); return PREMIUM_TONES.has(t) && !Premium.ok() ? 'naturel' : t; },
  toneOf: (k) => TONES.find((t) => t[0] === k) || TONES[2],
  current: () => store.get('voice', ''),
  list() {
    let raw = [];
    if (TTS.native()) { try { raw = JSON.parse(AndroidTTS.voices?.() || '[]'); } catch {} }
    else raw = TTS.voices().filter((v) => /^fr/i.test(v.lang)).map((v) => ({ name: v.name, country: (v.lang.split(/[-_]/)[1] || '').toUpperCase(), online: !v.localService }));
    return raw.map((v, i) => ({ ...v, nick: VOICE_NAMES[i % VOICE_NAMES.length] + (i >= VOICE_NAMES.length ? ' ' + (Math.floor(i / VOICE_NAMES.length) + 1) : ''),
      sub: [REGION[v.country] || v.country || 'Français', v.online ? 'en ligne, plus naturelle' : 'sur le téléphone', v.quality >= 400 ? 'haute qualité' : ''].filter(Boolean).join(' · ') }));
  },
  label() { const v = this.list().find((x) => x.name === this.current()); return this.toneOf(this.tone())[1] + (v ? ' · ' + v.nick : ''); },
  // « Automatique » : la meilleure voix du Québec installée (sur le téléphone d'abord, elle marche sans Internet)
  effective() {
    const cur = this.current(); if (cur) return cur;
    if (this._auto !== undefined) return this._auto;
    const l = this.list(); const score = (v) => (v.country === 'CA' ? 1000 : v.country === 'FR' ? 100 : 0) + (v.online ? 0 : 50) + (v.quality || 0) / 10;
    const best = l.sort((a, b) => score(b) - score(a))[0];
    return (this._auto = best ? best.name : '');
  },
  // Hauteur et débit de chaque phrase : le ton donne la base, le sens de la phrase fait varier
  shape(text, i, rate, toneKey = this.tone()) {
    const t = this.toneOf(toneKey)[3], s = String(text).trim();
    let p = t.p + ((((i * 37) % 7) - 3) / 3) * t.v, r = rate * t.r * (1 + ((((i * 53) % 5) - 2) / 2) * t.v * 0.6);
    if (/!\s*[»”"]?$/.test(s)) { p += t.x ? 0.15 : t.v * 1.5; r *= t.x ? 1.08 : 1.02; }
    else if (/\?\s*[»”"]?$/.test(s)) p += t.v ? 0.05 + t.v : 0.03;
    else if (/(…|\.\.\.)\s*[»”"]?$/.test(s)) { r *= 0.92; p -= 0.03; }
    if (t.x && /^(ah|oh|eh|wow|imagine[zs]?|attention|incroyable|fascinant|extraordinaire|tiens|écoute[zs]?)\b/i.test(s)) p += 0.08;
    if (s.length > 180) r *= 0.95;
    return { rate: Math.max(0.4, Math.min(2.6, r)), pitch: Math.max(0.7, Math.min(1.45, p)) };
  },
};
// ---- Pages juridiques (droits d'auteur, ISBN, dépôt légal…) : la voix les saute, l'affichage ne change pas ----
// Prudence : seulement au début ou à la fin du livre, et seulement quand plusieurs indices s'accumulent.
const LEGAL = [/©|\(c\)\s*\d{4}|copyright/i, /\bISBN\b|\bISSN\b|\bEAN\b/i, /tous droits (de [^.]{0,40})?réservés|all rights reserved/i, /dépôt légal|legal deposit/i,
  /code de la propriété intellectuelle|loi sur le droit d'auteur|copyright act/i, /marque déposée|trademark/i, /catalogage avant publication|données de catalogage|cataloguing in publication|bibliothèque et archives (nationales|canada)/i,
  /achevé d'imprimer|imprimé (au|en|aux) |printed in/i, /reproduction[^.]{0,80}(interdite|strictement)|toute reproduction/i, /publié en accord avec|traduit de l'anglais par|titre original\s*:/i,
  /conception graphique|mise en page\s*:|couverture\s*:|illustration de (la )?couverture/i, /éditions [A-ZÉ][\w-]+,?\s*(19|20)\d\d|(19|20)\d\d pour (la|l')/i, /www\.[a-z0-9-]+\.[a-z]{2,}/i,
  /usage privé du client|contrefaçon|droit de prêt|tatouage numérique|filigrane/i];
const Legal = {
  on: () => store.get('skipLegal', true),
  score(t) { return LEGAL.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0); },
  edge(page, total) { return page <= Math.max(12, Math.ceil(total * 0.06)) || page > total - Math.max(4, Math.ceil(total * 0.03)); },
  skipPage(text, page, total) { if (!this.on() || !this.edge(page, total)) return false; const sc = this.score(text); return sc >= 4 || (sc >= 3 && text.length < 2500) || (sc >= 2 && text.length < 600); },
  skipSentence(s, page, total) { if (!this.on() || !this.edge(page, total)) return false; return /©|\bISBN\b|tous droits réservés|dépôt légal|all rights reserved/i.test(s) || this.score(s) >= 2; },
};
// ---- Vitesse de lecture : trois choix clairs, puis un réglage fin par petits pas ----
const SPEEDS = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5, 1.75];
const SPEED_CAT = [['Lent', 0.85], ['Normal', 1], ['Rapide', 1.15]];
const nearestSpeed = (r) => SPEEDS.reduce((a, b) => (Math.abs(b - (r || 1)) < Math.abs(a - (r || 1)) ? b : a), 1);
const speedCat = (r) => (r < 0.95 ? 'Lent' : r <= 1.1 ? 'Normal' : 'Rapide');
const fmtRate = (r) => (Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100).replace('.', ',')) + '×';
function speedRow(get, set) {
  const val = h('b', { class: 'spval' });
  const cats = SPEED_CAT.map(([n, v]) => h('button', { class: 'spcat', onclick: () => apply(v) }, n));
  const paint = () => { val.textContent = fmtRate(get()); cats.forEach((c, i) => c.classList.toggle('sel', speedCat(get()) === SPEED_CAT[i][0])); };
  const apply = (r) => { set(nearestSpeed(r)); paint(); };
  const step = (d) => { const i = SPEEDS.indexOf(nearestSpeed(get())); apply(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + d))]); };
  paint();
  return h('div', { class: 'speedrow' },
    h('span', { class: 'splbl' }, 'Vitesse'),
    h('div', { class: 'spcats' }, cats),
    h('div', { class: 'spfine' }, h('button', { class: 'spbtn', 'aria-label': 'Un peu plus lent', onclick: () => step(-1) }, '−'), val, h('button', { class: 'spbtn', 'aria-label': 'Un peu plus vite', onclick: () => step(1) }, '+')));
}
// ---- Minuterie de sommeil (lecture à voix haute et livres audio) ----
const Sleep = {
  at: 0, mode: '', t: null, iv: null, onFire: null, chips: new Set(),
  set(mode, min, onFire) {
    this.clear(true); this.mode = mode; this.onFire = onFire;
    if (min) { this.at = Date.now() + min * 60000; this.t = setTimeout(() => this.fire(), min * 60000); this.iv = setInterval(() => this.paint(), 20000); }
    this.paint(); toast(mode === 'chap' ? 'Arrêt à la fin du chapitre' : mode === 'page' ? 'Arrêt à la fin de la page' : `Arrêt dans ${min} minutes`);
  },
  fire() { const f = this.onFire; this.clear(); if (f) f(); toast('Minuterie : lecture arrêtée. Bonne nuit !'); },
  clear(quiet) { clearTimeout(this.t); clearInterval(this.iv); this.at = 0; this.mode = ''; this.onFire = null; if (!quiet) this.paint(); },
  label() { if (this.mode === 'chap') return 'Chapitre'; if (this.mode === 'page') return 'Page'; if (!this.at) return ''; return Math.max(1, Math.ceil((this.at - Date.now()) / 60000)) + ' min'; },
  paint() { for (const c of this.chips) { if (!c.isConnected) { this.chips.delete(c); continue; } c.replaceChildren(icon('moon'), this.label() ? ' ' + this.label() : ''); c.classList.toggle('on', !!this.label()); } },
  chip(onFire, { chapters, pages } = {}) {
    const c = h('button', { class: 'chip sleep', title: 'Minuterie de sommeil', onclick: () => {
      const opt = (label, fn) => h('button', { class: 'btn', onclick: () => { close(); fn(); } }, label);
      const close = sheet('Minuterie de sommeil', h('div', {},
        h('p', { class: 'muted', style: { marginTop: '-4px' } }, 'La lecture s\'arrête toute seule. Pratique pour s\'endormir en écoutant.'),
        h('div', { class: 'sleepgrid' }, [15, 30, 45, 60, 90].map((m) => opt(`${m} min`, () => this.set('time', m, onFire))),
          chapters ? opt('Fin du chapitre', () => this.set('chap', 0, onFire)) : null,
          pages ? opt('Fin de la page', () => this.set('page', 0, onFire)) : null),
        this.label() ? h('div', { class: 'actions', style: { marginTop: '14px' } }, h('button', { class: 'btn danger', onclick: () => { close(); this.clear(); toast('Minuterie arrêtée'); } }, 'Arrêter la minuterie')) : null));
    } });
    this.chips.add(c); this.onFire = this.onFire || null; setTimeout(() => this.paint(), 0); return c;
  },
};
// ---- Prononciation : ce que la voix dit à la place de ce qui est écrit (l'affichage ne change pas) ----
const PRON_BASE = [
  [/\bSt-/g, 'Saint-'], [/\bSte-/g, 'Sainte-'], [/\bSts-/g, 'Saints-'], [/\bQC\b/g, 'Québec'], [/\bQc\b/g, 'Québec'],
  [/\bM\. (?=[A-ZÉ])/g, 'monsieur '], [/\bMM\. (?=[A-ZÉ])/g, 'messieurs '], [/\bMme\b/g, 'madame'], [/\bMmes\b/g, 'mesdames'], [/\bMlle\b/g, 'mademoiselle'],
  [/\bDr\b\.?/g, 'docteur'], [/\bDre\b\.?/g, 'docteure'], [/\bMe (?=[A-ZÉ])/g, 'maître '], [/\bp\. ?ex\./g, 'par exemple'], [/\bc\.-à-d\./g, 'c\'est-à-dire'],
  [/\betc\./g, 'et cetera'], [/\bav\. J\.-C\./g, 'avant Jésus-Christ'], [/\bapr\. J\.-C\./g, 'après Jésus-Christ'], [/\bJ\.-C\./g, 'Jésus-Christ'],
  [/\b1er\b/g, 'premier'], [/\b1re\b/g, 'première'], [/\b(\d+)e\b/g, '$1ième'], [/\bp\. (\d)/g, 'page $1'], [/\bchap\. (\d)/g, 'chapitre $1'],
  [/\bAut\.\b/g, 'autoroute'], [/\bboul\./g, 'boulevard'], [/\bprov\./g, 'province'], [/\bcf\./g, 'voir'], [/&/g, ' et '],
];
const ROMAN = (r) => { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, M: 1000 }; let n = 0; for (let i = 0; i < r.length; i++) { const a = v[r[i]], b = v[r[i + 1]] || 0; n += a < b ? -a : a; } return n; };
const Pron = {
  user: () => store.get('pron', []),
  save(l) { store.set('pron', l); },
  say(text) {
    let t = String(text).replace(/\b([IVXLC]{1,7})(e|ème)\s+(siècle|siècles|arrondissement|République|Empire)/g, (m, r, e, w) => ROMAN(r) + 'ième ' + w);
    for (const [re, to] of PRON_BASE) t = t.replace(re, to);
    for (const [from, to] of this.user()) if (from) t = t.replace(new RegExp('(^|[^\\p{L}])' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}])', 'giu'), '$1' + to);
    return t;
  },
};
function openPron() {
  const list = h('div', { class: 'pronlist' });
  const draw = () => list.replaceChildren(...(Pron.user().length ? Pron.user().map(([a, b], i) => h('div', { class: 'pronrow' }, h('span', {}, h('b', {}, a), ' → ', b),
    h('button', { class: 'rbtn', 'aria-label': 'Écouter', onclick: () => TTS.speak(Pron.say(a), store.get('rate', 1), Voice.effective(), null) }, icon('play')),
    h('button', { class: 'rbtn', 'aria-label': 'Retirer', onclick: () => { const l = Pron.user(); l.splice(i, 1); Pron.save(l); draw(); } }, icon('trash')))) : [h('p', { class: 'muted' }, 'Aucun mot pour l\'instant.')]));
  const a = h('input', { placeholder: 'Écrit (ex. : Massé)' }), b = h('input', { placeholder: 'Dit (ex. : Ma-cé)' });
  draw();
  sheet('Prononciation', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-4px' } }, 'Apprends à la voix les noms d\'ici et les mots anglais. Écris le mot, puis comment il doit sonner, en orthographe française. Les abréviations courantes (St-, Mme, p. ex., XXe siècle…) sont déjà corrigées.'),
    h('div', { class: 'pronadd' }, a, b,
      h('button', { class: 'btn', onclick: () => { if (b.value.trim()) TTS.speak(Pron.say(b.value.trim()), store.get('rate', 1), Voice.effective(), null); } }, icon('play')),
      h('button', { class: 'btn primary', onclick: () => { if (!a.value.trim() || !b.value.trim()) return; const l = Pron.user().filter(([x]) => x.toLowerCase() !== a.value.trim().toLowerCase()); l.push([a.value.trim(), b.value.trim()]); Pron.save(l); a.value = ''; b.value = ''; draw(); } }, icon('plus'))),
    list));
}
const orbStyle = (seed) => { const hsh = hashStr(seed), a = hsh % 360, b = (a + 70 + (hsh >> 8) % 120) % 360;
  return { background: `radial-gradient(circle at 30% 28%, hsl(${b} 90% 85%), transparent 45%), radial-gradient(circle at 70% 75%, hsl(${(a + 200) % 360} 70% 45%), transparent 55%), linear-gradient(140deg, hsl(${a} 65% 50%), hsl(${b} 60% 30%))` }; };
function openVoices() {
  const r = window.__reader; if (r?.playing) r.pause();
  let cur = Voice.current(), tone = Voice.tone();
  const vs = Voice.list();
  const preview = (name, tk) => {
    TTS.stop(); const ss = sentences(Voice.toneOf(tk)[4]); let i = 0;
    const next = () => { if (i >= ss.length) return; const x = ss[i], sh = Voice.shape(x, i, store.get('rate', 1), tk); i++; TTS.speak(Pron.say(x), sh.rate, name || Voice.effective(), next, sh.pitch); };
    next();
  };
  const tones = h('div', { class: 'tonegrid' }, TONES.map(([k, name, desc]) => h('button', { class: 'tonecard' + (k === tone ? ' sel' : ''), onclick: (e) => {
    if (PREMIUM_TONES.has(k) && !Premium.need('tones')) return;
    tone = k; store.set('tone', k); if (window.__reader?.toneBtn) window.__reader.toneBtn.replaceChildren(icon('voice'), ' ', Voice.toneOf(k)[1]); $$('.tonecard', tones).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); preview(cur, k);
  } }, h('b', {}, name, PREMIUM_TONES.has(k) ? Premium.badge() : null), h('small', {}, desc))));
  const row = (v) => h('div', { class: 'vrow' + ((v ? v.name : '') === cur ? ' sel' : '') },
    h('button', { class: 'vpick', onclick: (e) => {
      cur = v ? v.name : ''; store.set('voice', cur); if (window.__reader) window.__reader.voice = cur;
      $$('.vrow', list).forEach((x) => x.classList.remove('sel')); e.currentTarget.parentNode.classList.add('sel'); preview(cur, tone);
    } }, h('span', { class: 'orb', style: v ? orbStyle(v.name) : { background: 'conic-gradient(from 90deg, #d4ab6a, #7a2e2e, #1f4e5f, #d4ab6a)' } }),
      h('span', { class: 'vtx' }, h('b', {}, v ? v.nick : 'Automatique'), h('small', {}, v ? v.sub : 'La meilleure voix québécoise du téléphone'))),
    h('button', { class: 'rbtn', 'aria-label': 'Écouter', onclick: () => preview(v ? v.name : '', tone) }, icon('play')));
  const list = h('div', { class: 'vlist' }, row(null), vs.map(row));
  const close = sheet('Voix et ton', h('div', {},
    h('h3', { class: 'vh' }, 'Le ton'), tones,
    h('h3', { class: 'vh' }, 'La voix'),
    vs.length ? list : h('p', { class: 'muted' }, 'Aucune voix française n\'est installée sur le téléphone.'),
    TTS.native() ? h('div', { class: 'addfind', style: { marginTop: '14px' }, onclick: () => AndroidTTS.openSettings?.() },
      icon('download'), h('span', {}, h('b', {}, 'Plus de voix'), h('small', {}, 'Réglages Android › Synthèse vocale › Moteur Google › Installer des données vocales (Français Canada ou France)')), chevR()) : null,
    h('label', { class: 'check', style: { marginTop: '14px' } }, h('input', { type: 'checkbox', checked: Legal.on(), onchange: (e) => store.set('skipLegal', e.target.checked) }),
      h('span', {}, 'Sauter les pages de droits d\'auteur et mentions légales (ISBN, dépôt légal…)')),
    h('div', { class: 'addfind', style: { marginTop: '10px' }, onclick: () => { close(); openPron(); } },
      icon('dict'), h('span', {}, h('b', {}, 'Prononciation'), h('small', {}, 'Noms d\'ici, mots anglais : apprends-lui comment les dire')), chevR()),
    h('p', { class: 'hint', style: { marginTop: '12px' } }, 'Touche un ton ou une voix pour l\'entendre. Le choix sert à toute la lecture audio.')), { wide: true });
  const stopOnClose = new MutationObserver(() => { if (!document.body.contains(list)) { stopOnClose.disconnect(); TTS.stop(); } });
  stopOnClose.observe(document.body, { childList: true });
}
window.__ttsDone = (id) => { const f = TTS.cb[id]; delete TTS.cb[id]; f && f(); };
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

function sentences(text) {
  const clean = text.replace(/\s*\n\s*(?=\S)/g, (m) => /\n\s*\n/.test(m) ? '\n\n' : ' ').trim();
  const parts = clean.match(/[^.!?…\n]+(?:[.!?…]+["»”)]*|\n+|$)/g) || [];
  const out = [];
  for (let p of parts.map((s) => s.trim()).filter(Boolean)) {
    while (p.length > 260) { let c = p.lastIndexOf(', ', 220); if (c < 80) c = p.lastIndexOf(' ', 240); if (c < 1) c = 240; out.push(p.slice(0, c + 1)); p = p.slice(c + 1).trim(); }
    const prev = out[out.length - 1];
    if (prev && /(^|[\s.(«"])(\p{Lu}|M|Mme|Mlle|Dr|St|Ste|av|apr|J\.-C|etc|p|ex|vol|chap|art|cf)\.$/u.test(prev)) out[out.length - 1] += ((/^\p{Lu}\./u.test(p) && /(^|[\s.(«"])\p{Lu}\.$/u.test(prev)) || /^-/.test(p) ? '' : ' ') + p; // sigles (O.G.M.), initiales, abréviations : pas une fin de phrase
    else if (prev && p.length < 18 && !/[.!?…]$/.test(prev)) out[out.length - 1] += ' ' + p; else out.push(p);
  }
  return out;
}

// ================= Lecteur =================
async function openBook(b, fromEl, opts = {}) {
  if (b.bait && !opts.anyway) return baitSheet(b, fromEl, opts);
  if (b.ocrRedo && Ocr.on() && !opts.anyway) { // ancienne conversion de mauvaise qualité, effacée : on propose de la refaire
    const close = sheet('Refaire la conversion en texte', h('div', {},
      h('p', {}, 'La première conversion de ce livre a repris un vieux texte caché dans le PDF, de très mauvaise qualité. Elle a été retirée.'),
      h('p', { class: 'muted' }, 'La nouvelle conversion lit vraiment chaque page photographiée : le texte sera beaucoup plus propre.'),
      h('div', { class: 'actions', style: { justifyContent: 'space-between', marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => { close(); openBook(b, fromEl, { ...opts, anyway: true }); } }, 'Lire en photos'),
        h('button', { class: 'btn primary', onclick: () => { close(); Ocr.run(b, b.progress?.page || 1); openBook(b, fromEl, { ...opts, anyway: true }); } }, icon('type'), 'Refaire la conversion'))));
    return;
  }
  if (b.kind === 'audio') { await flyOpen(b, fromEl); return new AudioBook(b).mount(); }
  if (PAGED(b.kind) && b.ocr === 'done' && store.get('view:' + b.id, 'text') === 'text' && window.LocalAPI) b = { ...b, kind: 'ocr', base: b.kind }; // livre converti : lu en texte
  await flyOpen(b, fromEl);
  const R = new Reader(b, opts);
  await R.mount();
}
function flyOpen(b, fromEl) {
  const cv = fromEl && ($('.cover', fromEl) || fromEl);
  if (!cv || !cv.animate) return Promise.resolve();
  const r = cv.getBoundingClientRect();
  const fly = cv.cloneNode(true); fly.className = 'flyer'; fly.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
  document.body.append(fly);
  const W = Math.min(innerWidth * 0.8, (innerHeight * 0.8) * (r.width / r.height)), H = W * (r.height / r.width);
  const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2), sc = W / r.width;
  const a = fly.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotateY(-8deg)`, opacity: 1, offset: .75 }, { transform: `translate(${dx}px,${dy}px) scale(${sc * 1.06})`, opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  return new Promise((res) => { setTimeout(res, 330); a.onfinish = () => fly.remove(); });
}

// ---- Définir un mot (Wiktionnaire) et traduire l'anglais ----
const LOOK = { cache: new Map() };
const POS = { nom: 'nom', 'nom propre': 'nom propre', verbe: 'verbe', adjectif: 'adjectif', adverbe: 'adverbe', 'préposition': 'préposition', conjonction: 'conjonction', pronom: 'pronom', 'pronom personnel': 'pronom', interjection: 'interjection', 'article défini': 'article', 'article indéfini': 'article', locution: 'locution', 'locution nominale': 'locution', 'locution verbale': 'locution', 'locution adverbiale': 'locution', 'adjectif numéral': 'nombre', 'adjectif possessif': 'adjectif', 'adjectif démonstratif': 'adjectif' };
function wikiClean(x) {
  let t = x.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '').replace(/<[^>]+>/g, '');
  for (let k = 0; k < 3; k++) t = t.replace(/\{\{(?:lien|l|w|ws|pc|smcp|term|nom w pc)\|([^|}]+)[^{}]*\}\}/g, '$1').replace(/\{\{([a-zé -]{2,22})(?:\|[a-z]{2,3})?\}\}/gi, '($1)').replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').replace(/\s+([.,;:])/g, '$1').trim();
  return t.replace(/^[,;:.\s]+/, '');
}
async function wiktionary(word) {
  const key = word.toLowerCase(); if (LOOK.cache.has(key)) return LOOK.cache.get(key);
  const get = async (w) => { const r = await fetch('https://fr.wiktionary.org/w/api.php?action=parse&format=json&origin=*&prop=wikitext&redirects=1&page=' + encodeURIComponent(w)); const j = await r.json(); return j.error ? null : j.parse.wikitext['*']; };
  let wt = await get(word); if (!wt && word !== key) wt = await get(key);
  if (!wt) { LOOK.cache.set(key, null); return null; }
  const parts = ('\n' + wt).split(/\n==\s*\{\{langue\|/);
  const sec = (lang) => { const s = parts.find((x) => x.startsWith(lang + '}}')); return s ? s.split(/\n==[^=]/)[0] : null; };
  let lang = 'fr', body = sec('fr'); if (!body) { body = sec('en'); lang = 'en'; }
  if (!body) { LOOK.cache.set(key, null); return null; }
  const out = []; let pos = null, flex = false, lemma = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^===+\s*\{\{S\|([^|}]+)(?:\|[a-z]+)?(\|flexion)?/);
    if (m) { pos = POS[m[1]] || (/étymologie|prononciation|traductions|synonymes|voir|références|anagrammes|dérivés|apparentés|hyperonymes|hyponymes|vocabulaire|variantes|antonymes|paronymes|homophones|attestations|notes|citations|gentilés/.test(m[1]) ? null : m[1]); flex = !!m[2]; continue; }
    if (pos && /^#(?![*:#])/.test(line)) {
      const raw = line.replace(/^#\s*/, ''); const d = wikiClean(raw);
      if (flex && !lemma) { const lm = raw.match(/\[\[([^\]|#]+)/); if (lm) lemma = lm[1]; }
      if (d && d.length > 1 && out.length < 6 && out.filter((x) => x.pos === pos).length < 3) out.push({ pos, d, flex });
    }
  }
  const res = { lang, defs: out, lemma: lemma && lemma.toLowerCase() !== key ? lemma : null };
  LOOK.cache.set(key, res); return res;
}
const isEnglish = (s) => { const en = (s.match(/\b(the|and|of|to|is|that|with|for|you|it|was|are|this|have|from|be|on|not|by|but|they|which|would|there|their)\b/gi) || []).length; const fr = (s.match(/\b(le|la|les|et|des|du|un|une|est|que|qui|dans|pour|pas|sur|au|avec|ce|il|elle|nous|vous|mais|ou)\b/gi) || []).length; return en >= 2 && en > fr * 1.3; };
async function translateEn(text) {
  const chunks = []; let cur = '';
  for (const s of sentences(text)) { if ((cur + ' ' + s).length > 450 && cur) { chunks.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s; }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks.slice(0, 12)) {
    const r = await fetch('https://api.mymemory.translated.net/get?langpair=en|fr&q=' + encodeURIComponent(c.slice(0, 480)));
    const j = await r.json(); out.push(j?.responseData?.translatedText || '');
  }
  return out.join(' ').replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
function wordAt(text, idx) {
  const isW = (c) => /[\p{L}\p{M}'’\-]/u.test(c || '');
  let a = idx, b = idx; if (!isW(text[a]) && isW(text[a - 1])) a = b = idx - 1;
  if (!isW(text[a])) return null;
  while (a > 0 && isW(text[a - 1])) a--; while (b < text.length && isW(text[b])) b++;
  let w = text.slice(a, b).replace(/^['’\-]+|['’\-]+$/g, '');
  w = w.replace(/^(?:l|d|j|m|n|s|t|c|qu|jusqu|lorsqu|puisqu)['’]/i, ''); // l'arbre → arbre
  return w.length > 1 ? w : null;
}

// ---- Convertir les photos en texte (pages photographiées) ----
// Chaque page est reconnue sur le téléphone ; le livre peut ensuite se lire comme un texte (taille, voix, définitions).
// Le bouton Texte / Photo, en haut du lecteur, ramène aux pages d'origine.
const Ocr = {
  on: () => !!window.AndroidOcr && !!window.LocalAPI?.ocrSave,
  cb: {}, n: 0, jobs: {},
  recognize(canvas) {
    return new Promise((res, rej) => {
      const id = 'o' + (++this.n); this.cb[id] = (r) => (r.error ? rej(new Error(r.error)) : res(r));
      AndroidOcr.recognize(canvas.toDataURL('image/jpeg', 0.88).split(',')[1], id);
      setTimeout(() => { if (this.cb[id]) { delete this.cb[id]; rej(new Error('Délai dépassé')); } }, 60000);
    });
  },
  // Remet les blocs dans l'ordre de lecture : titres pleine largeur, puis colonne de gauche, puis de droite
  order(r) {
    const W = r.w || 1; const bl = (r.blocks || []).filter((b) => b.t && b.t.trim());
    bl.sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
    const out = []; let band = [];
    const flush = () => { const L = band.filter((b) => (b.l + b.r) / 2 < W / 2), R = band.filter((b) => (b.l + b.r) / 2 >= W / 2); out.push(...L, ...R); band = []; };
    for (const b of bl) { if (b.r - b.l > W * 0.62) { flush(); out.push(b); } else band.push(b); }
    flush();
    return out.map((b) => b.t.replace(/-\n(?=\p{Ll})/gu, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n'); // remis en forme à l'affichage (voir local.js)
  },
  async run(b, from = 1) {
    if (this.jobs[b.id]) return toast('La conversion est déjà en cours');
    if (!Premium.ok()) { const free = store.get('ocrFree', ''); if (free && free !== b.id) { Premium.offer('ocr'); return; } store.set('ocrFree', b.id); } // un livre offert pour essayer
    const total = b.pages; const pages = await LocalAPI.ocrGet(b.id); while (pages.length < total) pages.push(null);
    const ctl = progressPanel(`Conversion en texte · ${b.title}`); this.jobs[b.id] = ctl;
    const order = []; for (let i = 0; i < total; i++) order.push(((from - 1 + i) % total) + 1); // à partir de la page en cours
    let done = pages.filter((x) => x !== null).length, fails = 0;
    try {
      for (const n of order) {
        await ctl.wait(); if (ctl.cancelled) break;
        if (pages[n - 1] !== null) continue;
        ctl.set((done / total) * 100, `Page ${n} sur ${total} · ${Math.floor((done / total) * 100)} %`);
        let txt = '';
        try {
          if (b.kind === 'pdf') { const t = (await api(`/api/books/${b.id}/text/${n}`)).text || ''; if (t.replace(/\s/g, '').length > 120 && LocalAPI.textQuality(t) >= 0.93) txt = t; } // la page a déjà un texte propre ; sinon (vieux texte caché abîmé) : vraie reconnaissance
          if (!txt) { const c = await LocalAPI.pageCanvasAt(b.id, n, 2200); txt = this.order(await this.recognize(c)); }
        } catch { fails++; }
        pages[n - 1] = txt; done++;
        if (done % 4 === 0) await LocalAPI.ocrSave(b.id, pages.map((x) => x || ''), false);
      }
      const complete = pages.every((x) => x !== null);
      await LocalAPI.ocrSave(b.id, pages.map((x) => x || ''), complete);
      ctl.done(); await loadBooks();
      if (complete) {
        store.set('view:' + b.id, 'text');
        toast(fails ? `Conversion terminée (${fails} page${fails > 1 ? 's' : ''} illisible${fails > 1 ? 's' : ''})` : 'Conversion terminée : le livre se lit maintenant en texte');
        const r = window.__reader; if (r && r.b.id === b.id && r.b.kind !== 'ocr') r.switchView('text');
      } else toast('Conversion arrêtée. Elle reprendra où elle en était.');
    } catch (e) { ctl.done(); toast(e.message); }
    finally { delete this.jobs[b.id]; if (!$('.reader')) renderLibrary(); }
  },
};
window.__ocrDone = (j) => { let r; try { r = JSON.parse(j); } catch { return; } const f = Ocr.cb[r.id]; delete Ocr.cb[r.id]; if (f) f(r); };
function progressPanel(title) { // même panneau que la recherche dans le téléphone : pourcentage, pause, annulation
  const bar = h('i', { style: { width: '0%' } }), txt = h('span', {}, 'Préparation…');
  const pauseBtn = h('button', { class: 'btn', onclick: () => { c.paused = !c.paused; pauseBtn.replaceChildren(icon(c.paused ? 'play' : 'pause'), c.paused ? 'Reprendre' : 'Pause'); el.classList.toggle('paused', c.paused); if (c.paused) txt.textContent = 'En pause · ' + txt.textContent; } }, icon('pause'), 'Pause');
  const el = h('div', { class: 'scanpanel' }, h('b', {}, title), txt, h('div', { class: 'bar' }, bar),
    h('div', { class: 'actions' }, pauseBtn, h('button', { class: 'btn danger', onclick: () => { c.cancelled = true; c.paused = false; } }, icon('close'), 'Arrêter')));
  document.body.append(el);
  const c = { paused: false, cancelled: false, set(pct, t) { bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; if (t) txt.textContent = (c.paused ? 'En pause · ' : '') + t; },
    wait: () => new Promise((res) => { const tick = () => (c.paused && !c.cancelled ? setTimeout(tick, 200) : res()); tick(); }), done() { el.remove(); } };
  return c;
}

// ---- Pli de page, comme dans Google Livres ----
// La page du dessus se replie le long d'une ligne qui suit le doigt : son verso ombré glisse par-dessus,
// et la page voisine (déjà dessinée) apparaît dessous avec une ombre portée.
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
class Curl {
  constructor(stage, top, under) {
    this.top = top; this.under = under;
    if (!under.isConnected) stage.append(under);
    if (!top.isConnected) stage.append(top);
    // la feuille peut être plus petite que l'écran (PDF sur fond noir) : on travaille dans les coordonnées du lecteur
    this.X = top.offsetLeft; this.Y = top.offsetTop; this.W = top.offsetWidth || stage.clientWidth; this.H = top.offsetHeight || stage.clientHeight;
    this.y0 = this.Y + this.H * 0.9; this.dy = 0; this.lift = null; this.p = 0;
    under.style.zIndex = 1; top.style.zIndex = 3;
    this.shadeBar = h('i'); this.flapBar = h('i');
    this.shade = h('div', { class: 'curl-shade' }, this.shadeBar);
    this.flap = h('div', {}, this.flapBar);
    this.flapWrap = h('div', { class: 'curl-flap' }, this.flap);
    stage.append(this.shade, this.flapWrap);
  }
  static clip(poly, M, n, cutSide) { // garde la partie du polygone d'un côté de la ligne de pli
    const side = (q) => ((q.x - M.x) * n.x + (q.y - M.y) * n.y) * (cutSide ? 1 : -1);
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
      if (sa >= 0) out.push(a);
      if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    }
    return out;
  }
  static poly(pts) { return pts.length < 3 ? 'polygon(0 0,0 0,0 0)' : `polygon(${pts.map((q) => `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px`).join(',')})`; }
  static bar(el, M, ang, w) { el.style.cssText = `left:${M.x}px;top:${M.y}px;width:${w}px;transform:rotate(${ang}deg)`; }
  // p = 0 : page à plat ; p = 1 : page entièrement tournée
  set(p) {
    this.p = p;
    const W = this.W, H = this.H, X = this.X, Y = this.Y, y0 = this.y0;
    let P = { x: X + W - 2 * W * p, y: y0 + this.dy + (this.lift ? this.lift(p) : 0) };
    const vx = P.x - X, vy = P.y - y0, d = Math.hypot(vx, vy); // le coin reste à une page de distance du dos : la feuille ne se déchire pas
    if (d > W) P = { x: X + (vx * W) / d, y: y0 + (vy * W) / d };
    const dx = X + W - P.x, dy = y0 - P.y, L = Math.hypot(dx, dy);
    if (L < 0.5) { this.top.style.clipPath = ''; this.shade.style.display = this.flapWrap.style.display = 'none'; return; }
    this.shade.style.display = this.flapWrap.style.display = '';
    const n = { x: dx / L, y: dy / L }, M = { x: (X + W + P.x) / 2, y: (y0 + P.y) / 2 };
    const rect = [{ x: X, y: Y }, { x: X + W, y: Y }, { x: X + W, y: Y + H }, { x: X, y: Y + H }];
    const keep = Curl.clip(rect, M, n, false), cut = Curl.clip(rect, M, n, true);
    const back = cut.map((q) => { const s = 2 * ((q.x - M.x) * n.x + (q.y - M.y) * n.y); return { x: q.x - s * n.x, y: q.y - s * n.y }; });
    this.top.style.clipPath = Curl.poly(keep.map((q) => ({ x: q.x - X, y: q.y - Y })));
    this.shade.style.clipPath = Curl.poly(cut);
    this.flap.style.clipPath = Curl.poly(back);
    const ang = (Math.atan2(n.y, n.x) * 180) / Math.PI;
    Curl.bar(this.shadeBar, M, ang, Math.max(14, Math.min(120, L * 0.45)));
    Curl.bar(this.flapBar, M, ang + 180, Math.max(1, L / 2));
    this.shade.style.opacity = Math.min(1, (1 - p) * 5);
  }
  destroy() {
    this.shade.remove(); this.flapWrap.remove();
    for (const x of [this.top, this.under]) { x.style.clipPath = ''; x.style.zIndex = ''; }
  }
}

// ================= Livres audio =================
const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
const fmtLeft = (s) => { s = Math.max(0, s); const hh = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60); return hh ? `${hh} h ${String(mm).padStart(2, '0')}` : `${mm} min`; };
class AudioBook {
  constructor(b) {
    this.b = b; this.rate = nearestSpeed(store.get('arate', 1));
    this.tracks = b.tracks && b.tracks.length ? b.tracks : [{ name: b.title, dur: b.dur || 0 }];
    this.chapters = b.chapters && b.chapters.length ? b.chapters : this.tracks.map((t, i) => ({ track: i, start: 0, title: t.name }));
    this.track = Math.max(0, Math.min(this.tracks.length - 1, (b.progress?.page || 1) - 1)); this.startPos = b.progress?.pos || 0;
  }
  get offsets() { let o = 0; return this.tracks.map((t) => { const x = o; o += t.dur || 0; return x; }); }
  get total() { return this.tracks.reduce((a, t) => a + (t.dur || 0), 0); }
  now() { return (this.offsets[this.track] || 0) + (this.audio.currentTime || 0); }
  chapAt(t) { const off = this.offsets; let k = 0; this.chapters.forEach((c, i) => { if ((off[c.track] || 0) + (c.start || 0) <= t + 0.5) k = i; }); return k; }
  chapStart(i) { const c = this.chapters[i]; return (this.offsets[c.track] || 0) + (c.start || 0); }
  chapEnd(i) { return i + 1 < this.chapters.length ? this.chapStart(i + 1) : this.total || this.audio.duration || 0; }
  async mount() {
    const b = this.b;
    this.urls = await LocalAPI.audioOf(b.id);
    this.audio = new Audio(); this.audio.preload = 'auto';
    const cover = h('div', { class: 'abcover' }, coverEl(b));
    this.chapLbl = h('div', { class: 'abchap' });
    this.slider = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position dans le chapitre' });
    this.tNow = h('span', {}); this.tEnd = h('span', {}); this.left = h('div', { class: 'ableft' });
    this.playBtn = h('button', { class: 'abplay', 'aria-label': 'Lecture', onclick: () => this.toggle() }, icon('play'));
    const jump = (s, l) => h('button', { class: 'abjump', onclick: () => this.seek(this.now() + s), 'aria-label': l }, h('span', {}, (s > 0 ? '+' : '−') + Math.abs(s)), h('small', {}, 's'));
    this.sleepBtn = Sleep.chip(() => this.fadeOut(), { chapters: this.chapters.length > 1 });
    this.el = h('div', { class: 'reader audiobook', 'data-theme': 'nuit' },
      h('div', { class: 'r-top' },
        h('button', { class: 'rbtn', title: 'Fermer', onclick: () => this.close() }, icon('back')),
        h('div', { class: 'ttl' }, h('b', {}, b.title), h('span', {}, b.author || 'Livre audio')),
        h('button', { class: 'rbtn', title: 'Chapitres', onclick: () => this.chapterList() }, icon('list'))),
      h('div', { class: 'abmain' }, cover,
        h('div', { class: 'abtitle' }, h('b', {}, b.title), b.author ? h('span', {}, b.author) : null),
        this.chapLbl,
        h('div', { class: 'abseek' }, this.slider, h('div', { class: 'abtimes' }, this.tNow, this.tEnd)),
        this.left,
        h('div', { class: 'abctl' },
          jump(-30, 'Reculer de 30 secondes'),
          h('button', { class: 'rbtn', 'aria-label': 'Chapitre précédent', onclick: () => this.chap(-1) }, icon('prev')),
          this.playBtn,
          h('button', { class: 'rbtn', 'aria-label': 'Chapitre suivant', onclick: () => this.chap(1) }, icon('next')),
          jump(30, 'Avancer de 30 secondes')),
        speedRow(() => this.rate, (r) => { this.rate = r; store.set('arate', r); this.audio.playbackRate = r; }),
        h('div', { class: 'abchips' }, this.sleepBtn, h('button', { class: 'chip', onclick: () => this.chapterList() }, icon('list'), ` ${this.chapters.length} chapitre${this.chapters.length > 1 ? 's' : ''}`))));
    document.body.append(this.el); document.body.style.overflow = 'hidden';
    this.slider.oninput = () => { this.dragging = true; const i = this.chapAt(this.now()); const a = this.chapStart(i), e = this.chapEnd(i); this.tNow.textContent = fmtT(((e - a) * this.slider.value) / 1000); };
    this.slider.onchange = () => { this.dragging = false; const i = this.chapAt(this.now()); const a = this.chapStart(i), e = this.chapEnd(i); this.seek(a + ((e - a) * this.slider.value) / 1000); };
    this.audio.ontimeupdate = () => this.tick();
    this.audio.onplay = this.audio.onpause = () => { this.playBtn.replaceChildren(icon(this.audio.paused ? 'play' : 'pause')); this.save(); };
    this.audio.onended = () => { if (this.track + 1 < this.tracks.length) this.load(this.track + 1, 0, true); else { this.save(true); toast('Fin du livre'); } };
    this.audio.onloadedmetadata = () => { const t = this.tracks[this.track]; if (!t.dur && this.audio.duration) t.dur = this.audio.duration; this.tick(true); };
    history.pushState({ reader: 1 }, ''); this.onPop = () => this.close(true); addEventListener('popstate', this.onPop);
    window.__readerBack = () => { this.close(); return true; };
    post('/api/track', { book: b.id, type: 'open', page: this.track + 1, pos: this.startPos }).catch(() => {});
    this.load(this.track, this.startPos, false);
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: b.title, artist: b.author || '', artwork: b.coverUrl ? [{ src: b.coverUrl, sizes: '512x512' }] : [] });
        navigator.mediaSession.setActionHandler('play', () => this.audio.play()); navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => this.seek(this.now() - 30)); navigator.mediaSession.setActionHandler('seekforward', () => this.seek(this.now() + 30));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.chap(-1)); navigator.mediaSession.setActionHandler('nexttrack', () => this.chap(1));
      } catch {}
    }
  }
  load(i, pos, play) {
    this.track = i; this.audio.src = this.urls[i]; this.audio.playbackRate = this.rate; this.audio.volume = 1;
    const go = () => { try { this.audio.currentTime = pos || 0; } catch {} this.audio.playbackRate = this.rate; if (play) this.audio.play().catch(() => {}); this.tick(true); };
    if (this.audio.readyState >= 1) go(); else this.audio.addEventListener('loadedmetadata', go, { once: true });
  }
  toggle() { if (this.audio.paused) { this.audio.volume = 1; this.audio.play().catch(() => toast('Lecture impossible')); } else this.audio.pause(); }
  seek(t) {
    t = Math.max(0, Math.min((this.total || Infinity) - 0.5, t)); const off = this.offsets;
    let i = this.tracks.length - 1; while (i > 0 && off[i] > t) i--;
    const play = !this.audio.paused;
    if (i !== this.track) this.load(i, t - off[i], play); else { this.audio.currentTime = t - off[i]; this.tick(true); }
  }
  chap(d) { const i = this.chapAt(this.now()); const into = this.now() - this.chapStart(i); this.seek(this.chapStart(Math.max(0, Math.min(this.chapters.length - 1, d < 0 && into > 4 ? i : i + d)))); }
  tick(force) {
    const t = this.now(), i = this.chapAt(t), a = this.chapStart(i), e = this.chapEnd(i);
    if (Sleep.mode === 'chap' && this.lastChap !== undefined && i !== this.lastChap && !this.audio.paused) { this.audio.pause(); Sleep.fire(); }
    this.lastChap = i;
    const c = this.chapters[i];
    this.chapLbl.textContent = this.chapters.length > 1 ? `Chapitre ${i + 1} sur ${this.chapters.length}${c.title ? ' · ' + c.title : ''}` : '';
    if (!this.dragging) { this.slider.value = e > a ? Math.round(((t - a) / (e - a)) * 1000) : 0; this.tNow.textContent = fmtT(t - a); }
    this.tEnd.textContent = '−' + fmtT(Math.max(0, e - t));
    const tot = this.total; this.left.textContent = tot ? `${Math.round((t / tot) * 100)} % · il reste ${fmtLeft((tot - t) / (this.rate || 1))}` : '';
    if (force || !this.savedAt || Date.now() - this.savedAt > 10000) this.save();
  }
  save(end) { if (!this.audio) return; this.savedAt = Date.now(); post('/api/track', { book: this.b.id, type: 'page', page: end ? this.tracks.length : this.track + 1, pos: Math.floor(this.audio.currentTime || 0) }).catch(() => {}); }
  fadeOut() { // la minuterie baisse le son doucement avant d'arrêter
    const a = this.audio; if (a.paused) return; let v = 1;
    const iv = setInterval(() => { v -= 0.05; if (v <= 0) { clearInterval(iv); a.pause(); a.volume = 1; } else a.volume = v; }, 400);
  }
  chapterList() {
    const cur = this.chapAt(this.now());
    const close = sheet('Chapitres', h('div', { class: 'chaplist' }, this.chapters.map((c, i) => h('button', { class: 'chaprow' + (i === cur ? ' sel' : ''), onclick: () => { close(); this.seek(this.chapStart(i)); if (this.audio.paused) this.audio.play().catch(() => {}); } },
      h('span', { class: 'chapn' }, String(i + 1)), h('span', { class: 'chapt' }, c.title || `Chapitre ${i + 1}`), h('span', { class: 'chapd' }, fmtT(this.chapEnd(i) - this.chapStart(i)))))), { wide: true });
    setTimeout(() => $('.chaprow.sel')?.scrollIntoView({ block: 'center' }), 50);
  }
  close(fromPop) {
    if (this.closed) return; this.closed = true;
    this.save(); this.audio.pause();
    removeEventListener('popstate', this.onPop); window.__readerBack = null;
    if (!fromPop && history.state?.reader) history.back();
    this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => this.el.remove();
    document.body.style.overflow = '';
    setTimeout(() => loadBooks().then(renderLibrary), 300);
  }
}

class Reader {
  constructor(b, opts) {
    this.b = b; this.opts = opts;
    this.reflow = !PAGED(b.kind) && !!window.LocalAPI; // texte repaginé pour tenir à l'écran
    this.total = b.pages; this.origPages = b.pages;
    this.page = Math.min(b.pages, Math.max(1, b.progress?.page || 1));
    this.theme = store.get('theme', 'sepia'); this.fs = store.get('fs', 19);
    this.rate = store.get('rate', 1); this.voice = store.get('voice', '');
    this.texts = new Map(); this.imgs = new Map(); this.built = new Map(); this.cur = null;
    this.playing = false; this.sIdx = 0; this.sents = [];
    this.watermark = S.me.role === 'reader' ? `${S.me.name} · ${new Date().toLocaleDateString('fr-CA')}` : '';
  }
  async mount() {
    const b = this.b;
    this.stage = h('div', { class: 'stage' });
    this.slider = h('input', { type: 'range', min: 1, max: this.total, value: this.page, 'aria-label': 'Page' });
    this.slider.oninput = () => { this.lbl.textContent = `${this.slider.value} / ${this.total}`; };
    this.slider.onchange = () => this.go(Number(this.slider.value), 0);
    this.lbl = h('span', {});
    this.left = h('span', {});
    this.audioBtn = h('button', { class: 'rbtn', title: 'Lecture audio', onclick: () => this.toggleAudio() }, icon('headphones'));
    this.print = b.kind === 'ocr'; this.dens = this.print ? Number(store.get('dens:' + b.id, 1)) || 1 : 1; // livre converti : page blanche imprimée, comme la photo
    this.el = h('div', { class: 'reader' + (PAGED(b.kind) ? ' pdf-mode' : '') + (this.print ? ' print-mode' : ''), 'data-theme': this.theme },
      h('div', { class: 'r-top' },
        h('button', { class: 'rbtn', title: 'Fermer', onclick: () => this.close() }, icon('back')),
        h('div', { class: 'ttl' }, h('b', {}, b.title), h('span', {}, b.author || '')),
        Prof.on() ? h('button', { class: 'rbtn', title: 'Le Professeur bizarroïde', onclick: () => { if (this.player) this.closePlayer(); Prof.open(b); } }, icon('prof')) : null,
        TTS.supported() ? this.audioBtn : null,
        h('button', { class: 'rbtn', title: 'Apparence', onclick: () => this.appearance() }, icon('type')),
        (b.kind === 'ocr' || (PAGED(b.kind) && b.ocr === 'done')) ? h('button', { class: 'viewchip', title: 'Changer de mode', onclick: () => this.switchView(b.kind === 'ocr' ? 'photo' : 'text') }, b.kind === 'ocr' ? 'Photo' : 'Texte') : null,
        S.me.role === 'owner' && window.LocalAPI ? h('button', { class: 'rbtn', title: 'Options du livre', 'aria-label': 'Options du livre', onclick: () => this.bookMenu() }, icon('dots')) : null),
      this.stage,
      h('div', { class: 'tapzone l', onclick: () => this.go(this.page - 1, -1) }),
      h('div', { class: 'tapzone r', onclick: () => this.go(this.page + 1, 1) }),
      h('div', { class: 'r-bottom' }, h('div', { class: 'slider' }, this.lbl, this.slider, this.left)));
    document.body.append(this.el);
    document.body.style.overflow = 'hidden';
    window.__reader = this;
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('dragstart', (e) => e.preventDefault());
    this.stage.addEventListener('click', (e) => { if (e.detail === 1) this.clickT = setTimeout(() => this.el.classList.toggle('immersive'), 340); });
    this.stage.addEventListener('dblclick', (e) => { clearTimeout(this.clickT); if (PAGED(this.b.kind) && !this.touchTap) this.zoomToggle(e.clientX, e.clientY); }); // souris
    this.setupZoom();
    // Tourner la page au doigt : la page suit le doigt et se plie (voir Curl), puis termine ou revient selon le geste
    let sx = 0, sy = 0, tracking = false, drag = null, hist = [];
    const ignore = (t) => t.closest && t.closest('.r-top, .r-bottom, .player, .scrim, input, select');
    this.el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || ignore(e.target) || this.zoom || this.zoomed() || this.pinch) { tracking = false; return; }
      this.finishTurn();
      tracking = true; drag = null; sx = e.touches[0].clientX; sy = e.touches[0].clientY; hist = [[sx, performance.now()]];
      clearTimeout(this.lpT); // appui long sur un mot : sa définition
      this.lpT = setTimeout(() => { if (!tracking || drag) return; tracking = false; this.lpFired = Date.now(); this.lookupAt(sx, sy); }, 520);
    }, { passive: true });
    this.el.addEventListener('touchmove', (e) => {
      if (!tracking || e.touches.length !== 1) return;
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      hist.push([t.clientX, performance.now()]); if (hist.length > 5) hist.shift();
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearTimeout(this.lpT);
      if (!drag) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) { tracking = false; return; }
        const dir = dx < 0 ? 1 : -1, n = this.page + dir;
        if (n < 1 || n > this.total) { drag = { dead: true, dir }; return; }
        drag = { dir, n, curl: this.startDrag(dir, n, sy - this.stage.getBoundingClientRect().top) };
      }
      if (drag.curl && drag.curl === this.dragCurl) {
        const W = drag.curl.W, k = Math.max(0, Math.min(1, Math.abs(dx) / (W * 0.85)));
        drag.curl.dy = dy * 0.5;
        drag.curl.set(drag.dir > 0 ? (dx < 0 ? k : 0) : (dx > 0 ? 1 - k : 1));
      }
    }, { passive: true });
    this.el.addEventListener('click', (e) => { if (this.lpFired && Date.now() - this.lpFired < 700) { e.stopPropagation(); e.preventDefault(); } }, true); // pas de page tournée après un appui long
    this.el.addEventListener('touchend', (e) => {
      clearTimeout(this.lpT);
      if (!tracking) return; tracking = false;
      if (!drag) return; // simple toucher : les zones de gauche et de droite s'en occupent
      if (drag.dead) { if (drag.dir > 0) toast('Fin du livre'); return; }
      const t = e.changedTouches[0], dx = t.clientX - sx;
      const [x0, t0] = hist[0], v = (t.clientX - x0) / Math.max(1, performance.now() - t0); // vitesse en px/ms
      if (!drag.curl || drag.curl !== this.dragCurl) { // page voisine pas encore prête : on tourne sans suivre le doigt
        if (Math.abs(dx) >= 40 || Math.abs(v) > 0.3) this.go(drag.n, drag.dir);
        return;
      }
      const fwd = drag.dir > 0, moved = fwd ? drag.curl.p : 1 - drag.curl.p;
      const flick = fwd ? v < -0.25 : v > 0.25, back = fwd ? v > 0.25 : v < -0.25;
      this.endDrag(drag, !back && (flick || moved > 0.3));
    }, { passive: true });
    this.el.addEventListener('touchcancel', () => { tracking = false; if (drag && drag.curl === this.dragCurl) this.endDrag(drag, false); }, { passive: true });
    this.onKey = (e) => {
      if ($('.scrim')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.go(this.page + 1, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.go(this.page - 1, -1);
      else if (e.key === 'Escape') this.close();
      else if (e.key === ' ' && this.player) { e.preventDefault(); this.playing ? this.pause() : this.play(); }
    };
    addEventListener('keydown', this.onKey);
    this.onResize = () => { clearTimeout(this.rt); this.rt = setTimeout(() => { if (this.reflow) this.relayout(); else { this.resetBuilt(); this.render(0); } }, 220); };
    this.onFonts = () => { if (this.reflow && this.pages) { Reader.cache.clear(); this.curKey = null; this.relayout(); } };
    document.fonts?.addEventListener?.('loadingdone', this.onFonts);
    addEventListener('resize', this.onResize);
    history.pushState({ reader: 1 }, '');
    this.onPop = () => this.close(true);
    addEventListener('popstate', this.onPop);
    window.__readerBack = () => { this.close(); return true; };
    if (this.reflow) {
      this.stage.append(h('div', { class: 'loading' }, 'Mise en page…'));
      await this.paginate();
      this.stage.querySelector('.loading')?.remove();
      if (this.closed) return;
      this.page = this.startPage();
    }
    post('/api/track', { book: b.id, type: 'open', page: b.kind === 'ocr' ? Math.max(1, Math.round((this.page / this.total) * this.origPages)) : this.page }).catch(() => {});
    await this.render(0);
    if (this.opts.audio) this.toggleAudio(true);
  }
  // ---- Mise en page : le texte est découpé pour que chaque page tienne entièrement à l'écran ----
  measureDims() {
    const top = $('.r-top', this.el).offsetHeight, bot = $('.r-bottom', this.el).offsetHeight;
    const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
    if (this.print) { // feuille blanche posée sur fond noir, proportions d'une vraie page
      const avail = Math.max(240, sh - top - bot - 16), sheetW = Math.min(sw, 720);
      const sheetH = Math.min(avail, Math.round(sheetW * 1.8)), st = top + 8 + Math.round((avail - sheetH) / 2);
      this.PX = Math.round(sheetW * 0.08); this.PT = Math.round(sheetH * 0.06); this.PB = Math.round(sheetH * 0.07) + 14;
      this.W = Math.max(200, sheetW - this.PX * 2); this.H = Math.max(160, sheetH - this.PT - this.PB);
      for (const [k, v] of [['--st', st], ['--sh', sheetH], ['--sw', sheetW], ['--pt', this.PT], ['--pb', this.PB], ['--px', this.PX]]) this.stage.style.setProperty(k, v + 'px');
      this.el.style.setProperty('--dens', this.dens || 1);
      return `${this.b.id}|print|${this.W}x${this.H}|${this.fs}|${this.dens || 1}`;
    }
    this.PT = top + 38; this.PB = bot + 40; this.PX = sw < 520 ? 24 : 32; // place pour le titre courant en haut et le numéro de page en bas
    this.W = Math.max(220, Math.min(680, sw - this.PX * 2)); this.H = Math.max(200, sh - this.PT - this.PB);
    this.stage.style.setProperty('--pt', this.PT + 'px'); this.stage.style.setProperty('--pb', this.PB + 'px'); this.stage.style.setProperty('--px', this.PX + 'px');
    return `${this.b.id}|${this.W}x${this.H}|${this.fs}`;
  }
  async paginate() {
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch {}
    const key = this.measureDims();
    this.curKey = key;
    const hit = Reader.cache.get(key);
    if (hit) { this.pages = hit.pages; this.pageStarts = hit.starts; return this.afterPaginate(); }
    const paras = await LocalAPI.paragraphs(this.b.id, { ocr: this.b.kind === 'ocr' });
    const Hh = this.H - 6;
    const meas = h('div', { class: 'prose reflow', style: { position: 'absolute', left: '-9999px', top: '0', visibility: 'hidden', width: this.W + 'px', height: Hh + 'px', overflow: 'hidden', '--fs': this.fs + 'px' } });
    this.el.append(meas);
    const fits = () => meas.scrollHeight <= Hh + 1;
    const mk = (it) => { const el = document.createElement(it.h ? 'h3' : 'p'); el.className = it.h ? 'hd' : (it.cont ? 'cont' : ''); el.textContent = it.text; return el; };
    const pages = []; let cur = [];
    const flush = () => { // un titre ne reste jamais seul en bas de page
      if (cur.length > 1 && cur[cur.length - 1].h) { const hd = cur.pop(); pages.push(cur); cur = [hd]; }
      else { if (cur.length) pages.push(cur); cur = []; }
      meas.replaceChildren(...cur.map(mk));
    };
    const prefixFit = (el, parts) => { // nombre maximal de morceaux qui tiennent dans la page
      let lo = 0, hi = parts.length - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); el.textContent = parts.slice(0, mid).join('').trimEnd(); if (fits()) lo = mid; else hi = mid - 1; }
      return lo;
    };
    let offset = 0;
    for (let idx = 0; idx < paras.length; idx++) {
      if ((idx & 63) === 63) { await new Promise((r) => setTimeout(r, 0)); if (this.closed) { meas.remove(); return; } }
      const raw = paras[idx]; const isH = /^#{1,3} /.test(raw);
      let remaining = isH ? raw.replace(/^#{1,3} /, '') : raw;
      const startOff = offset; offset += raw.length + 2;
      let consumed = 0, cont = false, guard = 0;
      while (remaining && guard++ < 5000) {
        const it = { h: isH, text: remaining, cont, pos: startOff + consumed };
        const el = mk(it); meas.append(el);
        if (fits()) { cur.push(it); break; }
        const parts = isH ? [remaining] : (remaining.match(/\S+\s*/g) || [remaining]); // coupe au mot près : les pages se remplissent jusqu'en bas
        let k = parts.length > 1 ? prefixFit(el, parts) : 0;
        if (cur.length && k < 6) k = 0; // pas de ligne orpheline en bas de page : on passe à la suivante
        if (k === 0 && cur.length) { flush(); continue; } // on recommence sur une page vide
        if (k === 0) k = 1; // page vide : au moins un morceau, pour toujours avancer
        const taken = parts.slice(0, k).join('');
        cur.push({ h: isH, text: taken.trimEnd(), cont, pos: startOff + consumed });
        consumed += taken.length; remaining = remaining.slice(taken.length); cont = true;
        flush();
      }
    }
    if (cur.length) pages.push(cur);
    meas.remove();
    // livre converti : jamais plus de 4 pages texte par page photo (le texte se resserre au besoin)
    const cap = 4 * Math.max(1, this.origPages || 0);
    if (this.print && this.origPages && pages.length > cap && (this.dens || 1) > 0.7) {
      this.dens = Math.max(0.7, (this.dens || 1) * Math.sqrt(cap / pages.length) * 0.96); store.set('dens:' + this.b.id, this.dens);
      return this.paginate();
    }
    if (!pages.length) pages.push([{ h: false, text: '', cont: false, pos: 0 }]);
    this.pages = pages; this.pageStarts = pages.map((p) => p[0].pos);
    Reader.cache.set(key, { pages: this.pages, starts: this.pageStarts }); if (Reader.cache.size > 6) Reader.cache.delete(Reader.cache.keys().next().value);
    return this.afterPaginate();
  }
  afterPaginate() {
    this.total = this.pages.length; this.slider.max = this.total; this.b.pages = this.total;
  }
  pageOfPos(pos) {
    const st = this.pageStarts; let lo = 0, hi = st.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (st[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo + 1;
  }
  startPage() {
    const pr = this.b.progress; if (!pr) return 1;
    if (pr.pos != null && this.b.kind !== 'ocr') return this.pageOfPos(pr.pos);
    return Math.min(this.total, Math.max(1, Math.round(((pr.page - 1) / Math.max(1, this.origPages)) * this.total) + 1));
  }
  async relayout() {
    if (!this.reflow || this.closed || !this.pageStarts) return;
    const pos = this.pageStarts[this.page - 1] ?? 0;
    const was = this.playing; if (was) this.pause();
    const prev = this.curKey;
    const key = this.measureDims();
    if (key === prev) return;
    await this.paginate();
    if (this.closed) return;
    this.resetBuilt(); this.page = this.pageOfPos(pos); await this.render(0);
  }
  async drawReflow(pg, n) {
    const items = this.pages[n - 1] || [];
    const prose = h('article', { class: 'prose reflow' + (n === 1 && items[0] && !items[0].cont && !items[0].h ? ' first' : ''), style: { '--fs': this.fs + 'px', width: this.W + 'px' } });
    let i = 0;
    for (const it of items) {
      const caps = it.h && it.text === it.text.toUpperCase() && /\p{Lu}{3}/u.test(it.text);
      const el = h(it.h ? 'h3' : 'p', { class: it.h ? 'hd' + (caps ? ' caps' : '') : (it.cont ? 'cont' : '') });
      sentences(it.text).forEach((x) => { el.append(h('span', { class: 's', 'data-i': i++ }, x), ' '); });
      prose.append(el);
    }
    pg._sents = $$('.s', prose).map((x) => x.textContent);
    pg.replaceChildren(prose);
  }
  async getText(n) {
    if (!this.texts.has(n)) this.texts.set(n, api(`/api/books/${this.b.id}/text/${n}`).then((d) => d.text).catch(() => ''));
    return this.texts.get(n);
  }
  async getImg(n) {
    if (!this.imgs.has(n)) {
      this.imgs.set(n, window.LocalAPI ? LocalAPI.pageCanvas(this.b.id, n) : fetch(`/api/books/${this.b.id}/page/${n}`, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error(r.status === 429 ? 'Doucement ! Patiente quelques secondes.' : 'Page indisponible'); return r.blob(); }).then((bl) => createImageBitmap(bl)));
      this.imgs.get(n).catch(() => this.imgs.delete(n));
      if (this.imgs.size > 8) { const k = [...this.imgs.keys()].find((x) => Math.abs(x - n) > 3); if (k) { const old = this.imgs.get(k); this.imgs.delete(k); old.then((im) => setTimeout(() => { if (im?.close) im.close(); else if (window.LocalAPI?.freeCanvas) LocalAPI.freeCanvas(im); }, 5000)).catch(() => {}); } }
    }
    return this.imgs.get(n);
  }
  // ---- Pages : chaque page est dessinée d'avance, pour tourner sans attente ----
  pageEl(n) {
    let e = this.built.get(n);
    if (!e) {
      const b = this.b, pg = h('div', { class: 'page ' + b.kind + (this.reflow ? ' reflow' : '') + (this.zoom ? ' zoom' : '') });
      e = { pg, ready: false };
      e.p = (async () => {
        try { if (PAGED(b.kind)) await this.drawPdf(pg, n); else if (this.reflow) await this.drawReflow(pg, n); else await this.drawText(pg, n); }
        catch (err) { pg.replaceChildren(h('div', { class: 'loading' }, err.message)); e.failed = true; }
        pg.append(h('div', { class: 'folio' }, String(n)));
        if (this.reflow) pg.append(h('div', { class: 'runhead' }, this.b.title)); // titre courant, comme en haut d'une page de livre
        e.ready = true; return pg;
      })();
      this.built.set(n, e);
    }
    return e;
  }
  preload() { // garde la page courante et ses deux voisines prêtes
    const n = this.page;
    for (const [k, e] of this.built) if (Math.abs(k - n) > 1 && e.pg !== this.cur) { if (!e.pg.isConnected) this.built.delete(k); }
    if (n < this.total) this.pageEl(n + 1);
    if (n > 1) this.pageEl(n - 1);
  }
  resetBuilt() { this.finishTurn(); this.cancelDrag(); this.built.clear(); }
  tidy() { $$('.page', this.stage).forEach((x) => { if (x !== this.cur) x.remove(); }); }
  static still() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  updateBar(n) {
    this.slider.value = n; this.lbl.textContent = `${n} / ${this.total}`;
    const rest = this.total - n; this.left.textContent = rest ? `${rest} page${rest > 1 ? 's' : ''} restante${rest > 1 ? 's' : ''}` : 'Dernière page';
  }
  async render(dir) {
    const n = this.page;
    this.finishTurn(); this.cancelDrag();
    this.updateBar(n);
    const e = this.pageEl(n);
    if (!e.ready) {
      if (!this.cur && !$('.page', this.stage)) this.stage.append(h('div', { class: 'page' }, h('div', { class: 'loading' }, 'Chargement…')));
      await e.p;
      if (n !== this.page || this.closed) return;
      this.finishTurn(); this.cancelDrag();
    }
    if (dir && this.cur && this.cur !== e.pg && !Reader.still()) {
      const fwd = dir > 0, old = this.cur;
      const curl = new Curl(this.stage, fwd ? old : e.pg, fwd ? e.pg : old);
      curl.lift = (p) => -curl.H * 0.08 * Math.sin(Math.PI * p); // la page se soulève un peu en tournant
      curl.set(fwd ? 0 : 1);
      return this.animate(curl, fwd ? 0 : 1, fwd ? 1 : 0, 470, easeInOut, () => this.setCurrent(n, e));
    }
    this.setCurrent(n, e);
  }
  setCurrent(n, e) {
    const b = this.b, pg = e.pg;
    if (!pg.isConnected) this.stage.append(pg);
    if (this.cur && this.cur !== pg) this.resetZoom();
    this.cur = pg; this.tidy(); this.lookEl?.remove(); this.lookMark?.remove(); this.lookEl = this.lookMark = null;
    this.sents = pg._sents || [];
    if (e.failed) this.built.delete(n);
    if (n !== this.page) return;
    clearTimeout(this.trackT);
    this.sendTrack = () => { this.sendTrack = null; // en mode texte d'un livre photo, la position est rapportée en pages d'origine
      if (b.kind === 'ocr') return post('/api/track', { book: b.id, type: 'page', page: Math.max(1, Math.round((n / this.total) * this.origPages)) }).catch(() => {});
      return post('/api/track', { book: b.id, type: 'page', page: n, ...(this.reflow ? { pages: this.total, pos: this.pageStarts[n - 1] } : {}) }).catch(() => {}); };
    this.trackT = setTimeout(() => this.sendTrack && this.sendTrack(), 700);
    this.preload();
    if (this.playing) this.highlight();
  }
  animate(curl, from, to, ms, ease, done) {
    this.finishTurn();
    return new Promise((res) => {
      const t0 = performance.now();
      const end = () => { cancelAnimationFrame(this.raf); this.turning = null; curl.destroy(); done(); res(); };
      this.turning = { end };
      const step = (now) => { const k = Math.min(1, (now - t0) / ms); curl.set(from + (to - from) * ease(k)); if (k < 1) this.raf = requestAnimationFrame(step); else end(); };
      this.raf = requestAnimationFrame(step);
    });
  }
  finishTurn() { if (this.turning) this.turning.end(); } // termine net une page en train de tourner
  startDrag(dir, n, y0) {
    if (Reader.still() || !this.cur) return null;
    const e = this.built.get(n);
    if (!e || !e.ready) { this.pageEl(n); return null; }
    const fwd = dir > 0;
    const curl = new Curl(this.stage, fwd ? this.cur : e.pg, fwd ? e.pg : this.cur);
    curl.y0 = Math.max(curl.Y + curl.H * 0.12, Math.min(curl.Y + curl.H * 0.95, y0));
    curl.set(fwd ? 0 : 1);
    this.dragCurl = curl;
    return curl;
  }
  cancelDrag() { const c = this.dragCurl; if (!c) return; this.dragCurl = null; c.destroy(); this.tidy(); }
  endDrag(drag, commit) {
    const c = this.dragCurl; if (!c) return; this.dragCurl = null;
    const to = (drag.dir > 0) === commit ? 1 : 0;
    this.animate(c, c.p, to, 110 + 300 * Math.abs(to - c.p), easeOut, () => { if (commit) this.go(drag.n, 0); else this.tidy(); });
  }
  async drawPdf(pg, n) {
    const bmp = await this.getImg(n);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
    const availW = this.zoom ? sw - 28 : sw, availH = this.zoom ? sh - 150 : sh - 16;
    let w = Math.min(availW, availH * (bmp.width / bmp.height));
    if (this.zoom) w = Math.max(availW, w) * 2;
    w = Math.max(200, Math.floor(w)); const hgt = Math.floor(w * (bmp.height / bmp.width));
    const c = h('canvas', { class: 'pdf-canvas', width: Math.floor(w * dpr), height: Math.floor(hgt * dpr), style: { width: w + 'px', height: hgt + 'px' } });
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    if (this.watermark) {
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#000'; ctx.font = `${Math.round(16 * dpr)}px Inter, sans-serif`;
      ctx.translate(c.width / 2, c.height / 2); ctx.rotate(-Math.PI / 6);
      for (let y = -c.height; y < c.height; y += 110 * dpr) for (let x = -c.width; x < c.width; x += 280 * dpr) ctx.fillText(this.watermark, x, y);
      ctx.restore();
    }
    if (!this.zoom) { // la feuille, centrée sur le fond noir, a exactement la taille de la page du PDF
      Object.assign(pg.style, { left: Math.round((sw - w) / 2) + 'px', top: Math.round((sh - hgt) / 2) + 'px', width: w + 'px', height: hgt + 'px' });
      c.style.width = '100%'; c.style.height = '100%';
    }
    pg.replaceChildren(c);
  }
  async drawText(pg, n) {
    const t = await this.getText(n);
    const prose = h('article', { class: 'prose' + (n === 1 ? ' first' : ''), style: { '--fs': this.fs + 'px' } });
    let i = 0;
    const paras = t.split(/\n{2,}/);
    for (const para of paras) {
      const isH = /^#{1,3} /.test(para);
      const ss = sentences(isH ? para.replace(/^#{1,3} /, '') : para);
      if (!ss.length) continue;
      const el = h(isH ? 'h3' : 'p', isH ? { class: 'hd' } : {});
      ss.forEach((x) => { el.append(h('span', { class: 's', 'data-i': i++ }, x), ' '); });
      prose.append(el);
    }
    // aligne les phrases de la page avec celles de l'affichage
    pg._sents = $$('.s', prose).map((x) => x.textContent);
    pg.replaceChildren(prose);
  }
  go(n, dir) {
    n = Math.max(1, Math.min(this.total, n));
    if (n === this.page && dir) { if (dir > 0 && n === this.total) toast('Fin du livre'); return; }
    const was = this.playing;
    if (was) { this.stopSpeech(); this.sIdx = 0; }
    this.page = n; this.render(dir).then(() => { if (was) this.play(); });
  }
  toggleZoom() { if (!PAGED(this.b.kind)) return; this.zoom = !this.zoom; this.el.classList.toggle('zooming', this.zoom); this.resetBuilt(); this.render(0); }
  appearance() {
    const themes = [['sepia', 'Sépia'], ['clair', 'Clair'], ['nuit', 'Nuit']];
    const seg = h('div', { class: 'seg' }, themes.map(([k, l]) => h('button', { class: k === this.theme ? 'sel' : '', onclick: (e) => { this.theme = k; store.set('theme', k); this.el.dataset.theme = k; $$('button', seg).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); } }, l)));
    const size = h('div', { class: 'seg' }, h('button', { onclick: () => this.setFs(-1) }, 'A−'), h('button', { onclick: () => this.setFs(1) }, 'A+'));
    sheet('Apparence', h('div', {}, h('div', { class: 'field' }, 'Fond', seg),
      !PAGED(this.b.kind) ? h('div', { class: 'field' }, 'Taille du texte', size) : h('p', { class: 'muted' }, 'Touche deux fois une page pour zoomer.')));
  }
  setFs(d) {
    this.fs = Math.max(14, Math.min(30, this.fs + d)); store.set('fs', this.fs);
    if (this.reflow) { clearTimeout(this.fsT); this.fsT = setTimeout(() => this.relayout(), 250); return; }
    const p = this.cur && $('.prose', this.cur); if (p) p.style.setProperty('--fs', this.fs + 'px');
    const cur = this.cur; this.resetBuilt(); // les pages voisines déjà prêtes seront refaites à la nouvelle taille
    if (cur) this.built.set(this.page, { pg: cur, ready: true, p: Promise.resolve(cur) });
    this.preload();
  }

  // ---- Audio ----
  toggleAudio(autoplay) {
    if (this.player) { this.closePlayer(); return; }
    this.audioBtn.classList.add('on');
    this.cap = h('div', { class: 'cap' }, 'Appuie sur lecture pour écouter cette page.');
    this.playBtn = h('button', { class: 'rbtn play', title: 'Lecture', onclick: () => this.playing ? this.pause() : this.play() }, icon('play'));
    this.rate = nearestSpeed(this.rate);
    const speed = speedRow(() => this.rate, (r) => { this.rate = r; store.set('rate', r); if (this.playing) { this.stopSpeech(); this.play(); } });
    let voiceSel = null;
    const fillVoices = () => {
      const vs = TTS.voices(); if (!vs.length || !voiceSel) return;
      voiceSel.replaceChildren(...vs.slice(0, 40).map((v) => h('option', { value: v.name, selected: v.name === this.voice ? true : null }, `${v.name.replace(/Microsoft |Google |\(.*\)/g, '').trim()} · ${v.lang}`)));
    };
    if (!TTS.native()) { voiceSel = h('select', { 'aria-label': 'Voix', onchange: () => { this.voice = voiceSel.value; store.set('voice', this.voice); if (this.playing) { this.stopSpeech(); this.play(); } } }); fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
    this.toneBtn = h('button', { class: 'chip', title: 'Voix et ton', onclick: () => openVoices() }, icon('voice'), ' ', Voice.toneOf(Voice.tone())[1]);
    this.sleepBtn = Sleep.chip(() => this.pause(), { chapters: !PAGED(this.b.kind), pages: true });
    this.player = h('div', { class: 'player paused' }, this.cap,
      h('div', { class: 'ctl' },
        this.sleepBtn,
        h('button', { class: 'rbtn', title: 'Phrase précédente', onclick: () => this.skip(-1) }, icon('prev')),
        this.playBtn,
        h('button', { class: 'rbtn', title: 'Phrase suivante', onclick: () => this.skip(1) }, icon('next')),
        this.toneBtn),
      speed,
      h('div', { class: 'jumps' }, [[-600, '−10 min'], [-180, '−3 min'], [-30, '−30 s'], [30, '+30 s'], [180, '+3 min'], [600, '+10 min']]
        .map(([sec, l]) => h('button', { class: 'jump' + (sec > 0 ? ' fwd' : ''), title: (sec > 0 ? 'Avancer de ' : 'Reculer de ') + l.slice(1), onclick: () => this.jump(sec) }, l))));
    this.el.append(this.player);
    if (autoplay) this.play();
  }
  closePlayer() { this.pause(); this.player?.remove(); this.player = null; this.audioBtn.classList.remove('on'); $$('.s.cur', this.el).forEach((x) => x.classList.remove('cur')); }
  async play() {
    if (!this.player) return;
    if (PAGED(this.b.kind)) this.sents = sentences(await this.getText(this.page));
    if (this.sents.length && this.page < this.total && Legal.skipPage(this.sents.join(' '), this.page, this.total)) { // page de droits d'auteur : on passe
      this.cap.textContent = 'Page de droits d\'auteur et mentions légales : passée.'; this.playing = true; this.setPlayUi(); this.sIdx = 0;
      setTimeout(() => this.playing && this.go(this.page + 1, 1), 700); return;
    }
    if (!this.sents.length) {
      // Page sans texte (couverture, illustration) : on passe à la suivante. Plusieurs d'affilée : le livre est sans doute en photos
      this.noText = (this.noText || 0) + 1;
      const conv = Ocr.on() ? h('button', { class: 'chip', onclick: () => { this.pause(); Ocr.run(S.books.find((x) => x.id === this.b.id) || this.b, this.page); } }, 'Convertir en texte') : '';
      if (this.page < this.total && this.noText <= 4) {
        this.cap.replaceChildren(`Page ${this.page} : image sans texte, passée.`);
        this.playing = true; this.setPlayUi(); setTimeout(() => this.playing && this.go(this.page + 1, 1), 900); return;
      }
      this.noText = 0; this.playing = false; this.setPlayUi();
      this.cap.replaceChildren(this.page < this.total ? 'Ces pages sont des photos : il n\'y a pas de texte à lire. ' : 'Fin du livre. ', this.page < this.total ? conv : '');
      return;
    }
    this.noText = 0;
    if (this.sIdx >= this.sents.length) this.sIdx = 0;
    if (!this.playing) post('/api/track', { book: this.b.id, type: 'audio', page: this.page }).catch(() => {});
    this.playing = true; this.setPlayUi(); this.speakCurrent();
    AutoRemote.state(this);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: this.b.title, artist: this.b.author || S.me.library });
      navigator.mediaSession.setActionHandler('play', () => this.play()); navigator.mediaSession.setActionHandler('pause', () => this.pause());
    }
  }
  speakCurrent() {
    const token = (this.tok = (this.tok || 0) + 1);
    while (this.sIdx < this.sents.length && Legal.skipSentence(this.sents[this.sIdx], this.page, this.total)) this.sIdx++; // mention légale isolée
    if (this.sIdx >= this.sents.length) { if (this.page < this.total) { this.sIdx = 0; this.go(this.page + 1, 1); } else this.pause(); return; }
    const s = this.sents[this.sIdx];
    this.highlight();
    const t0 = Date.now();
    const sh = Voice.shape(s, this.sIdx, this.rate);
    TTS.speak(Pron.say(s), sh.rate, this.voice || Voice.effective(), () => {
      if (token !== this.tok || !this.playing) return;
      // Garde-fou : si la synthèse vocale échoue (fin quasi instantanée), on s'arrête au lieu de défiler tout le livre
      if (s.length > 20 && Date.now() - t0 < 120) { this.quick = (this.quick || 0) + 1; } else this.quick = 0;
      if (this.quick >= 3) { this.quick = 0; this.pause(); this.cap.textContent = 'La voix du téléphone ne répond pas. Vérifie la synthèse vocale dans les réglages de l\'appareil.'; return; }
      this.sIdx++;
      if (Sleep.mode === 'chap' && this.headAt(this.sIdx)) { this.pause(); Sleep.fire(); return; }
      if (Sleep.mode === 'page' && this.sIdx >= this.sents.length) { this.pause(); Sleep.fire(); return; }
      if (this.sIdx < this.sents.length) this.speakCurrent();
      else if (this.page < this.total) {
        const nx = this.reflow ? (this.pages[this.page] || [])[0] : null; // la page suivante commence-t-elle un chapitre ?
        if (Sleep.mode === 'chap' && nx && nx.h && !nx.cont) { this.pause(); this.sIdx = 0; this.go(this.page + 1, 1); Sleep.fire(); return; }
        this.sIdx = 0; this.go(this.page + 1, 1);
      }
      else { this.pause(); this.cap.textContent = 'Fin du livre.'; }
    });
  }
  highlight() {
    if (!this.cap) return;
    const s = this.sents[this.sIdx] || '';
    this.cap.replaceChildren(h('span', { class: 'wave' }, h('i'), h('i'), h('i'), h('i')), s);
    const root = this.cur || this.el;
    $$('.s', root).forEach((x) => x.classList.toggle('cur', Number(x.dataset.i) === this.sIdx));
    const cur = $('.s.cur', root); if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // ---- Appui long : définition du mot, traduction si la phrase est en anglais ----
  // ---- Zoom fluide (PDF) : pincer, glisser à un doigt, toucher deux fois. Le mouvement est fait par la carte graphique ;
  //      la page est redessinée plus nette quand les doigts se lèvent ----
  zs() { return this.zst || (this.zst = { s: 1, x: 0, y: 0 }); }
  zoomed() { return this.zs().s > 1.01; }
  applyZoom(anim) {
    const pg = this.cur; if (!pg) return; const z = this.zs();
    pg.style.transition = anim ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
    pg.style.transformOrigin = '0 0';
    pg.style.transform = z.s > 1.001 ? `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.s})` : '';
    this.el.classList.toggle('zoomed', z.s > 1.01);
    clearTimeout(this.sharpT); if (z.s > 1.25) this.sharpT = setTimeout(() => this.sharpen(), 280);
  }
  clampZoom() {
    const z = this.zs(), pg = this.cur; if (!pg) return;
    const W = this.stage.clientWidth, H = this.stage.clientHeight, L = pg.offsetLeft, T = pg.offsetTop, w = pg.offsetWidth * z.s, hh = pg.offsetHeight * z.s;
    z.x = w <= W ? (W - w) / 2 - L : Math.min(-L, Math.max(W - w - L, z.x));
    z.y = hh <= H ? (H - hh) / 2 - T : Math.min(-T, Math.max(H - hh - T, z.y));
  }
  zoomAt(s1, px, py, anim) { // garde sous le doigt le même point de la page
    const z = this.zs(), pg = this.cur; if (!pg) return;
    s1 = Math.max(1, Math.min(6, s1));
    const L = pg.offsetLeft, T = pg.offsetTop, ux = (px - L - z.x) / z.s, uy = (py - T - z.y) / z.s;
    z.s = s1; z.x = px - L - ux * s1; z.y = py - T - uy * s1;
    if (s1 <= 1.001) { z.s = 1; z.x = 0; z.y = 0; } else this.clampZoom();
    this.applyZoom(anim);
  }
  zoomToggle(cx, cy) { const r = this.stage.getBoundingClientRect(); if (this.zoomed()) this.zoomAt(1, 0, 0, true); else this.zoomAt(2.5, cx - r.left, cy - r.top, true); }
  resetZoom() { const z = this.zs(); if (z.s === 1 && !this.cur?.style.transform) return; z.s = 1; z.x = 0; z.y = 0; if (this.cur) { this.cur.style.transform = ''; this.cur.style.transition = 'none'; } this.el.classList.remove('zoomed'); }
  async sharpen() {
    const pg = this.cur, z = this.zs(); if (!pg || !PAGED(this.b.kind) || !window.LocalAPI?.pageCanvasAt) return;
    const c = $('.pdf-canvas', pg); if (!c) return;
    const want = Math.min(3000, Math.round(c.clientWidth * Math.min(devicePixelRatio || 1, 3) * z.s));
    if (c.width >= want * 0.92) return;
    const n = this.page;
    try {
      const hi = await LocalAPI.pageCanvasAt(this.b.id, n, want);
      if (n !== this.page || this.cur !== pg) return;
      c.width = hi.width; c.height = hi.height; c.getContext('2d').drawImage(hi, 0, 0);
    } catch {}
  }
  setupZoom() {
    if (!PAGED(this.b.kind)) return;
    let pinch = null, pan = null, tap = null, lastTap = null;
    const pt = (t) => { const r = this.stage.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    this.el.addEventListener('touchstart', (e) => {
      if (e.target.closest?.('.r-top, .r-bottom, .player, .scrim, .lookup')) return;
      if (e.touches.length === 2) {
        clearTimeout(this.lpT); this.cancelDrag(); this.finishTurn(); pan = null; tap = null;
        const a = pt(e.touches[0]), b = pt(e.touches[1]), z = this.zs(), pg = this.cur; if (!pg) return;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: z.s, ux: (m.x - pg.offsetLeft - z.x) / z.s, uy: (m.y - pg.offsetTop - z.y) / z.s }; this.pinch = true;
      } else if (e.touches.length === 1) {
        const p0 = pt(e.touches[0]); tap = { x: p0.x, y: p0.y, cx: e.touches[0].clientX, cy: e.touches[0].clientY, t: performance.now(), moved: false };
        if (this.zoomed()) { const z = this.zs(); pan = { x: p0.x, y: p0.y, zx: z.x, zy: z.y }; }
      }
    }, { passive: true });
    this.el.addEventListener('touchmove', (e) => {
      if (pinch && e.touches.length === 2) {
        const a = pt(e.touches[0]), b = pt(e.touches[1]), z = this.zs(), pg = this.cur; if (!pg) return;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        let s1 = pinch.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0);
        s1 = s1 < 1 ? 1 - (1 - s1) * 0.35 : Math.min(6.5, s1); // un peu d'élasticité sous 1
        z.s = s1; z.x = m.x - pg.offsetLeft - pinch.ux * s1; z.y = m.y - pg.offsetTop - pinch.uy * s1;
        this.applyZoom(false); return;
      }
      if (tap && e.touches.length === 1) { const p1 = pt(e.touches[0]); if (Math.hypot(p1.x - tap.x, p1.y - tap.y) > 10) { tap.moved = true; clearTimeout(this.lpT); } }
      if (pan && e.touches.length === 1) { const p1 = pt(e.touches[0]), z = this.zs(); z.x = pan.zx + (p1.x - pan.x); z.y = pan.zy + (p1.y - pan.y); this.clampZoom(); this.applyZoom(false); }
    }, { passive: true });
    this.el.addEventListener('touchend', (e) => {
      if (pinch && e.touches.length < 2) {
        pinch = null; this.pinch = false; const z = this.zs();
        if (z.s < 1.05) { z.s = 1; z.x = 0; z.y = 0; this.applyZoom(true); } else { if (z.s > 6) z.s = 6; this.clampZoom(); this.applyZoom(true); }
        if (e.touches.length === 1 && this.zoomed()) { const p0 = pt(e.touches[0]); pan = { x: p0.x, y: p0.y, zx: z.x, zy: z.y }; }
        tap = null; return;
      }
      if (e.touches.length === 0) {
        pan = null;
        if (tap && !tap.moved && performance.now() - tap.t < 260) { // double toucher : zoom à cet endroit, ou retour
          if (lastTap && performance.now() - lastTap.t < 320 && Math.hypot(lastTap.x - tap.x, lastTap.y - tap.y) < 40) {
            clearTimeout(this.clickT); lastTap = null; this.touchTap = true; setTimeout(() => { this.touchTap = false; }, 500);
            this.zoomToggle(tap.cx, tap.cy);
          } else lastTap = { ...tap, t: performance.now() };
        }
        tap = null;
      }
    }, { passive: true });
  }
  // Texte ⇄ Photo : rouvre le livre dans l'autre mode, à la même page
  switchView(v) {
    const orig = S.books.find((x) => x.id === this.b.id); if (!orig) return;
    const frac = (this.page - 1) / Math.max(1, this.total - 1);
    store.set('view:' + orig.id, v);
    const page = Math.max(1, Math.round(frac * (orig.pages - 1)) + 1);
    this.close(); orig.progress = { ...(orig.progress || {}), page, pos: null };
    setTimeout(() => openBook(orig, null), 260);
  }
  bookMenu() { if (this.playing) this.pause(); editBook(S.books.find((x) => x.id === this.b.id) || this.b); }
  async lookupAt(x, y) {
    if (!this.cur || this.zoom) return;
    const menu = () => { try { navigator.vibrate?.(12); } catch {} this.bookMenu(); }; // appui long hors d'un mot : les options du livre
    let word = null, sentence = '', box = null;
    if (PAGED(this.b.kind)) {
      const c = $('.pdf-canvas', this.cur); if (!c || !window.LocalAPI?.pageItems) return;
      const r = c.getBoundingClientRect(); const nx = (x - r.left) / r.width, ny = (y - r.top) / r.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return menu();
      let items = []; try { items = await LocalAPI.pageItems(this.b.id, this.page); } catch { return menu(); }
      const pad = 0.006; const it = items.find((i) => nx >= i.l - pad && nx <= i.l + i.w + pad && ny >= i.t - pad && ny <= i.t + i.h + pad);
      if (!it) return menu();
      const ci = Math.max(0, Math.min(it.s.length - 1, Math.floor(((nx - it.l) / it.w) * it.s.length)));
      word = wordAt(it.s, ci);
      const pt = await this.getText(this.page); sentence = sentences(pt).find((s) => s.includes(it.s.trim().slice(0, 24))) || it.s;
      box = { left: r.left + it.l * r.width, top: r.top + it.t * r.height, width: it.w * r.width, height: it.h * r.height };
    } else {
      this.el.classList.add('looking');
      const rg = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
      this.el.classList.remove('looking');
      const node = rg?.startContainer; if (!node || node.nodeType !== 3 || !this.cur.contains(node)) return menu();
      word = wordAt(node.data, rg.startOffset);
      sentence = node.parentElement?.closest('.s')?.textContent || node.data;
      try { const isW = (c) => /[\p{L}\p{M}'’\-]/u.test(c || ''); let a = rg.startOffset, b = a; while (a > 0 && isW(node.data[a - 1])) a--; while (b < node.data.length && isW(node.data[b])) b++; const wr = document.createRange(); wr.setStart(node, a); wr.setEnd(node, b); box = wr.getBoundingClientRect(); } catch {}
    }
    if (!word) return menu();
    try { navigator.vibrate?.(12); } catch {}
    this.showLookup(word, sentence, box);
  }
  showLookup(word, sentence, box) {
    this.lookEl?.remove(); this.lookMark?.remove();
    if (box) { this.lookMark = h('div', { class: 'lookmark', style: { left: box.left - 3 + 'px', top: box.top - 2 + 'px', width: box.width + 6 + 'px', height: box.height + 4 + 'px' } }); this.el.append(this.lookMark); }
    const body = h('div', { class: 'lookbody' }, h('p', { class: 'muted' }, 'Recherche dans le Wiktionnaire…'));
    const en = isEnglish(sentence);
    const trBox = h('div', { class: 'looktr' });
    const doTr = async (what, label) => {
      trBox.replaceChildren(h('p', { class: 'muted' }, 'Traduction…'));
      try { const t = await translateEn(what); trBox.replaceChildren(h('small', {}, label), h('p', {}, t || 'Pas de traduction trouvée.')); }
      catch { trBox.replaceChildren(h('p', { class: 'muted' }, 'Il faut Internet pour traduire.')); }
    };
    const close = () => { this.lookEl?.remove(); this.lookMark?.remove(); this.lookEl = this.lookMark = null; };
    this.lookEl = h('div', { class: 'lookup' },
      h('div', { class: 'lookhead' }, h('b', {}, word),
        h('button', { class: 'rbtn', title: 'Écouter le mot', onclick: () => TTS.speak(Pron.say(word), 0.9, en ? '' : Voice.effective(), null) }, icon('headphones')),
        h('span', { class: 'grow' }),
        h('button', { class: 'rbtn', title: 'Fermer', onclick: close }, icon('close'))),
      body, trBox,
      h('div', { class: 'lookacts' },
        en ? h('button', { class: 'btn', onclick: () => doTr(sentence, 'La phrase, en français') }, 'Traduire la phrase') : null,
        en ? h('button', { class: 'btn', onclick: async () => doTr(this.reflow || !PAGED(this.b.kind) ? (this.sents || []).join(' ') : await this.getText(this.page), 'La page, en français') }, 'Traduire la page') : null,
        h('button', { class: 'btn', onclick: () => { const u = 'https://fr.wiktionary.org/wiki/' + encodeURIComponent(word); window.AndroidWeb ? AndroidWeb.open(u, 'Wiktionnaire') : open(u, '_blank'); } }, icon('dict'), 'Wiktionnaire')));
    this.el.append(this.lookEl);
    const show = (res, w) => {
      if (!res || !res.defs.length) return [h('p', { class: 'muted' }, `Pas de définition trouvée pour « ${w} ».`)];
      const groups = []; let last = null;
      for (const d of res.defs) { if (d.pos !== last) { groups.push(h('small', { class: 'lookpos' }, d.pos + (res.lang === 'en' ? ' · anglais' : ''))); last = d.pos; } groups.push(h('p', {}, d.d)); }
      return groups;
    };
    wiktionary(word).then(async (res) => {
      if (!this.lookEl) return;
      const parts = show(res, word);
      if (res?.lemma) { const lr = await wiktionary(res.lemma).catch(() => null); if (lr?.defs.length) parts.push(h('div', { class: 'looklemma' }, h('b', {}, res.lemma), ...show(lr, res.lemma))); }
      body.replaceChildren(...parts);
    }).catch(() => body.replaceChildren(h('p', { class: 'muted' }, 'Il faut Internet pour les définitions.')));
    if (en && sentence.length < 400) doTr(sentence, 'La phrase, en français');
  }
  // Un titre commence-t-il à cette phrase ? (début de chapitre, pour la minuterie)
  headAt(i) {
    const el = this.cur && $(`.s[data-i="${i}"]`, this.cur);
    return !!(el && el.closest('.hd') && el === el.closest('.hd').querySelector('.s'));
  }
  // Phrases d'une page sans l'afficher (même découpage que l'affichage)
  async pageSents(n) {
    if (n === this.page && this.sents.length) return this.sents;
    if (this.reflow) return (this.pages[n - 1] || []).flatMap((it) => sentences(it.text));
    const t = await this.getText(n);
    if (PAGED(this.b.kind)) return sentences(t);
    return t.split(/\n{2,}/).flatMap((para) => sentences(para.replace(/^#{1,3} /, '')));
  }
  // Avance ou recule d'une durée : estimée d'après le débit de la voix (environ 14,5 caractères par seconde à vitesse 1)
  async jump(sec) {
    if (this.jumping) return; this.jumping = true;
    try {
      let budget = Math.abs(sec) * 14.5 * (this.rate || 1);
      let n = this.page; let ss = await this.pageSents(n); let i = Math.min(this.sIdx, Math.max(0, ss.length - 1));
      if (sec > 0) {
        for (;;) {
          if (i + 1 < ss.length) { budget -= (ss[i] || '').length; i++; if (budget <= 0) break; continue; }
          if (n >= this.total) { i = Math.max(0, ss.length - 1); break; }
          budget -= (ss[i] || '').length; n++; ss = await this.pageSents(n); i = 0; if (budget <= 0 && ss.length) break;
        }
      } else {
        for (;;) {
          if (i > 0) { i--; budget -= (ss[i] || '').length; if (budget <= 0) break; continue; }
          if (n <= 1) { i = 0; break; }
          n--; ss = await this.pageSents(n); i = ss.length;
          if (!ss.length) i = 0;
        }
      }
      const was = this.playing;
      if (was) this.stopSpeech();
      if (n !== this.page) { this.page = n; this.sIdx = 0; await this.render(sec > 0 ? 1 : -1); }
      this.sIdx = Math.max(0, Math.min(i, this.sents.length - 1));
      if (was) this.play(); else this.highlight();
      toast(`${sec > 0 ? 'Avance' : 'Recul'} de ${Math.abs(sec) >= 60 ? Math.abs(sec) / 60 + ' min' : Math.abs(sec) + ' s'} · page ${this.page}`);
    } finally { this.jumping = false; }
  }
  skip(d) { this.sIdx = Math.max(0, Math.min(this.sents.length - 1, this.sIdx + d)); if (this.playing) { this.stopSpeech(); this.speakCurrent(); } else this.highlight(); }
  stopSpeech() { this.tok = (this.tok || 0) + 1; TTS.stop(); }
  pause() { const was = this.playing; this.playing = false; this.stopSpeech(); this.setPlayUi(); if (was) AutoRemote.state(this); }
  setPlayUi() { if (!this.player) return; this.player.classList.toggle('paused', !this.playing); this.playBtn.replaceChildren(icon(this.playing ? 'pause' : 'play')); }
  close(fromPop) {
    if (this.closed) return; this.closed = true;
    this.pause();
    if (window.__reader === this) { window.__reader = null; AutoRemote.state(null); }
    removeEventListener('keydown', this.onKey); removeEventListener('resize', this.onResize); removeEventListener('popstate', this.onPop);
    document.fonts?.removeEventListener?.('loadingdone', this.onFonts);
    window.__readerBack = null;
    if (!fromPop && history.state?.reader) history.back();
    this.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 220, easing: 'ease-in' }).onfinish = () => this.el.remove();
    document.body.style.overflow = '';
    clearTimeout(this.trackT);
    Promise.resolve(this.sendTrack && this.sendTrack()).then(() => loadBooks()).then(renderLibrary);
  }
}
Reader.cache = new Map();
// Android Auto : quand la lecture vient du téléphone, l'auto affiche ce livre et ses boutons commandent ce lecteur-ci
const AutoRemote = {
  on: () => !!(window.AndroidAuto && window.AndroidAuto.nowPlaying),
  state(r) {
    if (!this.on()) return;
    try { AndroidAuto.nowPlaying(r ? JSON.stringify({ id: r.b.id, title: r.b.title, author: r.b.author || '', playing: !!r.playing }) : ''); } catch {}
  },
};
window.__autoCmd = (cmd, arg) => {
  const r = window.__reader; if (!r || r.closed) return false;
  if (cmd === 'play') { if (!r.player) r.toggleAudio(true); else if (!r.playing) r.play(); }
  else if (cmd === 'pause') { if (r.playing) r.pause(); }
  else if (cmd === 'jump') { if (!r.player) r.toggleAudio(false); r.jump(Number(arg) || 0); }
  return true;
};
// Bouton retour Android
window.__androidBack = () => { if (window.__readerBack) return window.__readerBack(); if (Sel.on && !$('.scrim')) { selEnd(); return true; } const all = $$('.scrim'); const s = all[all.length - 1]; if (s) { if (s.dataset.prof === 'book') { try { AndroidAuto.profStop ? AndroidAuto.profStop() : AndroidAuto.profPause(); } catch {} } s.remove(); return true; } return false; }; // Retour sur la fenêtre du Professeur : le cours s'arrête

// ================= Télé : diffusion d'écran (Cast) et navigation à la télécommande =================
const TV = {
  on: false,
  canCast: () => !!(window.AndroidCast && !TV.on),
  cast() {
    window.__castOpened = (r) => { window.__castOpened = null; if (!r) toast('Ouvre « Smart View » (ou « Caster ») dans le volet rapide du téléphone, puis choisis ta télé.'); };
    AndroidCast.cast();
  },
  init() {
    try { this.on = !!(window.AndroidCast && AndroidCast.isTv()); } catch { this.on = false; }
    window.__noPicker = (what) => toast(what === 'folder'
      ? 'Cette télé n\'a pas de sélecteur de dossiers. Installe un gestionnaire de fichiers (ex. X-plore) depuis le Play Store de la télé.'
      : 'Cette télé n\'a pas de sélecteur de fichiers. Installe un gestionnaire de fichiers (ex. X-plore) depuis le Play Store de la télé.');
    if (!this.on) return;
    document.documentElement.classList.add('tv');
    document.addEventListener('keydown', (e) => this.key(e), true);
    document.addEventListener('keyup', (e) => this.keyUp(e), true);
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) this.first(); }, 800);
  },
  focusables(root) {
    return [...root.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden' && !x.closest('[hidden]'));
  },
  scope() { const sh = [...document.querySelectorAll('.scrim')].pop(); return sh || $('.reader') || document.body; },
  first() { const f = this.focusables(this.scope())[0]; if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center' }); } },
  held: null,
  key(e) {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    // appui long sur OK (ou touche Menu) sur un livre : le menu du livre, comme un appui long au doigt
    if (a && a.classList && a.classList.contains('book')) {
      if (e.key === 'ContextMenu') { e.preventDefault(); a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return; }
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat && !this.held) this.held = { el: a, t: setTimeout(() => { if (this.held) this.held.fired = true; a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); }, 650) };
        return;
      }
    }
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (!dir) return;
    if (typing && (dir === 'left' || dir === 'right')) return;
    // dans le lecteur, gauche / droite tournent les pages (sauf dans la barre du haut ou les commandes audio)
    if ($('.reader') && !$('.scrim') && (dir === 'left' || dir === 'right') && !(a && a.closest('.r-top, .player'))) return;
    const list = this.focusables(this.scope());
    if (!list.length) return;
    e.preventDefault(); e.stopPropagation();
    if (!a || a === document.body || !list.includes(a)) return this.first();
    const r = a.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const x of list) {
      if (x === a) continue;
      const q = x.getBoundingClientRect(); const qx = q.left + q.width / 2, qy = q.top + q.height / 2;
      const dx = qx - cx, dy = qy - cy;
      const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      if (main <= 4) continue;
      const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      const score = main + side * 2.2;
      if (score < bestScore) { bestScore = score; best = x; }
    }
    if (best) {
      best.focus({ preventScroll: true });
      const q = best.getBoundingClientRect();
      if (q.top < 60 || q.bottom > innerHeight - 60) best.scrollIntoView({ block: 'center' }); else best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },
  keyUp(e) {
    if (e.key !== 'Enter' || !this.held) return;
    const h0 = this.held; this.held = null;
    clearTimeout(h0.t); e.preventDefault();
    if (!h0.fired) h0.el.click();
  },
};
TV.init();

boot();
