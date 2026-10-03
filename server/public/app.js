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
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/>',
  shelf: '<rect x="4" y="4" width="4" height="11" rx=".8"/><rect x="10" y="6" width="4" height="9" rx=".8"/><rect x="16" y="3" width="4" height="12" rx=".8"/><path d="M2 19h20"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
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
async function loadBooks() { S.books = await api('/api/books'); }

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
  if (!b.progress && b.status === 'ready') cv.append(h('span', { class: 'ribbon', title: 'Nouveau' }));
  if (b.status === 'processing') cv.append(h('span', { class: 'status-pill' }, 'Préparation…'));
  if (b.status === 'error') cv.append(h('span', { class: 'status-pill' }, 'Fichier illisible'));
  el.append(h('span', { class: 'under' }, h('span', { class: 'tag k-' + b.kind }, KIND[b.kind] || b.kind.toUpperCase()), pct ? h('span', { class: 'tag pct' }, pct >= 99 ? 'Terminé' : pct + ' %') : null));
  el.addEventListener('click', () => { if (S.organize) return editBook(b); if (b.status === 'ready') openBook(b, el); });
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
    const row = h('button', { class: 'brow', title: b.title },
      thumb,
      h('div', { class: 'binfo' },
        h('div', { class: 'btitle' }, b.title),
        h('div', { class: 'bsub' }, b.author || '\u00a0'),
        h('div', { class: 'bbar' }, h('i', { style: { width: pct + '%' } })),
        h('div', { class: 'bmeta' },
          h('span', { class: 'tag k-' + b.kind }, KIND[b.kind] || b.kind.toUpperCase()),
          h('span', {}, pr ? (pct >= 99 ? 'Terminé' : `Page ${pr.page} sur ${b.pages} · ${pct} %`) : `${b.pages} pages · pas encore lu`)),
        h('div', { class: 'blast' }, pr ? `Dernière lecture : ${lastRead(pr.last)}` : 'Jamais ouvert')));
    row.addEventListener('click', () => { if (S.organize) return editBook(b); if (b.status === 'ready') openBook(b, thumb); });
    ownerGestures(row, b);
    list.append(row);
  }
  return list;
}
function renderLibrary() {
  const owner = S.me.role === 'owner';
  const books = S.books.filter((b) => !S.filter || (b.title + ' ' + b.author).toLowerCase().includes(S.filter.toLowerCase()));
  const n = perRow();
  const rows = Math.max(owner || books.length ? 2 : 1, Math.ceil(books.length / n));
  const asList = S.view === 'list';
  const caseEl = asList ? listEl(books) : h('div', { class: 'case' + (S.organize ? ' organize' : '') });
  for (let r = 0; r < (asList ? 0 : rows); r++) {
    const row = h('div', { class: 'shelf-books', style: { gridTemplateColumns: `repeat(${n}, 1fr)` } }, books.slice(r * n, r * n + n).map(bookEl));
    caseEl.append(h('div', { class: 'shelf' }, row, h('div', { class: 'plank' })));
  }
  if (!S.books.length && !asList) {
    caseEl.firstChild.prepend(h('div', { class: 'empty' },
      h('h3', {}, owner ? 'Tes rayons t\'attendent' : 'Les rayons sont encore vides'),
      h('p', {}, owner ? 'Ajoute un PDF ou un fichier texte. Tu peux aussi glisser des fichiers ici.' : 'Reviens bientôt, de nouveaux livres arrivent.'),
      owner ? h('div', { class: 'actions', style: { justifyContent: 'center' } },
        h('button', { class: 'btn primary', onclick: pickFiles }, icon('plus'), 'Ajouter un livre'),
        window.LocalAPI ? h('button', { class: 'btn', onclick: openFolder }, icon('folder'), 'Choisir un dossier') : null) : null));
  }
  const ready = S.books.filter((b) => b.status === 'ready');
  const current = ready.filter((b) => b.progress && b.progress.page < b.pages).sort((a, b) => b.progress.last - a.progress.last)[0];
  const actions = h('div', { class: 'actions' },
    owner ? h('button', { class: 'btn primary', onclick: pickFiles }, icon('plus'), h('span', { class: 'lbl' }, 'Ajouter un livre')) : null,
    owner && window.LocalAPI ? h('button', { class: 'btn', title: 'Dossier source', onclick: openFolder }, icon('folder'), h('span', { class: 'lbl' }, folderInfo() ? folderInfo().name : 'Dossier')) : null,
    owner && window.LocalAPI && folderInfo() ? h('button', { class: 'btn icon refresh' + (FOLDER.busy ? ' spin' : ''), title: 'Actualiser le dossier', 'aria-label': 'Actualiser le dossier', onclick: () => scanFolder() }, icon('refresh')) : null,
    owner && !window.LocalAPI ? h('button', { class: 'btn', onclick: openShare, title: 'Partager' }, icon('share'), h('span', { class: 'lbl' }, 'Partager')) : null,
    owner && !window.LocalAPI ? h('button', { class: 'btn', onclick: openDashboard, title: 'Lecteurs' }, icon('people'), h('span', { class: 'lbl' }, 'Lecteurs')) : null,
    S.books.length ? h('button', { class: 'btn icon', title: asList ? 'Voir l\'étagère' : 'Voir la liste', onclick: () => { S.view = asList ? 'shelf' : 'list'; store.set('view', S.view); renderLibrary(); } }, icon(asList ? 'shelf' : 'list')) : null,
    owner && S.books.length ? h('button', { class: 'btn icon' + (S.organize ? ' on' : ''), title: 'Organiser', onclick: () => { S.organize = !S.organize; renderLibrary(); if (S.organize) toast('Touche un livre pour le modifier'); } }, icon('pencil')) : null,
    h('button', { class: 'btn icon', title: 'Réglages', onclick: openSettings }, icon('gear')),
  );
  const room = h('div', { class: 'room' }, h('div', { class: 'wrap' },
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('h1', {}, S.me.library || 'Bibliothèque'),
        h('p', {}, `${ready.length} livre${ready.length > 1 ? 's' : ''}${owner ? '' : ' · Bonjour ' + S.me.name}`)),
      actions),
    current ? heroEl(current) : null,
    S.books.length > 8 ? h('div', { class: 'toolbar' }, h('input', { class: 'search', placeholder: 'Rechercher un titre ou un auteur', value: S.filter, oninput: (e) => { S.filter = e.target.value; const pos = e.target.selectionStart; renderLibrary(); const i = $('.search'); i.focus(); i.setSelectionRange(pos, pos); } })) : null,
    caseEl,
    owner && S.books.length ? h('p', { class: 'hint', style: { textAlign: 'center', marginTop: '18px' } }, 'Appui long ou clic droit sur un livre pour le modifier.') : null,
  ));
  $('#app').replaceChildren(room);
  // hors de #app : les messages d'envoi survivent au rafraîchissement de l'étagère
  if (!$('#uploads')) document.body.append(h('div', { class: 'uploads', id: 'uploads' }));
  if (!$('#dz')) document.body.append(h('div', { class: 'dropzone', id: 'dz' }, h('div', {}, 'Dépose tes livres ici')));
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
      if (window.LocalAPI) await LocalAPI.upload(f, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = msg; });
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
// ================= Dossier source =================
// Un dossier choisi une fois ; le bouton « Actualiser » le rescanne et ajoute seulement les nouveaux livres.
const FOLDER = { busy: false };
const hasNativeFolder = () => !!window.AndroidFolder;
function folderInfo() {
  if (hasNativeFolder()) { try { const j = AndroidFolder.info(); return j ? JSON.parse(j) : null; } catch { return null; } }
  return store.get('folder', null); // navigateur : on garde seulement le nom, il faudra rechoisir le dossier
}
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
async function chooseFolder() {
  if (hasNativeFolder()) {
    const r = await nativeCall('__folderPicked', () => AndroidFolder.pick());
    if (!r) return;
    store.set('folderLast', 0); renderLibrary(); toast(`Dossier « ${r.name} » choisi`);
    return scanFolder();
  }
  const files = await pickWebFolder(); if (!files.length) return;
  const name = (files[0].webkitRelativePath || '').split('/')[0] || 'Dossier';
  store.set('folder', { name }); renderLibrary();
  return scanFolder(files);
}
async function scanFolder(webFiles) {
  if (FOLDER.busy) return toast('Recherche déjà en cours…');
  let entries;
  if (hasNativeFolder()) {
    FOLDER.busy = true; renderLibrary();
    const box = h('div', { class: 'up' }, h('b', {}, folderInfo()?.name || 'Dossier'), h('span', { class: 'muted' }, 'Recherche de nouveaux livres…'), h('div', { class: 'bar' }, h('i', { class: 'indet' })));
    $('#uploads')?.append(box);
    const r = await nativeCall('__folderScanned', () => AndroidFolder.scan());
    box.remove();
    if (!r || r.error) { FOLDER.busy = false; renderLibrary(); return toast(r?.error || 'Lecture du dossier impossible'); }
    entries = r.files.map((f) => ({ src: 'saf:' + f.id, name: f.name, path: f.path, size: f.size, mtime: f.mtime, get: async () => {
      const resp = await fetch('/__dossier?id=' + encodeURIComponent(f.id));
      if (!resp.ok) throw new Error('Fichier illisible');
      return new File([await resp.blob()], f.name, { lastModified: f.mtime || Date.now() });
    } }));
  } else {
    if (!webFiles) { webFiles = await pickWebFolder(); if (!webFiles.length) return; }
    entries = webFiles.filter((f) => BOOK_EXT.test(f.name) && !f.name.startsWith('.')).map((f) => ({ src: 'web:' + (f.webkitRelativePath || f.name), name: f.name, path: f.webkitRelativePath || f.name, size: f.size, get: async () => f }));
    FOLDER.busy = true; renderLibrary();
  }
  try {
    const k = await LocalAPI.known();
    const fresh = entries.filter((e) => !k.has(e)).sort((a, b) => a.path.localeCompare(b.path, 'fr'));
    store.set('folderLast', Date.now());
    if (!fresh.length) return toast(entries.length ? 'Aucun nouveau livre dans le dossier' : 'Aucun livre trouvé dans ce dossier');
    let ok = 0, fail = 0;
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i];
      const box = h('div', { class: 'up' }, h('b', {}, e.name), h('span', { class: 'muted' }, `Dossier : livre ${i + 1} sur ${fresh.length}`), h('div', { class: 'bar' }, h('i', { style: { width: '0%' } })));
      $('#uploads')?.append(box);
      try {
        const file = await e.get();
        await LocalAPI.upload(file, (pct, msg) => { $('i', box).style.width = pct + '%'; if (msg) $('span', box).textContent = `${i + 1}/${fresh.length} · ${msg}`; }, { src: e.src });
        box.remove(); ok++;
        if (ok % 5 === 0) { await loadBooks(); renderLibrary(); } // l'étagère se remplit pendant l'import
      } catch (err) { fail++; $('span', box).textContent = err.message; $('span', box).style.color = 'var(--danger)'; setTimeout(() => box.remove(), 6000); }
    }
    toast(`${ok} nouveau${ok > 1 ? 'x' : ''} livre${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}` + (fail ? ` · ${fail} refusé${fail > 1 ? 's' : ''}` : ''));
  } finally {
    FOLDER.busy = false; await loadBooks(); renderLibrary();
  }
}
function openFolder() {
  const f = folderInfo(); const last = store.get('folderLast', 0);
  let ignored = []; try { ignored = JSON.parse(localStorage.getItem('bib.folderIgnored') || '[]'); } catch {}
  const close = sheet('Dossier source', h('div', {},
    h('p', { class: 'muted' }, f
      ? `Les livres PDF, Word et texte de ce dossier (et de ses sous-dossiers) sont ajoutés à l'étagère. Touche « Actualiser » pour aller chercher les nouveaux : ceux déjà présents ne sont pas ajoutés deux fois.`
      : `Choisis un dossier de ton téléphone. Tous ses livres PDF, Word et texte seront ajoutés à l'étagère, puis le bouton « Actualiser » ira chercher les nouveaux quand tu voudras.`),
    f ? h('div', { class: 'field' }, 'Dossier', h('p', { style: { margin: '4px 0 0', fontSize: '17px' } }, f.name)) : null,
    f ? h('p', { class: 'muted' }, 'Dernière recherche : ' + (last ? lastRead(last) : 'jamais')) : null,
    !hasNativeFolder() && f ? h('p', { class: 'hint' }, 'Dans un navigateur, il faut rechoisir le dossier à chaque actualisation.') : null,
    ignored.length ? h('p', { class: 'hint' }, `${ignored.length} livre${ignored.length > 1 ? 's' : ''} du dossier retiré${ignored.length > 1 ? 's' : ''} de l'étagère ne ser${ignored.length > 1 ? 'ont' : 'a'} pas réimporté${ignored.length > 1 ? 's' : ''}. `,
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); try { localStorage.removeItem('bib.folderIgnored'); } catch {} close(); toast('Ils reviendront à la prochaine actualisation'); } }, 'Les réimporter')) : null,
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      f ? h('button', { class: 'btn danger', onclick: () => { if (!confirm('Oublier ce dossier ? Les livres déjà ajoutés restent sur l\'étagère.')) return; if (hasNativeFolder()) AndroidFolder.forget(); store.set('folder', null); close(); renderLibrary(); toast('Dossier oublié'); } }, 'Oublier') : h('span'),
      h('div', { class: 'actions' },
        h('button', { class: f ? 'btn' : 'btn primary', onclick: () => { close(); chooseFolder(); } }, icon('folder'), f ? 'Changer' : 'Choisir un dossier'),
        f ? h('button', { class: 'btn primary', onclick: () => { close(); scanFolder(); } }, icon('refresh'), 'Actualiser') : null))));
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
  const close = sheet('Modifier le livre', h('div', {},
    h('label', { class: 'field' }, 'Titre', title),
    h('label', { class: 'field' }, 'Auteur', author),
    b.kind !== 'pdf' ? h('div', { class: 'field' }, 'Couleur de la couverture', sw) : null,
    h('p', { class: 'muted' }, `${KIND[b.kind] || b.kind} · ${b.pages} pages`),
    h('p', { class: 'muted' }, b.progress ? `Page ${b.progress.page} sur ${b.pages} · dernière lecture : ${lastRead(b.progress.last)} · ouvert ${b.progress.opens} fois` : 'Pas encore ouvert'),
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('button', { class: 'btn danger', onclick: async () => { if (!confirm(`Retirer « ${b.title} » de la bibliothèque ?`)) return; await api('/api/books/' + b.id, { method: 'DELETE' }); close(); await loadBooks(); renderLibrary(); toast('Livre retiré'); } }, 'Supprimer'),
      h('button', { class: 'btn primary', onclick: async () => { await post('/api/books/' + b.id, { title: title.value, author: author.value, color }, 'PATCH'); close(); await loadBooks(); renderLibrary(); } }, 'Enregistrer'))));
}
function openSettings() {
  const owner = S.me.role === 'owner';
  const decor = store.get('decor', 'noyer');
  const libName = h('input', { value: S.me.library, maxlength: 80 });
  const pw = h('input', { type: 'password', placeholder: 'Laisser vide pour ne pas changer', autocomplete: 'new-password' });
  const seg = h('div', { class: 'seg' }, [['noyer', 'Noyer'], ['chene', 'Chêne clair']].map(([k, l]) => h('button', { class: k === decor ? 'sel' : '', onclick: () => { store.set('decor', k); document.documentElement.dataset.decor = k; $$('button', seg).forEach((x) => x.classList.toggle('sel', x.textContent === l)); } }, l)));
  const close = sheet('Réglages', h('div', {},
    h('div', { class: 'field' }, 'Décor', seg),
    owner ? h('label', { class: 'field' }, 'Nom de la bibliothèque', libName) : null,
    owner && !window.LocalAPI ? h('label', { class: 'field' }, 'Nouveau mot de passe', pw) : null,
    window.LocalAPI ? h('p', { class: 'muted' }, 'Mode local : tes livres sont gardés dans ce navigateur, sur cet appareil seulement. Le partage et le suivi des lecteurs demandent un serveur.') : null,
    h('div', { class: 'actions', style: { marginTop: '18px', justifyContent: 'space-between' } },
      h('div', { class: 'actions' },
        window.LocalAPI ? null : h('button', { class: 'btn', onclick: async () => { await post('/api/logout', {}); close(); boot(); } }, icon('logout'), 'Déconnexion'),
        isNative() ? h('button', { class: 'btn', onclick: () => AndroidApp.changeServer() }, 'Adresse du serveur') : null),
      owner ? h('button', { class: 'btn primary', onclick: async () => {
        try { await post('/api/settings', { library: libName.value, password: pw.value || undefined }, 'PATCH'); S.me.library = libName.value; close(); renderLibrary(); toast('Réglages enregistrés'); } catch (e) { toast(e.message); }
      } }, 'Enregistrer') : null)));
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
        voiceSel || h('span', { style: { width: '48px' } })));
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
  skip(d) { this.sIdx = Math.max(0, Math.min(this.sents.length - 1, this.sIdx + d)); if (this.playing) { this.stopSpeech(); this.speakCurrent(); } else this.highlight(); }
  stopSpeech() { this.tok = (this.tok || 0) + 1; TTS.stop(); }
  pause() { this.playing = false; this.stopSpeech(); this.setPlayUi(); }
  setPlayUi() { if (!this.player) return; this.player.classList.toggle('paused', !this.playing); this.playBtn.replaceChildren(icon(this.playing ? 'pause' : 'play')); }
  close(fromPop) {
    if (this.closed) return; this.closed = true;
    this.pause();
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
// Bouton retour Android
window.__androidBack = () => { if (window.__readerBack) return window.__readerBack(); const s = $('.scrim'); if (s) { s.remove(); return true; } return false; };

boot();
