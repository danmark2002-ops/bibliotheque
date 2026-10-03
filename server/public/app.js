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
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/>',
  shelf: '<rect x="4" y="4" width="4" height="11" rx=".8"/><rect x="10" y="6" width="4" height="9" rx=".8"/><rect x="16" y="3" width="4" height="12" rx=".8"/><path d="M2 19h20"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  chev: '<path d="M7 10l5 5 5-5"/>',
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
const icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = ICONS[n]; return s; };
const KIND = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT' };
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
  try { S.me = await api('/api/me'); } catch { S.me = { role: null }; }
  document.title = S.me.library || 'Bibliothèque';
  if (!S.me.role) return renderAuth();
  await loadBooks();
  renderLibrary();
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
  if (b.kind === 'pdf' && b.status === 'ready') {
    const img = h('img', { src: b.coverUrl || `/api/books/${b.id}/cover.jpg`, alt: '', loading: 'lazy', draggable: 'false' });
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
  if (b.status === 'processing') cv.append(h('span', { class: 'status-pill' }, 'Préparation…'));
  if (b.status === 'error') cv.append(h('span', { class: 'status-pill' }, 'Fichier illisible'));
  el.append(h('span', { class: 'under' }, h('span', { class: 'tag k-' + b.kind }, KIND[b.kind] || b.kind.toUpperCase()),
    b.state === 'lu' ? h('span', { class: 'tag st' }, 'Lu') : b.state === 'alire' ? h('span', { class: 'tag st' }, 'À lire') : pct ? h('span', { class: 'tag pct' }, pct >= 99 ? 'Terminé' : pct + ' %') : null));
  if (S.me.role === 'owner' && window.LocalAPI && !b.trashed) $('.under', el).after(tinyIcons(b));
  el.addEventListener('click', (e) => { if (e.target.closest('.tiny')) return; if (S.organize || b.trashed) return editBook(b); if (b.status === 'ready') openBook(b, el); });
  ownerGestures(el, b);
  return el;
}
function ownerGestures(el, b) {
  if (S.me.role !== 'owner') return;
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); editBook(b); });
  let t; el.addEventListener('touchstart', () => { t = setTimeout(() => { t = 'fired'; editBook(b); }, 600); }, { passive: true });
  el.addEventListener('touchend', (e) => { if (t === 'fired') e.preventDefault(); clearTimeout(t); });
  el.addEventListener('touchmove', () => clearTimeout(t), { passive: true });
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
    row.addEventListener('click', (e) => { if (e.target.closest('.qbar')) return; if (S.organize || b.trashed) return editBook(b); if (b.status === 'ready') openBook(b, thumb); });
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
const FMT = { pdf: 'PDF', docx: 'Word', txt: 'Texte' };
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
    onclick: (e) => { e.stopPropagation(); e.preventDefault(); fn(); }, ontouchstart: (e) => e.stopPropagation() }, icon(name));
  return h('span', { class: 'tiny' },
    ic(b.fav ? 'starFill' : 'star', 'Favori', b.fav, () => toggleFav(b)),
    ic('clock', 'À lire', b.state === 'alire', () => toggleState(b, 'alire')),
    ic('checks', 'Déjà lu', b.state === 'lu', () => toggleState(b, 'lu')),
    ic('collection', 'Collections', (b.cols || []).length > 0, () => collectionsDialog(b)),
    ic('dots', 'Plus : ouvrir avec, résumé IA…', false, () => editBook(b)));
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
    labels ? null : btn('dots', 'Plus', false, () => editBook(b)));
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
    item({ k: 'trash' }, 'Poubelle', 'trash'));
  const scrim = h('div', { class: 'scrim drawer-scrim', onclick: (e) => { if (e.target === scrim) close(); } }, panel);
  document.body.append(scrim);
}

function authorsEl(q) {
  const groups = groupByAuthor(S.books.filter((b) => !b.trashed && inLib(b))).filter(([a]) => !q || a.toLowerCase().includes(q)).sort((x, y) => authorCmp(x[0], y[0]));
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

function renderLibrary() {
  const owner = S.me.role === 'owner';
  const local = !!window.LocalAPI;
  if (local && !store.get('libnames16', false)) { // une fois : la bibliothèque prend le nom de son dossier
    const m = folderMap(); for (const l of libs()) if (m[l.id]?.ok !== false && m[l.id]?.name) nameLibAfter(l.id, m[l.id].name);
    store.set('libnames16', true);
  }
  if (!local) S.nav = { k: 'all' };
  if (S.nav.k === 'col' && !S.cols.some((c) => c.id === S.nav.v)) S.nav = { k: 'all' };
  const q = S.filter.toLowerCase();
  const books = sortBooks(S.books.filter((b) => inNav(b) && (!q || (b.title + ' ' + b.author).toLowerCase().includes(q))));
  const asList = S.view === 'list';
  const live = S.books.filter((b) => !b.trashed && inLib(b));
  let body;
  if (S.nav.k === 'authors') body = authorsEl(q);
  else {
    const groups = S.sort === 'author' && S.nav.k !== 'author' && books.length ? groupByAuthor(books) : [[null, books]];
    body = asList ? h('div', {}, groups.map(([g, bs]) => [g ? h('h3', { class: 'group-h' }, g, h('em', {}, bs.length)) : null, listEl(bs)]).flat()) : caseFor(groups, owner);
    if (!live.length && S.nav.k !== 'trash') {
      const msg = h('div', { class: 'empty' },
        h('h3', {}, owner ? 'Tes rayons t\'attendent' : 'Les rayons sont encore vides'),
        h('p', {}, owner ? 'Ajoute un PDF ou un fichier texte. Tu peux aussi glisser des fichiers ici.' : 'Reviens bientôt, de nouveaux livres arrivent.'),
        owner ? h('div', { class: 'actions', style: { justifyContent: 'center' } },
          h('button', { class: 'btn primary', onclick: pickFiles }, icon('plus'), 'Ajouter un livre'),
          local ? h('button', { class: 'btn', onclick: () => openFolder() }, icon('folder'), 'Choisir un dossier') : null) : null);
      asList ? body.prepend(msg) : (body.querySelector('.shelf') || body).prepend(msg);
    } else if (!books.length) {
      const msg = h('div', { class: 'empty' }, h('p', {}, q ? 'Aucun livre ne correspond à ta recherche.' : (EMPTY[S.nav.k] || 'Aucun livre ici.')));
      asList ? body.prepend(msg) : (body.querySelector('.shelf') || body).prepend(msg);
    }
  }
  const ready = live.filter((b) => b.status === 'ready');
  const current = ['all', 'reading'].includes(S.nav.k) && !q ? ready.filter((b) => b.progress && b.progress.page < b.pages && b.state !== 'lu').sort((a, b) => b.progress.last - a.progress.last)[0] : null;
  const actions = h('div', { class: 'actions' },
    owner ? h('button', { class: 'btn primary', onclick: pickFiles }, icon('plus'), h('span', { class: 'lbl' }, 'Ajouter un livre')) : null,
    owner && local && S.lib !== 'all' ? h('button', { class: 'btn', title: 'Dossier source', onclick: () => openFolder() }, icon('folder'), h('span', { class: 'lbl' }, folderInfo() ? folderInfo().name : 'Dossier')) : null,
    owner && local && (folderInfo() || (S.lib === 'all' && libsWithFolder().length)) ? h('button', { class: 'btn icon refresh' + (FOLDER.busy ? ' spin' : ''), title: S.lib === 'all' ? 'Actualiser tous les dossiers' : 'Actualiser le dossier', 'aria-label': 'Actualiser', onclick: () => refreshFolders() }, icon('refresh')) : null,
    owner && !local ? h('button', { class: 'btn', onclick: openShare, title: 'Partager' }, icon('share'), h('span', { class: 'lbl' }, 'Partager')) : null,
    owner && !local ? h('button', { class: 'btn', onclick: openDashboard, title: 'Lecteurs' }, icon('people'), h('span', { class: 'lbl' }, 'Lecteurs')) : null,
    h('button', { class: 'btn icon', title: 'Réglages', onclick: openSettings }, icon('gear')),
  );
  const count = S.nav.k === 'authors' ? `${new Set(live.map(authorOf)).size} auteurs` : `${books.length} livre${books.length > 1 ? 's' : ''}`;
  const toolbar = S.books.length ? h('div', { class: 'toolbar' },
    h('input', { class: 'search', placeholder: S.nav.k === 'authors' ? 'Rechercher un auteur' : 'Rechercher un titre ou un auteur', value: S.filter, oninput: (e) => { S.filter = e.target.value; const pos = e.target.selectionStart; renderLibrary(); const i = $('.search'); i.focus(); i.setSelectionRange(pos, pos); } }),
    S.nav.k !== 'authors' ? h('label', { class: 'sortsel', title: 'Trier' }, h('span', {}, 'Trier'),
      h('select', { onchange: (e) => { S.sort = e.target.value; store.set('sort', S.sort); renderLibrary(); } },
        Object.entries(SORTS).map(([k, l]) => h('option', { value: k, selected: k === S.sort }, l)))) : null,
    S.nav.k !== 'authors' ? h('button', { class: 'btn icon', title: asList ? 'Voir l\'étagère' : 'Voir la liste', onclick: () => { S.view = asList ? 'shelf' : 'list'; store.set('view', S.view); renderLibrary(); } }, icon(asList ? 'shelf' : 'list')) : null,
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
    owner && books.length && S.nav.k !== 'trash' && S.nav.k !== 'authors' ? h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '18px' } }, asList ? 'Les boutons sous chaque livre : favori, à lire, déjà lu, collections.' : 'Sous chaque livre : favori, à lire, déjà lu, collections. Appui long pour modifier.') : null,
  ));
  $('#app').replaceChildren(room);
  // hors de #app : les messages d'envoi survivent au rafraîchissement de l'étagère
  if (!$('#uploads')) document.body.append(h('div', { class: 'uploads', id: 'uploads' }));
  if (!$('#dz')) document.body.append(h('div', { class: 'dropzone', id: 'dz' }, h('div', {}, 'Dépose tes livres ici')));
  AutoSync.schedule();
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
      h('button', { class: 'btn', onclick: () => openBook(b, mini, { audio: true }) }, icon('headphones'), 'Écouter'),
      Prof.on() ? h('button', { class: 'btn', onclick: () => Prof.open(b) }, icon('prof'), 'Professeur') : null)));
}
let resizeT; window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if ($('.case') && !$('.reader')) renderLibrary(); }, 150); });

// ================= Ajout de livres =================
function pickFiles() {
  const inp = h('input', { type: 'file', accept: '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain', multiple: true });
  inp.style.display = 'none'; document.body.append(inp);
  inp.onchange = () => { uploadFiles([...inp.files]); inp.remove(); };
  inp.click();
}
async function uploadFiles(files) {
  for (const f of files) {
    const box = h('div', { class: 'up' }, h('b', {}, f.name), h('span', { class: 'muted' }, 'Envoi…'), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
    $('#uploads')?.append(box);
    try {
      if (window.LocalAPI) await LocalAPI.upload(f, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = msg; }, { lib: S.lib === 'all' ? 'main' : curLib().id });
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
}
// ================= Bibliothèques et dossiers sources =================
// Chaque bibliothèque a son nom, son décor et (si on veut) son dossier source. « Toutes » les montre ensemble.
const DECORS = [['noyer', 'Noyer'], ['chene', 'Chêne clair'], ['acajou', 'Acajou'], ['ebene', 'Ébène'], ['ardoise', 'Ardoise'], ['olivier', 'Olivier'], ['bouleau', 'Bouleau']];
const DECOR_SWATCH = { noyer: '#6d4427', chene: '#cfa977', acajou: '#7a2f22', ebene: '#2a2a30', ardoise: '#3e5566', olivier: '#5d6233', bouleau: '#d9d4c7' };
const FOLDER = { busy: false };
const hasNativeFolder = () => !!window.AndroidFolder;
function libs() {
  let l = store.get('libs', null);
  if (!l || !l.length) {
    let name = 'Ma Bibliothèque'; try { name = localStorage.getItem('bib.libname') || name; } catch {}
    l = [{ id: 'main', name, decor: store.get('decor', 'noyer') }]; store.set('libs', l);
  }
  return l;
}
const saveLibs = (l) => store.set('libs', l);
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
const BOOK_EXT = /\.(pdf|docx|txt|md)$/i;
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
async function scanOne(libId, webFiles, { quiet, adopt } = {}) {
  const lib = libs().find((l) => l.id === libId); if (!lib) return 0;
  let entries;
  FOLDER.busy = true; renderLibrary();
  try {
    if (hasNativeFolder()) {
      const box = h('div', { class: 'up' }, h('b', {}, `${lib.name} · ${folderOf(libId)?.name || 'Dossier'}`), h('span', { class: 'muted' }, 'Recherche de nouveaux livres…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
      $('#uploads')?.append(box);
      const r = await nativeCall('__folderScanned', () => AndroidFolder.scan(libId));
      box.remove();
      if (!r || r.error) { toast(`${lib.name} : ${r?.error || 'lecture du dossier impossible'}`); return 0; }
      entries = r.files.map((f) => ({ src: 'saf:' + f.id, name: f.name, path: f.path, size: f.size, get: async () => {
        const resp = await fetch('/__dossier?lib=' + encodeURIComponent(libId) + '&id=' + encodeURIComponent(f.id));
        if (!resp.ok) throw new Error('Fichier illisible');
        return new File([await resp.blob()], f.name, { lastModified: f.mtime || Date.now() });
      } }));
    } else {
      if (!webFiles) { webFiles = await pickWebFolder(); if (!webFiles.length) return 0; }
      entries = webFiles.filter((f) => BOOK_EXT.test(f.name) && !f.name.startsWith('.')).map((f) => ({ src: 'web:' + (f.webkitRelativePath || f.name), name: f.name, path: f.webkitRelativePath || f.name, size: f.size, get: async () => f }));
    }
    let moved = 0;
    if (adopt) {
      const bySrc = new Map(S.books.filter((b) => b.src && b.lib !== libId).map((b) => [b.src, b]));
      for (const e of entries) { const b = bySrc.get(e.src); if (b) { await post('/api/books/' + b.id, { lib: libId }, 'PATCH'); moved++; } }
      if (moved) await loadBooks();
    }
    const k = await LocalAPI.known(libId);
    const fresh = entries.filter((e) => !k.has(e)).sort((a, b) => a.path.localeCompare(b.path, 'fr'));
    const last = store.get('folderLast', {}); store.set('folderLast', { ...(typeof last === 'object' ? last : {}), [libId]: Date.now() });
    if (!fresh.length) { if (!quiet) toast(moved ? `${moved} livre${moved > 1 ? 's' : ''} retrouvé${moved > 1 ? 's' : ''} et rangé${moved > 1 ? 's' : ''} ici` : entries.length ? 'Aucun nouveau livre dans le dossier' : 'Aucun livre trouvé dans ce dossier'); return 0; }
    let ok = 0, fail = 0;
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i];
      const box = h('div', { class: 'up' }, h('b', {}, e.name), h('span', { class: 'muted' }, `${lib.name} : livre ${i + 1} sur ${fresh.length}`), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
      $('#uploads')?.append(box);
      try {
        const file = await e.get();
        await LocalAPI.upload(file, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = `${i + 1}/${fresh.length} · ${msg}`; }, { src: e.src, lib: libId });
        box.remove(); ok++;
        if (ok % 5 === 0) { await loadBooks(); renderLibrary(); } // l'étagère se remplit pendant l'import
      } catch (err) { fail++; $('span', box).textContent = err.message; $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000); }
    }
    if (!quiet) toast(`${ok} nouveau${ok > 1 ? 'x' : ''} livre${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (fail ? ` · ${fail} refusé${fail > 1 ? 's' : ''}` : ''));
    return ok;
  } finally {
    FOLDER.busy = false; await loadBooks(); renderLibrary();
  }
}
function openFolder(libId = curLib()?.id) {
  if (!libId) return openLibraries();
  const lib = libs().find((l) => l.id === libId);
  const f = folderOf(libId); const last = (store.get('folderLast', {}) || {})[libId] || 0;
  let ignored = []; try { ignored = JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]'); } catch {}
  const close = sheet('Dossiers sources', h('div', {},
    f ? h('div', { class: 'srcbox' },
      h('div', { class: 'srcname' }, icon('folder'), h('span', {}, h('b', {}, f.name), h('small', {}, `Bibliothèque « ${lib.name} » · dernière recherche : ${last ? lastRead(last) : 'jamais'}`))),
      h('button', { class: 'btn primary', onclick: () => { close(); scanFolder(libId); } }, icon('refresh'), 'Actualiser'))
      : h('p', { class: 'muted' }, `La bibliothèque « ${lib.name} » n'a pas encore de dossier. Choisis-en un : ses livres PDF, Word et texte y seront ajoutés, et « Actualiser » ira chercher les nouveaux.`),
    !f ? h('div', { class: 'actions', style: { marginBottom: '6px' } }, h('button', { class: 'btn primary', onclick: () => { close(); chooseFolder(libId); } }, icon('folder'), 'Choisir un dossier')) : null,
    f ? h('div', { class: 'addsrc' },
      h('p', {}, 'Un autre dossier devient une autre bibliothèque. Celle-ci reste telle quelle et tu passes de l\'une à l\'autre avec les onglets en haut.'),
      h('button', { class: 'btn primary', onclick: () => { close(); addFolderLib(); } }, icon('plus'), 'Ajouter un autre dossier')) : null,
    ignored.length ? h('p', { class: 'hint' }, `${ignored.length} livre${ignored.length > 1 ? 's' : ''} retiré${ignored.length > 1 ? 's' : ''} ne ser${ignored.length > 1 ? 'ont' : 'a'} pas réimporté${ignored.length > 1 ? 's' : ''}. `,
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); try { localStorage.removeItem('bib.folderIgnored'); } catch {} close(); toast('Ils reviendront à la prochaine actualisation'); } }, 'Les réimporter')) : null,
    !hasNativeFolder() && f ? h('p', { class: 'hint' }, 'Dans un navigateur, il faut rechoisir le dossier à chaque actualisation.') : null,
    f ? h('details', { class: 'more' }, h('summary', {}, 'Autres options pour ce dossier'),
      h('div', { class: 'actions', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: () => { if (!confirm(`Remplacer le dossier de « ${lib.name} » ? Les livres déjà là restent, et les nouveaux viendront du dossier choisi.`)) return; close(); chooseFolder(libId); } }, 'Remplacer le dossier'),
        h('button', { class: 'btn danger', onclick: () => { if (!confirm('Oublier ce dossier ? Les livres déjà ajoutés restent dans la bibliothèque.')) return; if (hasNativeFolder()) AndroidFolder.forget(libId); else { const m = folderMap(); delete m[libId]; store.set('folders', m); } close(); renderLibrary(); toast('Dossier oublié'); } }, 'Oublier'))) : null));
}

// Onglets des bibliothèques, sous le titre : on passe de l'une à l'autre d'un geste
function libTabs() {
  const l = libs(); const m = folderMap();
  if (l.length < 2 && !m[l[0].id]) return null;
  const tab = (id, name, decor) => h('button', { class: 'libtab' + (S.lib === id ? ' sel' : ''), onclick: () => { if (S.lib !== id) switchLib(id); } },
    h('span', { class: 'libsw' + (id === 'all' ? ' all' : ''), style: { '--sw': DECOR_SWATCH[decor] || '#555' } }), h('span', {}, name));
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
    h('div', { class: 'field' }, 'Dossier source', h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { save(); close(); openFolder(id); } }, icon('folder'), f ? f.name : 'Choisir un dossier'))),
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      id !== 'main' ? h('button', { class: 'btn danger', onclick: async () => {
        const main = l.find((x) => x.id === 'main');
        if (!confirm(`Supprimer la bibliothèque « ${lib.name} » ? Ses livres iront dans « ${main.name} ».`)) return;
        for (const b of S.books.filter((x) => x.lib === id)) await post('/api/books/' + b.id, { lib: 'main' }, 'PATCH');
        if (hasNativeFolder()) AndroidFolder.forget(id); else { const m = folderMap(); delete m[id]; store.set('folders', m); }
        saveLibs(l.filter((x) => x.id !== id)); close(); await loadBooks(); switchLib('main'); toast('Bibliothèque supprimée');
      } }, 'Supprimer') : h('span'),
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
    h('button', { class: 'bact', onclick: () => { close(); openBook(b, null); } }, icon('book'), h('span', {}, 'Lire')),
    h('button', { class: 'bact', onclick: () => { close(); openWith(b, 'view'); } }, icon('open'), h('span', {}, 'Ouvrir avec…')),
    h('button', { class: 'bact' + (b.summary ? ' on' : ''), onclick: () => { close(); openSummary(b); } }, icon('spark'), h('span', {}, b.summary ? 'Voir le résumé' : 'Résumé IA')),
    Prof.on() ? h('button', { class: 'bact' + (Prof.info(b.id) ? ' on' : ''), onclick: () => { close(); Prof.open(b); } }, icon('prof'), h('span', {}, 'Professeur')) : null) : null;
  const close = sheet(b.trashed ? 'Dans la poubelle' : b.title, h('div', {},
    actRow,
    qb,
    local && cols.length ? h('p', { class: 'muted' }, 'Collections : ' + cols.join(', ')) : null,
    b.trashed ? null : h('label', { class: 'field' }, 'Titre', title),
    b.trashed ? null : h('label', { class: 'field' }, 'Auteur', author),
    !b.trashed && b.kind !== 'pdf' ? h('div', { class: 'field' }, 'Couleur de la couverture', sw) : null,
    !b.trashed && local && libs().length > 1 ? h('label', { class: 'field' }, 'Bibliothèque', libSel) : null,
    h('p', { class: 'muted' }, `${KIND[b.kind] || b.kind} · ${b.pages} pages${b.size ? ' · ' + (b.size > 1e6 ? (b.size / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b.size / 1e3)) + ' ko') : ''}`),
    h('p', { class: 'muted' }, b.progress ? `Page ${b.progress.page} sur ${b.pages} · dernière lecture : ${lastRead(b.progress.last)} · ouvert ${b.progress.opens} fois` : 'Pas encore ouvert'),
    b.trashed ? null : h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: async () => {
        if (local) { close(); return trashBook(b); }
        if (!confirm(`Retirer « ${b.title} » de la bibliothèque ?`)) return; await api('/api/books/' + b.id, { method: 'DELETE' }); close(); await loadBooks(); renderLibrary(); toast('Livre retiré');
      } }, local ? 'Mettre à la poubelle' : 'Supprimer'),
      h('button', { class: 'btn primary', onclick: async () => { await post('/api/books/' + b.id, { title: title.value, author: author.value, color, ...(local ? { lib: libSel.value } : {}) }, 'PATCH'); close(); await loadBooks(); renderLibrary(); } }, 'Enregistrer'))));
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
    local ? h('p', { class: 'muted' }, 'Mode local : tes livres sont gardés sur cet appareil seulement. Le partage et le suivi des lecteurs demandent un serveur.') : null,
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
      await this.pullProgress();
      this.writeCatalog();
      const done = store.get('autoDone', {});
      const live = S.books.filter((b) => !b.trashed && b.status === 'ready');
      for (const b of live) {
        const ck = `${b.title}|${b.author}|${b.color}|${b.coverUrl ? 1 : 0}`;
        const d = done[b.id] || {};
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
    const books = S.books.filter((b) => !b.trashed && b.status === 'ready').map((b) => ({
      id: b.id, title: b.title, author: b.author || '', lib: b.lib || 'main', libName: name(b.lib || 'main'), kind: b.kind,
      cover: done[b.id]?.c ? `covers/${b.id}.${b.kind === 'pdf' && b.coverUrl ? 'jpg' : 'png'}` : '',
      last: b.progress?.last || 0, page: b.progress?.page || 1, pos: b.progress?.pos ?? -1, prof: prof.has(b.id) }));
    AndroidAuto.writeText('catalog.json', JSON.stringify({ libs: L.map((l) => ({ id: l.id, name: l.name })), books, rate: store.get('rate', 1), updated: Date.now() }));
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
        if (n % 4 === 0) await new Promise((r) => setTimeout(r, 25)); // laisse respirer l'application
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
      if (b.kind === 'pdf' && b.coverUrl) { const blob = await (await fetch(b.coverUrl)).blob(); return AndroidAuto.writeB64(`covers/${b.id}.jpg`, await blobToB64(blob)); }
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

// ================= Résumé par une IA =================
const SUMMARY_PROMPT = `Fais un résumé bien construit, en français, du livre ci-joint.
Structure :
1. L'essentiel : l'idée centrale en 3 ou 4 phrases.
2. Le déroulement : les grandes parties ou chapitres, dans l'ordre, avec leurs idées clés.
3. Les concepts et arguments importants, expliqués simplement.
4. Ce qu'il faut retenir : 5 à 8 points.
5. Phrases clés : 5 à 7 phrases ultra concises (12 mots au plus chacune) qui, ensemble, disent tout le livre.
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
function openSummary(b) {
  const s = b.summary;
  if (s?.text) {
    const close = sheet('Résumé', h('div', { class: 'summary' },
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, `${b.title} · ${lastRead(s.date)} · ${s.model === 'gemini-nano' ? 'IA du téléphone (Gemini Nano)' : s.model === 'auto' ? 'résumé automatique : les passages clés du livre' : 'Claude'}${s.truncated ? ' · livre très long, résumé sur sa plus grande partie' : ''}`),
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
  const close = sheet('Résumé IA', h('div', {},
    h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
    h('div', { class: 'aiopt' },
      h('h4', {}, 'Résumé gratuit'),
      h('p', {}, window.AndroidAI
        ? 'Fait sur ton téléphone, sans Internet ni compte. Sur les téléphones récents (Samsung S24/S25, Pixel 9…), c\'est l\'IA de Google intégrée (Gemini Nano) qui l\'écrit. Sinon, un résumé automatique choisit les passages clés du livre.'
        : 'Un résumé automatique choisit les passages clés du livre, directement sur l\'appareil.'),
      h('button', { class: 'btn primary', onclick: () => { close(); makeFreeSummary(b); } }, icon('spark'), 'Faire le résumé')),
    h('div', { class: 'aiopt' },
      h('h4', {}, 'Avec ton application d\'IA'),
      h('p', {}, 'Claude, Gemini, ChatGPT… Le livre lui est envoyé avec une demande de résumé déjà écrite.'),
      h('button', { class: 'btn', onclick: () => { close(); openWith(b, 'ai', SUMMARY_PROMPT); } }, icon('share'), 'Choisir l\'application')),
    h('details', { class: 'more' }, h('summary', {}, 'Autres options'),
      h('div', { class: 'aiopt', style: { marginTop: '10px' } },
        h('h4', {}, 'Avec Claude (payant)'),
        h('p', {}, `Résumé plus poussé, avec une clé d'API Claude (console.anthropic.com → API Keys), facturée à l'usage : ${estimateCost(b)} pour ce livre.`),
        h('label', { class: 'field' }, 'Clé d\'API Claude', keyIn),
        h('button', { class: 'btn', onclick: () => { const k = keyIn.value.trim(); if (!/^sk-ant-/.test(k)) return toast('Colle une clé qui commence par sk-ant-'); store.set('claudeKey', k); close(); makeSummary(b); } }, icon('spark'), 'Résumer avec Claude')))));
}

// ---------- Le Professeur bizarroïde ----------
// L'IA du téléphone (Gemini Nano) réécrit chaque partie du livre en une explication enjouée, à dire à voix haute.
// Le cours est enregistré dans files/auto/prof/<id>.json : le lecteur audio (téléphone et Android Auto) le joue
// avec une voix plus vivante. On peut l'interrompre pour lui poser une question.
const Prof = {
  on: () => !!(window.AndroidAI && window.AndroidAuto && window.LocalAPI && AndroidAuto.profPlay && AndroidAI.generateOnline),
  // Gemini Nano si le téléphone le permet, sinon l'IA gratuite en ligne
  engine: null,
  async pickEngine(say) {
    if (this.engine) return this.engine;
    let nano = false; try { nano = await this.ensureNano(say); } catch {}
    return (this.engine = nano ? 'nano' : 'online');
  },
  async ai(prompt, say) {
    const eng = await this.pickEngine(say);
    if (eng === 'nano') return nanoAskRetry(`${this.persona}\n${prompt}`, say);
    return onlineAsk(this.persona, prompt);
  },
  file: (id) => `prof/${id}.json`,
  info(id) { try { const s = AndroidAuto.readText(this.file(id)); if (!s) return null; const j = JSON.parse(s); return { done: !!j.done, n: j.n || 0, made: (j.parts || []).length, parts: j.parts || [] }; } catch { return null; } },
  who: (b) => `« ${b.title} »${b.author ? ' de ' + b.author : ''}`,
  persona: 'Tu es le Professeur bizarroïde : un professeur passionné, enjoué, un brin excentrique, qui adore partager les idées des livres. Tu parles à voix haute à un auditeur qui conduit.',
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
- Explique les idées et les concepts avec tes propres mots, simplement et avec enthousiasme : exemples concrets, images frappantes, exclamations, questions que tu poses à l'auditeur.
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
  async prepare(b, restart) {
    if (this.busy[b.id]) return toast('Le cours est déjà en préparation');
    this.busy[b.id] = true;
    const box = h('div', { class: 'up' }, h('b', {}, 'Professeur : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
    $('#uploads')?.append(box);
    const say = (t) => { $('span', box).textContent = t; };
    const bar = (f) => { const i = $('i', box); i.classList.remove('indet'); i.style.width = Math.round(f * 100) + '%'; };
    try {
      const eng = await this.pickEngine(say);
      const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
      if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?).');
      const chunks = chunkText(t.text);
      const old = restart ? null : this.info(b.id);
      const work = { n: chunks.length, parts: old && old.n === chunks.length ? old.parts : [] };
      for (let i = work.parts.length; i < chunks.length; i++) {
        say(`Le Professeur prépare la partie ${i + 1} sur ${chunks.length}…${eng === 'online' ? ' (IA gratuite en ligne)' : ''}`); bar(i / chunks.length);
        const prev = i ? (sentences(work.parts[i - 1]).slice(-2).join(' ')) : '';
        const r = this.clean(await this.ai(this.prompt(b, chunks[i], i, chunks.length, prev), say));
        work.parts.push(r);
        this.write(b, work, i === chunks.length - 1);
        if (i === 0) toast('Le cours peut déjà s\'écouter : la suite se prépare pendant ce temps.');
      }
      box.remove(); toast('Le cours du Professeur est prêt 🎓');
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
    const info = this.info(b.id); if (!info || !info.made) return;
    const p = this.where(b.id, info);
    AndroidAuto.profPause();
    out.textContent = 'Le Professeur réfléchit…';
    try {
      const ctx = [info.parts[p - 1], info.parts[p]].filter(Boolean).join('\n\n');
      const r = this.clean(await this.ai(`L'auditeur t'interrompt pendant ton explication du livre ${this.who(b)} pour te poser une question.
Voici ce que tu étais en train d'expliquer :
${ctx}
${b.summary?.text ? '\nRésumé du livre entier :\n' + b.summary.text.slice(0, 2500) + '\n' : ''}
Réponds en 3 à 6 phrases, avec entrain, comme à voix haute : pas de listes ni de symboles.
Si la réponse n'est pas dans le livre, dis-le franchement, puis donne ton propre éclairage en précisant que c'est ton avis.
Termine en annonçant, en quelques mots, que tu reprends le cours.

Question : ${q}`, (m) => { out.textContent = m; }));
      out.textContent = r;
      AndroidAuto.profAnswer(b.id, r);
    } catch (e) { out.textContent = e.message; }
  },
  open(b) {
    const info = this.info(b.id);
    const q = h('textarea', { placeholder: 'Ta question au Professeur…' });
    const out = h('div', { class: 'prof-answer', style: { display: 'none' } });
    const send = () => { const v = q.value.trim(); if (!v) return toast('Écris ou dicte ta question'); out.style.display = ''; this.ask(b, v, out); q.value = ''; };
    const mic = window.AndroidAuto.listen ? h('button', { class: 'btn', 'aria-label': 'Dicter', onclick: () => { window.__heard = (t) => { window.__heard = null; if (t) { q.value = t; send(); } }; AndroidAuto.listen(); } }, icon('mic')) : null;
    const ready = info && info.made;
    if (ready && !store.get('profMic', 0)) { store.set('profMic', 1); try { AndroidAI.askMic?.(); } catch {} }
    const close = sheet('Le Professeur bizarroïde', h('div', {},
      h('p', { class: 'muted', style: { marginTop: '-6px' } }, b.title),
      h('div', { class: 'aiopt' },
        h('h4', {}, ready ? (info.done ? 'Le cours est prêt' : `Cours en préparation : ${info.made} parties sur ${info.n}`) : 'Un cours au lieu d\'une lecture'),
        h('p', {}, ready
          ? 'Le Professeur t\'explique le livre avec enthousiasme, partie par partie. Dans Android Auto, il apparaît avec 🎓 devant le titre du livre ; le bouton « Question » de l\'auto te laisse l\'interroger à voix haute.'
          : 'Au lieu de lire phrase par phrase, le Professeur t\'explique les idées du livre avec ses mots, comme un cours passionné. Il le prépare une fois, gratuitement : avec l\'IA intégrée au téléphone si elle est disponible, sinon avec une IA gratuite en ligne (Internet requis). Garde l\'application ouverte pendant la préparation : environ une partie toutes les 20 secondes. Tu peux commencer à écouter dès la première partie.'),
        h('div', { class: 'prof-row' },
          ready ? h('button', { class: 'btn primary', onclick: () => { AndroidAuto.profPlay(b.id); toast('Le Professeur commence 🎓'); } }, icon('play'), 'Écouter') : null,
          ready ? h('button', { class: 'btn', onclick: () => AndroidAuto.profPause() }, icon('pause'), 'Pause') : null,
          !ready || !info.done ? h('button', { class: ready ? 'btn' : 'btn primary', onclick: () => { close(); this.prepare(b); } }, icon('prof'), ready ? 'Continuer la préparation' : 'Préparer le cours') : null)),
      ready ? h('div', { class: 'aiopt' },
        h('h4', {}, 'Poser une question'),
        h('p', {}, 'Le cours se met en pause, le Professeur te répond à voix haute, puis il reprend où il était.'),
        h('div', { class: 'prof-ask' }, q, mic, h('button', { class: 'btn primary', onclick: send }, 'Demander')),
        out) : null,
      ready && info.done ? h('details', { class: 'more' }, h('summary', {}, 'Autres options'),
        h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => { close(); this.prepare(b, true); } }, icon('refresh'), 'Refaire le cours'))) : null), { wide: true });
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
// IA gratuite en ligne, sans clé (Pollinations) : pour les téléphones sans Gemini Nano. Les demandes sont espacées côté Android.
function onlineAsk(system, prompt) {
  const id = 'o' + (++nanoSeq);
  const wait = (window.__aiWait ||= {});
  window.__aiResult = (j) => { const r = JSON.parse(j); const f = wait[r.id]; if (!f) return; delete wait[r.id]; f(r); };
  return new Promise((res, rej) => { wait[id] = (r) => (r.error ? rej(new Error(r.error)) : res((r.text || '').trim())); AndroidAI.generateOnline(id, system || '', prompt); });
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
    keys = await nanoAskRetry(`Voici le résumé du livre ${who}.\nÉcris 5 à 7 phrases clés ultra concises, de 12 mots au plus chacune, qui disent ensemble tout le livre. Une phrase par ligne, chaque ligne commence par « - ». Rien d'autre.\n\n${fin}`, say);
    keys = keys.split('\n').map((x) => x.trim()).filter((x) => /^[-•*]\s+\S/.test(x)).map((x) => '- ' + x.replace(/^[-•*]\s+/, '')).slice(0, 8).join('\n');
  } catch {}
  store.set(key, null);
  return fin.replace(/\n*#{1,3}\s*Phrases clés[\s\S]*$/i, '') + (keys ? `\n\n## Phrases clés\n${keys}` : '');
}

async function makeFreeSummary(b) {
  const box = h('div', { class: 'up' }, h('b', {}, 'Résumé : ' + b.title), h('span', { class: 'muted' }, 'Lecture du livre…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
  $('#uploads')?.append(box);
  const say = (t) => { $('span', box).textContent = t; };
  try {
    const t = await LocalAPI.fullText(b.id, (n, tot) => say(`Lecture du livre… page ${n} sur ${tot}`));
    if (t.text.replace(/\[page \d+\]|\s/g, '').length < 200) throw new Error('Ce livre ne contient presque pas de texte lisible (PDF scanné ?). Essaie « Avec ton application d\'IA ».');
    let text = null, model = 'auto';
    if (window.AndroidAI) {
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
  speak(text, rate, voiceName, onend) {
    const id = String(++this.seq);
    if (this.native()) { this.cb[id] = onend; AndroidTTS.speak(text, rate, id); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = this.voices().find((x) => x.name === voiceName) || this.voices().find((x) => /^fr/i.test(x.lang));
    if (v) u.voice = v; u.lang = v?.lang || 'fr-FR'; u.rate = rate;
    u.onend = () => onend && onend(); u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') onend && onend(); };
    speechSynthesis.speak(u);
  },
  stop() { this.cb = {}; if (this.native()) AndroidTTS.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); },
  supported() { return this.native() || 'speechSynthesis' in window; },
};
window.__ttsDone = (id) => { const f = TTS.cb[id]; delete TTS.cb[id]; f && f(); };
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

function sentences(text) {
  const clean = text.replace(/\s*\n\s*(?=\S)/g, (m) => /\n\s*\n/.test(m) ? '\n\n' : ' ').trim();
  const parts = clean.match(/[^.!?…\n]+(?:[.!?…]+["»”)]*|\n+|$)/g) || [];
  const out = [];
  for (let p of parts.map((s) => s.trim()).filter(Boolean)) {
    while (p.length > 260) { let c = p.lastIndexOf(', ', 220); if (c < 80) c = p.lastIndexOf(' ', 240); if (c < 1) c = 240; out.push(p.slice(0, c + 1)); p = p.slice(c + 1).trim(); }
    if (out.length && p.length < 18 && !/[.!?…]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + p; else out.push(p);
  }
  return out;
}

// ================= Lecteur =================
async function openBook(b, fromEl, opts = {}) {
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

class Reader {
  constructor(b, opts) {
    this.b = b; this.opts = opts;
    this.reflow = b.kind !== 'pdf' && !!window.LocalAPI; // texte repaginé pour tenir à l'écran
    this.total = b.pages; this.origPages = b.pages;
    this.page = Math.min(b.pages, Math.max(1, b.progress?.page || 1));
    this.theme = store.get('theme', 'sepia'); this.fs = store.get('fs', 19);
    this.rate = store.get('rate', 1); this.voice = store.get('voice', '');
    this.texts = new Map(); this.imgs = new Map();
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
    this.el = h('div', { class: 'reader', 'data-theme': this.theme },
      h('div', { class: 'r-top' },
        h('button', { class: 'rbtn', title: 'Fermer', onclick: () => this.close() }, icon('back')),
        h('div', { class: 'ttl' }, h('b', {}, b.title), h('span', {}, b.author || '')),
        TTS.supported() ? this.audioBtn : null,
        h('button', { class: 'rbtn', title: 'Apparence', onclick: () => this.appearance() }, icon('type'))),
      this.stage,
      h('div', { class: 'tapzone l', onclick: () => this.go(this.page - 1, -1) }),
      h('div', { class: 'tapzone r', onclick: () => this.go(this.page + 1, 1) }),
      h('div', { class: 'r-bottom' }, h('div', { class: 'slider' }, this.lbl, this.slider, this.left)));
    document.body.append(this.el);
    document.body.style.overflow = 'hidden';
    window.__reader = this;
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('dragstart', (e) => e.preventDefault());
    this.stage.addEventListener('click', (e) => { if (e.detail === 1) this.clickT = setTimeout(() => this.el.classList.toggle('immersive'), 250); });
    this.stage.addEventListener('dblclick', () => { clearTimeout(this.clickT); this.toggleZoom(); });
    // Glisser pour tourner la page : écouté sur tout le lecteur (y compris les bords), seuil bas, geste rapide accepté
    let sx = 0, sy = 0, st = 0, tracking = false;
    const ignore = (t) => t.closest && t.closest('.r-top, .r-bottom, .player, .scrim, input, select');
    this.el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || ignore(e.target)) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    this.el.addEventListener('touchend', (e) => {
      if (!tracking) return; tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
      if (this.zoom) return;
      const ax = Math.abs(dx);
      if (ax > Math.abs(dy) * 1.2 && (ax >= 48 || (ax >= 24 && dt < 260))) this.go(this.page + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }, { passive: true });
    this.el.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
    this.onKey = (e) => {
      if ($('.scrim')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.go(this.page + 1, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.go(this.page - 1, -1);
      else if (e.key === 'Escape') this.close();
      else if (e.key === ' ' && this.player) { e.preventDefault(); this.playing ? this.pause() : this.play(); }
    };
    addEventListener('keydown', this.onKey);
    this.onResize = () => { clearTimeout(this.rt); this.rt = setTimeout(() => (this.reflow ? this.relayout() : this.render(0)), 220); };
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
    post('/api/track', { book: b.id, type: 'open', page: this.page }).catch(() => {});
    await this.render(0);
    if (this.opts.audio) this.toggleAudio(true);
  }
  // ---- Mise en page : le texte est découpé pour que chaque page tienne entièrement à l'écran ----
  measureDims() {
    const top = $('.r-top', this.el).offsetHeight, bot = $('.r-bottom', this.el).offsetHeight;
    const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
    this.PT = top + 10; this.PB = bot + 16; this.PX = sw < 520 ? 22 : 28;
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
    const paras = await LocalAPI.paragraphs(this.b.id);
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
    if (pr.pos != null) return this.pageOfPos(pr.pos);
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
    this.page = this.pageOfPos(pos); await this.render(0);
  }
  async drawReflow(pg, n) {
    const items = this.pages[n - 1] || [];
    const prose = h('article', { class: 'prose reflow' + (n === 1 && items[0] && !items[0].cont && !items[0].h ? ' first' : ''), style: { '--fs': this.fs + 'px', width: this.W + 'px' } });
    let i = 0;
    for (const it of items) {
      const el = h(it.h ? 'h3' : 'p', { class: it.h ? 'hd' : (it.cont ? 'cont' : '') });
      sentences(it.text).forEach((x) => { el.append(h('span', { class: 's', 'data-i': i++ }, x), ' '); });
      prose.append(el);
    }
    this.sents = $$('.s', prose).map((x) => x.textContent);
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
      if (this.imgs.size > 8) { const k = [...this.imgs.keys()].find((x) => Math.abs(x - n) > 3); if (k) this.imgs.delete(k); }
    }
    return this.imgs.get(n);
  }
  async render(dir) {
    const b = this.b, n = this.page;
    this.slider.value = n; this.lbl.textContent = `${n} / ${this.total}`;
    const rest = this.total - n; this.left.textContent = rest ? `${rest} page${rest > 1 ? 's' : ''} restante${rest > 1 ? 's' : ''}` : 'Dernière page';
    const pg = h('div', { class: 'page ' + b.kind + (this.reflow ? ' reflow' : '') + (this.zoom ? ' zoom' : '') }, h('div', { class: 'loading' }, 'Chargement…'));
    const old = this.stage.querySelector('.page:not(.leaving)');
    this.stage.append(pg);
    if (old) {
      if (dir) { old.classList.add('leaving'); old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 40}%) rotateY(${dir * 18}deg)`, opacity: 0 }], { duration: 300, easing: 'ease-in' }).onfinish = () => old.remove(); }
      else old.remove();
    }
    if (dir) pg.animate([{ transform: `translateX(${dir * 40}%) rotateY(${-dir * 18}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    try {
      if (b.kind === 'pdf') await this.drawPdf(pg, n); else if (this.reflow) await this.drawReflow(pg, n); else await this.drawText(pg, n);
    } catch (e) { pg.replaceChildren(h('div', { class: 'loading' }, e.message)); }
    if (n !== this.page) return;
    pg.append(h('div', { class: 'folio' }, `— ${n} —`));
    clearTimeout(this.trackT);
    this.sendTrack = () => { this.sendTrack = null; return post('/api/track', { book: b.id, type: 'page', page: n, ...(this.reflow ? { pages: this.total, pos: this.pageStarts[n - 1] } : {}) }).catch(() => {}); };
    this.trackT = setTimeout(() => this.sendTrack && this.sendTrack(), 700);
    // préchargement
    if (b.kind === 'pdf') { if (n < this.total) this.getImg(n + 1).catch(() => {}); } else if (!this.reflow && n < this.total) this.getText(n + 1);
    if (this.playing) this.highlight();
  }
  async drawPdf(pg, n) {
    const bmp = await this.getImg(n);
    if (n !== this.page) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const availW = pg.clientWidth - 28, availH = pg.clientHeight - 150;
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
    pg.replaceChildren(c);
  }
  async drawText(pg, n) {
    const t = await this.getText(n);
    if (n !== this.page) return;
    this.sents = sentences(t);
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
    this.sents = $$('.s', prose).map((x) => x.textContent);
    pg.replaceChildren(prose);
  }
  go(n, dir) {
    n = Math.max(1, Math.min(this.total, n));
    if (n === this.page && dir) { if (dir > 0 && n === this.total) toast('Fin du livre'); return; }
    const was = this.playing;
    if (was) { this.stopSpeech(); this.sIdx = 0; }
    this.page = n; this.render(dir).then(() => { if (was) this.play(); });
  }
  toggleZoom() { if (this.b.kind !== 'pdf') return; this.zoom = !this.zoom; this.el.classList.toggle('zooming', this.zoom); this.render(0); }
  appearance() {
    const themes = [['sepia', 'Sépia'], ['clair', 'Clair'], ['nuit', 'Nuit']];
    const seg = h('div', { class: 'seg' }, themes.map(([k, l]) => h('button', { class: k === this.theme ? 'sel' : '', onclick: (e) => { this.theme = k; store.set('theme', k); this.el.dataset.theme = k; $$('button', seg).forEach((x) => x.classList.remove('sel')); e.currentTarget.classList.add('sel'); } }, l)));
    const size = h('div', { class: 'seg' }, h('button', { onclick: () => this.setFs(-1) }, 'A−'), h('button', { onclick: () => this.setFs(1) }, 'A+'));
    sheet('Apparence', h('div', {}, h('div', { class: 'field' }, 'Fond', seg),
      this.b.kind !== 'pdf' ? h('div', { class: 'field' }, 'Taille du texte', size) : h('p', { class: 'muted' }, 'Touche deux fois une page pour zoomer.')));
  }
  setFs(d) {
    this.fs = Math.max(14, Math.min(30, this.fs + d)); store.set('fs', this.fs);
    if (this.reflow) { clearTimeout(this.fsT); this.fsT = setTimeout(() => this.relayout(), 250); return; }
    const p = $('.prose', this.el); if (p) p.style.setProperty('--fs', this.fs + 'px');
  }

  // ---- Audio ----
  toggleAudio(autoplay) {
    if (this.player) { this.closePlayer(); return; }
    this.audioBtn.classList.add('on');
    this.cap = h('div', { class: 'cap' }, 'Appuie sur lecture pour écouter cette page.');
    this.playBtn = h('button', { class: 'rbtn play', title: 'Lecture', onclick: () => this.playing ? this.pause() : this.play() }, icon('play'));
    const speeds = [0.8, 1, 1.15, 1.3, 1.5, 1.75, 2];
    const sp = h('button', { class: 'chip', title: 'Vitesse', onclick: () => { this.rate = speeds[(speeds.indexOf(this.rate) + 1) % speeds.length] || 1; store.set('rate', this.rate); sp.textContent = this.rate + '×'; if (this.playing) { this.stopSpeech(); this.play(); } } }, this.rate + '×');
    let voiceSel = null;
    const fillVoices = () => {
      const vs = TTS.voices(); if (!vs.length || !voiceSel) return;
      voiceSel.replaceChildren(...vs.slice(0, 40).map((v) => h('option', { value: v.name, selected: v.name === this.voice ? true : null }, `${v.name.replace(/Microsoft |Google |\(.*\)/g, '').trim()} · ${v.lang}`)));
    };
    if (!TTS.native()) { voiceSel = h('select', { 'aria-label': 'Voix', onchange: () => { this.voice = voiceSel.value; store.set('voice', this.voice); if (this.playing) { this.stopSpeech(); this.play(); } } }); fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
    this.player = h('div', { class: 'player paused' }, this.cap,
      h('div', { class: 'ctl' },
        sp,
        h('button', { class: 'rbtn', title: 'Phrase précédente', onclick: () => this.skip(-1) }, icon('prev')),
        this.playBtn,
        h('button', { class: 'rbtn', title: 'Phrase suivante', onclick: () => this.skip(1) }, icon('next')),
        voiceSel || h('span', { style: { width: '48px' } })),
      h('div', { class: 'jumps' }, [[-600, '−10 min'], [-180, '−3 min'], [-30, '−30 s'], [30, '+30 s'], [180, '+3 min'], [600, '+10 min']]
        .map(([sec, l]) => h('button', { class: 'jump' + (sec > 0 ? ' fwd' : ''), title: (sec > 0 ? 'Avancer de ' : 'Reculer de ') + l.slice(1), onclick: () => this.jump(sec) }, l))));
    this.el.append(this.player);
    if (autoplay) this.play();
  }
  closePlayer() { this.pause(); this.player?.remove(); this.player = null; this.audioBtn.classList.remove('on'); $$('.s.cur', this.el).forEach((x) => x.classList.remove('cur')); }
  async play() {
    if (!this.player) return;
    if (this.b.kind === 'pdf') this.sents = sentences(await this.getText(this.page));
    if (!this.sents.length) { this.cap.textContent = 'Cette page ne contient pas de texte lisible (image ou scan).'; if (this.page < this.total) { this.playing = true; this.setPlayUi(); setTimeout(() => this.playing && this.go(this.page + 1, 1), 1500); } return; }
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
    const s = this.sents[this.sIdx];
    this.highlight();
    const t0 = Date.now();
    TTS.speak(s, this.rate, this.voice, () => {
      if (token !== this.tok || !this.playing) return;
      // Garde-fou : si la synthèse vocale échoue (fin quasi instantanée), on s'arrête au lieu de défiler tout le livre
      if (s.length > 20 && Date.now() - t0 < 120) { this.quick = (this.quick || 0) + 1; } else this.quick = 0;
      if (this.quick >= 3) { this.quick = 0; this.pause(); this.cap.textContent = 'La voix du téléphone ne répond pas. Vérifie la synthèse vocale dans les réglages de l\'appareil.'; return; }
      this.sIdx++;
      if (this.sIdx < this.sents.length) this.speakCurrent();
      else if (this.page < this.total) { this.sIdx = 0; this.go(this.page + 1, 1); }
      else { this.pause(); this.cap.textContent = 'Fin du livre.'; }
    });
  }
  highlight() {
    if (!this.cap) return;
    const s = this.sents[this.sIdx] || '';
    this.cap.replaceChildren(h('span', { class: 'wave' }, h('i'), h('i'), h('i'), h('i')), s);
    $$('.s', this.el).forEach((x) => x.classList.toggle('cur', Number(x.dataset.i) === this.sIdx));
    const cur = $('.s.cur', this.el); if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // Phrases d'une page sans l'afficher (même découpage que l'affichage)
  async pageSents(n) {
    if (n === this.page && this.sents.length) return this.sents;
    if (this.reflow) return (this.pages[n - 1] || []).flatMap((it) => sentences(it.text));
    const t = await this.getText(n);
    if (this.b.kind === 'pdf') return sentences(t);
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
window.__androidBack = () => { if (window.__readerBack) return window.__readerBack(); const s = $('.scrim'); if (s) { s.remove(); return true; } return false; };

boot();
