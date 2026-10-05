'use strict';
// Publieur — publier une application sur Google Play en appuyant sur un bouton.
// Tout ce que l'API de Google permet est fait automatiquement ; le reste (ce que Google réserve à la Play Console)
// est présenté en étapes d'un clic, avec le lien direct et les réponses suggérées prêtes à copier.

// ---------- Outils ----------
const $ = (s, el = document) => el.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' ko');

// ---------- Pont avec Android ----------
const Nat = {
  n: 0, cb: {}, prog: {},
  ok: () => !!(window.Pub && window.Pub.ok && window.Pub.ok()),
  call(fn, args, onProg) {
    return new Promise((res, rej) => {
      const id = 'c' + ++this.n;
      this.cb[id] = (j) => { delete this.prog[id]; let o; try { o = JSON.parse(j); } catch { o = { error: 'Réponse illisible' }; } o.error && o.status == null ? rej(new Error(o.error)) : res(o); };
      if (onProg) this.prog[id] = onProg;
      window.Pub[fn](...args, id);
    });
  },
};
window.__nat = (id, j) => { const f = Nat.cb[id]; delete Nat.cb[id]; if (f) f(j); };
window.__prog = (id, sent, total) => { const f = Nat.prog[id]; if (f) f(sent, total); };
const open = (url) => (Nat.ok() ? window.Pub.open(url) : window.open(url, '_blank'));
const copy = (text, what) => { if (Nat.ok()) window.Pub.copy(text); else navigator.clipboard?.writeText(text); toast((what || 'Texte') + ' copié'); };

// ---------- Mémoire de l'app ----------
const KEY = 'publieur.v1';
const S = Object.assign({ key: null, devAccount: false, accountNew: null, invited: false, contactEmail: '', apps: {} }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const appOf = (pkg) => (S.apps[pkg] = S.apps[pkg] || { pkg, todo: {} });

// ---------- Règles de Google Play (vérifiées en octobre 2026) ----------
const RULES_CHECKED = 'octobre 2026';
const TARGET_RULES = [{ from: '2025-08-31', sdk: 35 }, { from: '2026-08-31', sdk: 36 }]; // nouvelles apps et mises à jour
const requiredTarget = () => { let sdk = 34; const now = new Date(); for (const r of TARGET_RULES) if (now >= new Date(r.from)) sdk = r.sdk; return sdk; };
const ANDROID_NAME = { 34: 'Android 14', 35: 'Android 15', 36: 'Android 16', 37: 'Android 17' };
const LANG = 'fr-CA';

// Liens de la Play Console et de Google Cloud
const L = {
  signup: 'https://play.google.com/console/signup',
  console: 'https://play.google.com/console',
  users: 'https://play.google.com/console/users-and-permissions',
  project: 'https://console.cloud.google.com/projectcreate',
  api: 'https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com',
  sa: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
  testing: (pkg) => 'https://play.google.com/apps/testing/' + pkg,
  store: (pkg) => 'https://play.google.com/store/apps/details?id=' + pkg,
  help12: 'https://support.google.com/googleplay/android-developer/answer/14151465',
};

// Politiques de confidentialité déjà hébergées (dépôt public GitHub)
const KNOWN = {
  'ca.bibliotheque.app': {
    policy: 'https://github.com/danmark2002-ops/bibliotheque/blob/main/docs/confidentialite/ca.bibliotheque.app.md',
    category: 'Livres et références',
    purpose: 'Votre bibliothèque personnelle : lisez et écoutez vos livres, en français',
    features: ['Lit les PDF, EPUB, Word, Kindle, BD et livres audio', 'Lecture à voix haute avec voix québécoise, vitesse réglable et minuterie', 'Tourne les pages comme un vrai livre', 'Convertit les pages photographiées en texte', 'Livres gratuits du domaine public intégrés', 'Partage de votre bibliothèque avec vos proches'],
    ads: false, account: false, sends: false,
  },
};

// ---------- Google : connexion et appels à l'API Android Publisher ----------
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const UP = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/';
const G = {
  tok: null, exp: 0,
  async token() {
    if (this.tok && Date.now() < this.exp - 60000) return this.tok;
    if (!S.key) throw explainable('nokey');
    const r = await Nat.call('token', [JSON.stringify(S.key)]);
    if (r.status !== 200) throw apiError(r);
    this.tok = r.json.access_token; this.exp = Date.now() + (r.json.expires_in || 3600) * 1000;
    return this.tok;
  },
  async req(method, path, body, opt = {}) {
    const t = await this.token();
    const url = (opt.file ? UP : API) + path + (opt.file ? (path.includes('?') ? '&' : '?') + 'uploadType=media' : '');
    const headers = { Authorization: 'Bearer ' + t };
    if (opt.file) headers['Content-Type'] = opt.ctype || 'application/octet-stream';
    else if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
    const r = await Nat.call('http', [method, url, JSON.stringify(headers), body !== undefined ? JSON.stringify(body) : null, opt.file || null], opt.onProg);
    if (r.status >= 400) throw apiError(r);
    return r.json || {};
  },
};

// ---------- Erreurs : traduites en français, avec quoi faire ----------
function explainable(code, raw) { const e = new Error(code); e.code = code; e.raw = raw || ''; return e; }
function apiError(r) {
  const j = r.json || {};
  const msg = j.error?.message || j.error_description || (typeof j.error === 'string' ? j.error : '') || r.body || ('Erreur ' + r.status);
  const e = new Error(msg); e.status = r.status; e.raw = msg; return e;
}
function explain(e, ctx = {}) {
  const m = String(e.raw || e.message || ''); const st = e.status;
  const link = (m.match(/https:\/\/console\.(developers|cloud)\.google\.com\/[^\s"]+/) || [])[0];
  if (e.code === 'nokey') return { title: 'La clé d’accès n’est pas encore importée', detail: 'C’est l’étape 2 de la préparation du compte.', go: 'setup' };
  if (/invalid_grant|invalid_client|Invalid JWT|account not found/i.test(m)) return { title: 'La clé d’accès est refusée par Google', detail: 'Elle a peut-être été supprimée ou désactivée. Crée une nouvelle clé JSON et importe-la (étape 2).', go: 'setup' };
  if (/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(m)) return { title: 'L’API Google Play n’est pas activée', detail: 'Active-la en un clic, attends une minute, puis réessaie.', url: link || L.api, urlLabel: 'Activer l’API' };
  if (/Package not found|not found: .*applications|No application was found/i.test(m) || (st === 404 && ctx.step === 'edit')) return { title: 'L’application n’existe pas encore dans la Play Console', detail: 'Google exige de la créer une première fois à la main (environ 1 minute). Le Publieur te guide.', go: 'create' };
  if (st === 403 || /does not have permission|caller does not have permission|insufficient/i.test(m)) return { title: 'Le Publieur n’a pas encore accès à ton compte Google Play', detail: 'Invite l’adresse de la clé dans « Utilisateurs et autorisations », avec les droits d’administrateur (étape 3). L’accès peut prendre quelques minutes à s’activer.', go: 'setup' };
  if (/version code .* (has )?already been used|already been used/i.test(m)) return { title: 'Ce numéro de version a déjà été envoyé', detail: 'Chaque envoi doit avoir un numéro de version (versionCode) plus grand. Demande à Claude d’augmenter la version, puis recompile.', copy: `Augmente le numéro de version (versionCode) de l'application ${ctx.label || ''} et recompile le .aab.` };
  if (/debug mode|debuggable/i.test(m)) return { title: 'Le fichier est signé « en mode test »', detail: 'Google refuse les fichiers de test. Il faut une version « release » signée avec ta clé.', copy: `Produis un .aab release signé (pas debug) pour ${ctx.label || 'mon application'}.` };
  if (/signed with the wrong key|wrong signing key|invalid signature|certificate/i.test(m)) return { title: 'Le fichier n’est pas signé avec la bonne clé', detail: 'Google attend toujours la même clé d’envoi que la première fois. Si elle a été perdue, on peut la réinitialiser depuis la Play Console (Intégrité de l’app → Signature).', url: L.console, urlLabel: 'Ouvrir la Play Console' };
  if (/target.*API level|targetSdk/i.test(m)) return { title: 'L’application vise une version d’Android trop ancienne', detail: `Google exige au moins ${ANDROID_NAME[requiredTarget()] || 'API ' + requiredTarget()} (API ${requiredTarget()}).`, copy: targetPrompt(ctx.label) };
  if (/APKs are not allowed|must use the Android App Bundle|App Bundle/i.test(m)) return { title: 'Google veut le format .aab', detail: 'Les nouvelles applications doivent être envoyées en .aab (Android App Bundle), pas en .apk.', copy: `Fais produire un fichier .aab (Android App Bundle) pour ${ctx.label || 'mon application'}.` };
  if (/Only releases with status draft/i.test(m)) return { title: 'Première version : envoyée en brouillon', detail: 'Normal pour une nouvelle app. Termine les étapes de la Play Console, puis envoie-la en examen.' };
  if (/precondition|edit.*(expired|deleted)|editId/i.test(m)) return { title: 'La session avec Google a expiré', detail: 'Réessaie : le Publieur recommencera proprement.' };
  if (/Unable to resolve host|UnknownHost|timeout|timed out|Failed to connect|network/i.test(m)) return { title: 'Pas de connexion Internet', detail: 'Vérifie le Wi-Fi ou les données mobiles, puis réessaie.' };
  return { title: 'Google a refusé cette étape', detail: m.slice(0, 400) };
}
const targetPrompt = (label) => `Passe l'application ${label ? '« ' + label + ' » ' : ''}à ${ANDROID_NAME[requiredTarget()] || 'la dernière version d’Android'} : targetSdk ${requiredTarget()} et compileSdk ${requiredTarget()}, vérifie que tout fonctionne, puis recompile le .aab.`;

// ---------- Analyse du fichier ----------
async function analyze(file) {
  const lower = file.name.toLowerCase();
  let info;
  if (lower.endsWith('.apk')) {
    const j = window.Pub.apkInfo(file.path); if (!j) throw new Error('Ce fichier .apk est illisible.');
    info = JSON.parse(j); info.kind = 'apk'; info.signed = !!info.signer; info.debug = /Android Debug/i.test(info.signer || '');
  } else if (lower.endsWith('.aab')) {
    const man = window.Pub.zipRead(file.path, 'base/manifest/AndroidManifest.xml');
    if (!man) throw new Error('Ce fichier .aab est illisible (manifeste absent).');
    const res = window.Pub.zipRead(file.path, 'base/resources.pb');
    info = window.AAB.parse(man, res); info.kind = 'aab';
    const list = JSON.parse(window.Pub.zipList(file.path) || '[]');
    info.signed = list.some((e) => /^META-INF\/[^/]+\.(RSA|DSA|EC)\|/i.test(e));
    if (info.iconFile) { const b = window.Pub.zipRead(file.path, info.iconFile); if (b) info.icon = b; info.iconMime = /\.webp$/i.test(info.iconFile) ? 'image/webp' : 'image/png'; }
  } else throw new Error('Choisis un fichier .aab (recommandé) ou .apk.');
  info.file = file; info.size = file.size;
  if (!info.label) info.label = file.name.replace(/\.(aab|apk)$/i, '').replace(/[-_]+/g, ' ').replace(/\b(release|signed|v?\d+(\.\d+)*)\b/gi, '').trim() || info.package;
  return info;
}

const PERMS = {
  'android.permission.MANAGE_EXTERNAL_STORAGE': { level: 'bad', t: 'Accès à tous les fichiers', d: 'Google refuse presque toujours cette permission, sauf pour les gestionnaires de fichiers et antivirus. Le plus simple : la retirer de la version Google Play.', fix: (l) => `Prépare une version Google Play de ${l} sans la permission MANAGE_EXTERNAL_STORAGE (accès à tous les fichiers) : remplace-la par le sélecteur de fichiers d'Android, puis recompile le .aab.` },
  'android.permission.QUERY_ALL_PACKAGES': { level: 'warn', t: 'Liste de toutes les apps installées', d: 'Permission surveillée : il faudra la justifier dans la Play Console, ou la retirer.' },
  'android.permission.REQUEST_INSTALL_PACKAGES': { level: 'warn', t: 'Installation d’autres apps', d: 'Permission surveillée : à justifier dans la Play Console.' },
  'android.permission.READ_SMS': { level: 'bad', t: 'Lecture des SMS', d: 'Réservée aux apps de messagerie par défaut.' },
  'android.permission.SEND_SMS': { level: 'bad', t: 'Envoi de SMS', d: 'Réservée aux apps de messagerie par défaut.' },
  'android.permission.READ_CALL_LOG': { level: 'bad', t: 'Journal d’appels', d: 'Réservée aux apps de téléphone par défaut.' },
  'android.permission.ACCESS_BACKGROUND_LOCATION': { level: 'warn', t: 'Position en arrière-plan', d: 'Demande une déclaration et une vidéo de démonstration dans la Play Console.' },
  'android.permission.SCHEDULE_EXACT_ALARM': { level: 'warn', t: 'Alarmes exactes', d: 'À déclarer dans la Play Console (réservé aux alarmes et calendriers).' },
  'android.permission.USE_EXACT_ALARM': { level: 'warn', t: 'Alarmes exactes', d: 'Réservé aux applis de réveil ou de calendrier.' },
  'android.permission.SYSTEM_ALERT_WINDOW': { level: 'warn', t: 'Affichage par-dessus les autres apps', d: 'Possible, mais à justifier si Google le demande.' },
  'android.permission.RECORD_AUDIO': { level: 'info', t: 'Micro', d: 'À mentionner dans la sécurité des données et la politique de confidentialité.' },
  'android.permission.CAMERA': { level: 'info', t: 'Caméra', d: 'À mentionner dans la sécurité des données et la politique de confidentialité.' },
  'android.permission.ACCESS_FINE_LOCATION': { level: 'info', t: 'Position précise', d: 'À mentionner dans la sécurité des données et la politique de confidentialité.' },
};
const fgsPerms = (info) => info.permissions.filter((p) => /FOREGROUND_SERVICE_/.test(p)).map((p) => p.replace('android.permission.FOREGROUND_SERVICE_', '').toLowerCase().replace(/_/g, ' '));

function checks(info) {
  const out = [], app = S.apps[info.package] || {}, l = info.label;
  const add = (level, title, detail, fix) => out.push({ level, title, detail, fix });
  if (info.kind === 'aab') add('ok', 'Format .aab', 'C’est le format exigé par Google Play.');
  else add(app.created && app.apkBased ? 'warn' : 'bad', 'Format .apk', 'Google Play n’accepte plus les .apk pour les nouvelles applications : il faut le .aab. Pour les applis que Claude fabrique, le .aab est publié à côté de l’APK dans GitHub (« Releases »).', `Fais produire un fichier .aab (Android App Bundle) pour ${l}, à côté de l'APK.`);
  if (!info.signed) add('bad', 'Fichier non signé', 'Google exige un fichier signé avec ta clé d’envoi.', `Signe le .aab de ${l} avec une clé de version (release).`);
  else if (info.debug) add('bad', 'Signé en mode test', 'Google refuse les fichiers « debug ».', `Produis un .aab release signé (pas debug) pour ${l}.`);
  else add('ok', 'Signé', info.signer ? 'Signataire : ' + info.signer.replace(/,.*/, '') : 'Signature présente.');
  const req = requiredTarget();
  if (!info.targetSdk || info.targetSdk < req) add('bad', `Vise ${ANDROID_NAME[info.targetSdk] || 'API ' + info.targetSdk} : trop ancien`, `Google exige ${ANDROID_NAME[req] || 'API ' + req} (API ${req}) depuis le 31 août 2026 pour les nouvelles apps et les mises à jour.`, targetPrompt(l));
  else add('ok', `Vise ${ANDROID_NAME[info.targetSdk] || 'API ' + info.targetSdk}`, 'Version d’Android acceptée par Google.');
  if (/^com\.example\./.test(info.package)) add('bad', 'Identifiant « com.example »', 'Google refuse cet identifiant. Il faut un identifiant à toi (ex. ca.monnom.monapp).', `Change l'identifiant de l'application ${l} (applicationId) pour un nom à moi, pas com.example.`);
  if (app.lastVersionCode && info.versionCode <= app.lastVersionCode) add('bad', `Version ${info.versionCode} déjà envoyée`, `La dernière version envoyée est ${app.lastVersionCode}. Il faut un numéro plus grand.`, `Augmente le numéro de version (versionCode) de ${l} et recompile le .aab.`);
  else add('ok', `Version ${info.versionName || ''} (n° ${info.versionCode})`, app.lastVersionCode ? `Plus récente que la dernière envoyée (${app.lastVersionCode}).` : 'Première publication.');
  for (const p of info.permissions) { const x = PERMS[p]; if (x) add(x.level, x.t, x.d, x.fix ? x.fix(l) : null); }
  const fgs = fgsPerms(info);
  if (fgs.length) add('warn', 'Services de premier plan (' + fgs.join(', ') + ')', 'À déclarer dans la Play Console (Contenu de l’app). Le Publieur te donne le texte à copier.');
  return out;
}

// ---------- Images pour la fiche Google Play ----------
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible')); i.src = src; }); }
function canvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }
const b64of = (c, type = 'image/png', q = 0.92) => c.toDataURL(type, q).split(',')[1];
function initials(name) { return (name.match(/\p{L}/u) || ['A'])[0].toUpperCase(); }
async function dominant(img) { const c = canvas(24, 24), g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { const s = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (s > 30) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } } return n ? [r / n, gg / n, b / n].map(Math.round) : [40, 120, 90]; }

async function makeIcon(info) {
  const c = canvas(512, 512), g = c.getContext('2d');
  if (info.icon) {
    const img = await loadImg(`data:${info.iconMime || 'image/png'};base64,${info.icon}`);
    g.drawImage(img, 0, 0, 512, 512);
  } else {
    const grd = g.createLinearGradient(0, 0, 512, 512); grd.addColorStop(0, '#1f7a4d'); grd.addColorStop(1, '#0f3b27');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#fff'; g.font = 'bold 300px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials(info.label), 256, 276);
  }
  return c;
}
async function makeFeature(info, iconCanvas, tagline) {
  const c = canvas(1024, 500), g = c.getContext('2d');
  const [r, gg, b] = await dominant(iconCanvas);
  const dark = `rgb(${Math.round(r * 0.35)},${Math.round(gg * 0.35)},${Math.round(b * 0.35)})`, mid = `rgb(${Math.round(r * 0.7)},${Math.round(gg * 0.7)},${Math.round(b * 0.7)})`;
  const grd = g.createLinearGradient(0, 0, 1024, 500); grd.addColorStop(0, dark); grd.addColorStop(1, mid); g.fillStyle = grd; g.fillRect(0, 0, 1024, 500);
  g.save(); g.beginPath(); const x = 90, y = 130, s = 240, rr = 54; g.moveTo(x + rr, y); g.arcTo(x + s, y, x + s, y + s, rr); g.arcTo(x + s, y + s, x, y + s, rr); g.arcTo(x, y + s, x, y, rr); g.arcTo(x, y, x + s, y, rr); g.closePath();
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fill(); g.shadowBlur = 0; g.clip(); g.drawImage(iconCanvas, x, y, s, s); g.restore();
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  let fs = 74; g.font = `800 ${fs}px system-ui, sans-serif`; while (g.measureText(info.label).width > 600 && fs > 36) { fs -= 4; g.font = `800 ${fs}px system-ui, sans-serif`; }
  g.fillText(info.label, 380, 250);
  if (tagline) {
    g.font = '400 30px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.88)';
    const words = tagline.split(/\s+/); let line = '', yy = 305; const lines = [];
    for (const w of words) { if (g.measureText(line + ' ' + w).width > 580 && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((ln, i) => g.fillText(ln, 380, yy + i * 40));
  }
  return c;
}
// Capture d'écran : Google refuse un côté plus de 2 fois plus long que l'autre → on recadre (barres du haut et du bas)
async function fitShot(url) {
  const img = await loadImg(url); let w = img.naturalWidth, hh = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = hh;
  if (hh > 2 * w) { sh = 2 * w; sy = Math.round((hh - sh) / 2); } else if (w > 2 * hh) { sw = 2 * hh; sx = Math.round((w - sw) / 2); }
  let scale = Math.min(1, 3840 / Math.max(sw, sh)); if (Math.min(sw, sh) * scale < 320) scale = 320 / Math.min(sw, sh);
  const c = canvas(Math.round(sw * scale), Math.round(sh * scale)); c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

// ---------- Textes générés ----------
function listingFor(info, a) {
  const k = KNOWN[info.package] || {};
  const name = info.label.slice(0, 30);
  const purpose = (a.purpose || k.purpose || '').trim().replace(/\.$/, '');
  const features = (Array.isArray(a.features) ? a.features : String(a.features || '').split('\n')).map((x) => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const feats = features.length ? features : (k.features || []);
  const short = (purpose || `${name}, simple et en français`).slice(0, 80);
  const parts = [`${name} — ${purpose || 'une application simple et en français'}.`];
  if (feats.length) parts.push('Ce que vous pouvez faire :\n' + feats.map((f) => '• ' + f).join('\n'));
  const promises = [];
  if (!a.ads) promises.push('aucune publicité');
  if (!a.account) promises.push('aucun compte à créer');
  if (!a.sends) promises.push('vos données restent sur votre appareil');
  if (promises.length) parts.push(promises[0][0].toUpperCase() + promises.join(', ').slice(1) + '.');
  return { title: name, shortDescription: short, fullDescription: parts.join('\n\n').slice(0, 4000) };
}
function policyFor(info, a) {
  const today = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const p = info.permissions, mail = S.contactEmail || '[votre courriel]';
  const uses = [];
  if (p.includes('android.permission.INTERNET')) uses.push('Internet : pour télécharger du contenu ou utiliser les fonctions en ligne que vous lancez vous-même.');
  if (p.includes('android.permission.RECORD_AUDIO')) uses.push('Micro : seulement quand vous utilisez une fonction vocale ; le son n’est pas enregistré ni envoyé au développeur.');
  if (p.includes('android.permission.CAMERA')) uses.push('Caméra : seulement quand vous prenez une photo dans l’application.');
  if (p.some((x) => /STORAGE|READ_MEDIA/.test(x))) uses.push('Fichiers : pour ouvrir les fichiers que vous choisissez.');
  if (p.some((x) => /LOCATION/.test(x))) uses.push('Position : seulement pour la fonction qui en a besoin.');
  return `# Politique de confidentialité — ${info.label}

Dernière mise à jour : ${today}

## Données collectées
${a.sends ? 'L’application envoie certaines données à un serveur pour fonctionner. Elles servent uniquement à fournir le service et ne sont jamais vendues.' : 'L’application ne collecte aucune donnée personnelle et n’envoie aucune information vous concernant au développeur. Vos fichiers, réglages et votre progression restent sur votre appareil.'}

## Autorisations utilisées
${uses.length ? uses.map((u) => '- ' + u).join('\n') : '- Aucune autorisation sensible.'}

## Publicité et comptes
${a.ads ? 'L’application affiche de la publicité.' : 'L’application n’affiche aucune publicité.'} ${a.account ? 'Un compte est nécessaire pour certaines fonctions.' : 'Aucun compte n’est nécessaire.'}

## Services tiers
Les fonctions qui s’appuient sur des services externes (par exemple un catalogue en ligne ou un service de Google) ne sont utilisées que lorsque vous les lancez, et sont soumises à la politique de confidentialité de ces services.

## Enfants
L’application ne s’adresse pas particulièrement aux enfants de moins de 13 ans.

## Contact
Pour toute question : ${mail}

---

# Privacy policy — ${info.label}

${a.sends ? 'The app sends some data to a server in order to work; it is only used to provide the service and is never sold.' : 'The app does not collect personal data and does not send any information about you to the developer. Your files, settings and progress stay on your device.'} ${a.ads ? 'The app shows ads.' : 'The app shows no ads.'} Permissions are used only for the features you start yourself. Contact: ${mail}
`;
}

// ---------- Navigation ----------
let view = { name: 'home' }; const hist = [];
function go(name, data = {}) { hist.push(view); view = { name, ...data }; render(); scrollTo(0, 0); }
function back() { if (!hist.length) return false; view = hist.pop(); render(); return true; }
window.__back = () => back();
const header = (title, sub) => h('div', { class: 'top' }, hist.length ? h('button', { class: 'back', 'aria-label': 'Retour', onclick: back }, '←') : h('div', { class: 'logo' }, '▲'), h('div', {}, h('h1', {}, title), sub ? h('small', {}, sub) : null));

function render() {
  const app = $('#app'); app.replaceChildren();
  if (!Nat.ok()) { app.append(header('Publieur'), h('div', { class: 'card' }, h('p', {}, 'Ouvre cette page dans l’application Publieur sur ton téléphone Android.'))); return; }
  const V = { home: vHome, setup: vSetup, publish: vPublish, app: vApp }[view.name] || vHome;
  app.append(...[V(view)].flat(Infinity).filter(Boolean));
}

// ---------- Accueil ----------
const setupSteps = () => [S.devAccount, !!S.key, S.invited];
const setupDone = () => setupSteps().every(Boolean);
function vHome() {
  const out = [header('Publieur', 'Publier sur Google Play, presque tout seul')];
  if (!setupDone()) {
    const n = setupSteps().filter(Boolean).length;
    out.push(h('div', { class: 'card' }, h('h2', {}, 'Préparer ton compte (une seule fois)'), h('p', {}, `${n} étape${n > 1 ? 's' : ''} sur 3 terminée${n > 1 ? 's' : ''}. Environ 15 minutes, à faire une seule fois.`),
      h('div', { class: 'bar' }, h('i', { style: { width: (n / 3) * 100 + '%' } })), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go('setup') }, n ? 'Continuer' : 'Commencer'))));
  }
  out.push(h('div', { class: 'card go' }, h('h2', {}, 'Publier une application'), h('p', {}, 'Choisis le fichier .aab (ou .apk) : le Publieur vérifie tout, prépare la fiche et l’envoie à Google.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: pickApp }, 'Choisir le fichier'))));
  const apps = Object.values(S.apps).filter((a) => a.label);
  if (apps.length) out.push(h('div', { class: 'card applist' }, h('h2', {}, 'Mes applications'), apps.map((a) => h('button', { class: 'item', onclick: () => go('app', { pkg: a.pkg }) },
    a.iconUrl ? h('img', { src: a.iconUrl, alt: '' }) : h('div', { class: 'ph' }, initials(a.label)), h('div', { class: 'grow' }, h('b', {}, a.label), h('br'), h('small', {}, a.pkg)), statusChip(a)))));
  out.push(h('p', { class: 'muted', style: { textAlign: 'center', marginTop: '18px' } }, `Règles de Google Play vérifiées : ${RULES_CHECKED}.`));
  return out;
}
function statusChip(a) {
  if (a.live) return h('span', { class: 'chip go' }, 'En ligne');
  if (a.testStart) { const d = testDay(a); return h('span', { class: 'chip ' + (d >= 14 ? 'go' : 'warn') }, d >= 14 ? 'Test terminé' : `Test : jour ${d}/14`); }
  if (a.sent) return h('span', { class: 'chip warn' }, a.draft ? 'Brouillon envoyé' : 'Envoyée');
  return h('span', { class: 'chip' }, 'À publier');
}
const testDay = (a) => Math.min(99, Math.floor((Date.now() - a.testStart) / 864e5) + 1);

async function pickApp() {
  try {
    const r = await Nat.call('pick', ['app']); const f = r.files && r.files[0]; if (!f) return;
    await startWith(f);
  } catch (e) { toast(e.message); }
}
let lastIncoming = '';
window.__incoming = (j) => { let arr; try { arr = JSON.parse(j); } catch { return; } const f = arr[0]; if (!f || f.path === lastIncoming) return; lastIncoming = f.path; startWith(f).catch((e) => toast(e.message)); };
async function startWith(f) {
  const info = await analyze(f);
  go('publish', { info, step: 'check', answers: Object.assign({ ads: false, account: false, sends: false }, KNOWN[info.package] || {}, S.apps[info.package]?.answers || {}) });
}

// ---------- Préparation du compte ----------
function vSetup() {
  const out = [header('Préparer ton compte', 'Une seule fois. Ensuite, chaque publication se fait en un bouton.')];
  const st = setupSteps(); const now = st.findIndex((x) => !x);
  const cls = (i) => 'step ' + (st[i] ? 'done' : i === now ? 'now' : 'todo');
  const linkBtn = (label, url) => h('button', { class: 'btn link small', onclick: () => open(url) }, label + ' ↗');

  const s1 = h('li', { class: cls(0) }, h('div', { class: 'dot' }, st[0] ? '✓' : '1'), h('div', {},
    h('h3', {}, 'Compte développeur Google Play'),
    h('p', {}, 'Coût unique de 25 $ US, payé à Google. Google vérifie ton identité (pièce d’identité) : compte quelques jours.'),
    st[0] ? h('small', {}, S.accountNew === false ? 'Compte créé avant novembre 2023 : pas de test obligatoire.' : 'Compte récent : Google exige un test fermé de 14 jours avec 12 testeurs avant la mise en ligne. Le Publieur te guide.') : [
      h('div', { class: 'row' }, linkBtn('Créer le compte', L.signup)),
      h('div', { class: 'q' }, h('b', {}, 'Ton compte Google Play existe-t-il déjà ?'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => { S.devAccount = true; S.accountNew = false; save(); render(); } }, 'Oui, créé avant nov. 2023'),
          h('button', { class: 'btn small', onclick: () => { S.devAccount = true; S.accountNew = true; save(); render(); } }, 'Oui, plus récent'),
          h('button', { class: 'btn small', onclick: () => { S.devAccount = true; S.accountNew = true; save(); render(); } }, 'Je viens de le créer'))),
    ]));

  const email = S.key?.client_email || '';
  const s2 = h('li', { class: cls(1) }, h('div', { class: 'dot' }, st[1] ? '✓' : '2'), h('div', {},
    h('h3', {}, 'Clé d’accès pour le Publieur'),
    st[1] ? h('small', {}, 'Clé importée et acceptée par Google : ' + email) : [
      h('p', {}, 'Elle permet au Publieur d’envoyer tes applis à ta place. Dans Google Cloud (gratuit), avec le même compte Google :'),
      h('ol', { style: { margin: '6px 0', paddingLeft: '20px', color: 'var(--ink-2)' } },
        h('li', {}, 'Crée un projet (nom : Publieur). ', linkBtn('Ouvrir', L.project)),
        h('li', {}, 'Active « Google Play Android Developer API ». ', linkBtn('Ouvrir', L.api)),
        h('li', {}, 'Crée un compte de service (nom : publieur), sans rôle. ', linkBtn('Ouvrir', L.sa)),
        h('li', {}, 'Dans ce compte de service : Clés → Ajouter une clé → JSON. Le fichier se télécharge.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: importKey }, 'Importer le fichier .json')),
    ]));

  const s3 = h('li', { class: cls(2) }, h('div', { class: 'dot' }, st[2] ? '✓' : '3'), h('div', {},
    h('h3', {}, 'Donner accès dans la Play Console'),
    st[2] ? h('small', {}, 'Accès donné. Il sera confirmé à la première publication.') : [
      h('p', {}, 'Play Console → Utilisateurs et autorisations → Inviter un nouvel utilisateur. Colle cette adresse, coche « Administrateur » (toutes les autorisations), puis Inviter :'),
      email ? h('div', { class: 'copyline' }, h('span', {}, email), h('button', { class: 'btn small', onclick: () => copy(email, 'Adresse') }, 'Copier')) : h('small', {}, 'L’adresse apparaîtra ici après l’étape 2.'),
      h('div', { class: 'row' }, linkBtn('Ouvrir Utilisateurs et autorisations', L.users), h('button', { class: 'btn small', disabled: !email || null, onclick: () => { S.invited = true; save(); render(); toast('Parfait'); } }, 'C’est fait')),
    ]));
  out.push(h('div', { class: 'card' }, h('ul', { class: 'steps' }, s1, s2, s3)));
  if (setupDone()) out.push(h('div', { class: 'card go' }, h('h2', {}, 'Tout est prêt'), h('p', {}, 'Tu peux maintenant publier une application en un bouton.'), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { hist.length = 0; view = { name: 'home' }; render(); } }, 'Aller à l’accueil'))));
  return out;
}
async function importKey() {
  try {
    const r = await Nat.call('pick', ['json']); const f = r.files && r.files[0]; if (!f) return;
    const txt = window.Pub.readText(f.path); let k;
    try { k = JSON.parse(txt); } catch { throw new Error('Ce fichier n’est pas une clé JSON.'); }
    if (k.type !== 'service_account' || !k.private_key || !k.client_email) throw new Error('Ce n’est pas une clé de compte de service (type « service_account »).');
    toast('Vérification auprès de Google…');
    const prev = S.key; S.key = { type: k.type, client_email: k.client_email, private_key: k.private_key, token_uri: k.token_uri, project_id: k.project_id };
    G.tok = null;
    try { await G.token(); } catch (e) { S.key = prev; const x = explain(e); throw new Error(x.title + '. ' + x.detail); }
    save(); render(); toast('Clé acceptée par Google');
  } catch (e) { toast(e.message); }
}

// ---------- Publication ----------
function vPublish(v) {
  const info = v.info, a = v.answers;
  const head = h('div', { class: 'card' }, h('div', { class: 'app-head' }, info.icon ? h('img', { src: `data:${info.iconMime || 'image/png'};base64,${info.icon}`, alt: '' }) : h('div', { class: 'ph' }, initials(info.label)),
    h('div', {}, h('h2', {}, info.label), h('small', {}, `${info.package} · version ${info.versionName || '?'} (${info.versionCode}) · ${info.kind.toUpperCase()} · ${fmtSize(info.size)}`))));
  if (v.step === 'check') return [header('Vérification'), head, vChecks(v)];
  if (v.step === 'listing') return [header('Fiche Google Play', 'Générée pour toi — modifie seulement si tu veux'), head, vListing(v)];
  if (v.step === 'create') return [header('Créer l’app sur Google Play', 'Une seule fois, environ 1 minute'), head, vCreate(v)];
  if (v.step === 'send') return [header('Envoi à Google'), head, vSend(v)];
  return [header('Publieur'), head];
}

function vChecks(v) {
  const list = checks(v.info), blocks = list.filter((c) => c.level === 'bad');
  const icon = { ok: '✅', warn: '⚠️', bad: '⛔', info: 'ℹ️' };
  const card = h('div', { class: 'card' }, h('h2', {}, blocks.length ? `${blocks.length} point${blocks.length > 1 ? 's' : ''} à corriger avant Google` : 'Tout est conforme'),
    list.map((c) => h('div', { class: 'check' }, h('div', { class: 'ic' }, icon[c.level]), h('div', {}, h('b', {}, c.title), h('small', {}, c.detail),
      c.fix ? h('div', { class: 'fix' }, h('button', { class: 'btn small', onclick: () => copy(c.fix, 'Demande pour Claude') }, 'Copier la demande pour Claude')) : null))));
  const next = h('div', { class: 'row' },
    h('button', { class: 'btn primary big', disabled: blocks.length ? true : null, onclick: () => { view.step = 'listing'; render(); scrollTo(0, 0); } }, blocks.length ? 'À corriger d’abord' : 'Continuer'));
  const tip = blocks.length ? h('p', { class: 'muted' }, 'Colle la demande dans ta conversation avec Claude : il corrige et recompile. Ensuite, choisis le nouveau fichier.') : null;
  const again = blocks.length ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: pickApp }, 'Choisir un autre fichier')) : null;
  if (!setupDone()) return [card, h('div', { class: 'card' }, h('p', {}, 'Avant d’envoyer : la préparation du compte n’est pas terminée.'), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go('setup') }, 'Préparer le compte'))), tip, again].filter(Boolean);
  return [card, next, tip, again].filter(Boolean);
}

function vListing(v) {
  const info = v.info, a = v.answers, app = appOf(info.package);
  if (!v.listing) v.listing = app.listing && app.listing.title ? { ...app.listing } : listingFor(info, a);
  const L1 = v.listing;
  const regen = () => { if (!v.edited) { v.listing = listingFor(info, a); v.featC = null; } render(); };
  const yn = (key, q) => h('div', { class: 'q' }, h('b', {}, q), h('div', { class: 'row' },
    h('button', { class: 'btn small' + (a[key] ? '' : ' primary'), onclick: () => { a[key] = false; regen(); } }, 'Non'),
    h('button', { class: 'btn small' + (a[key] ? ' primary' : ''), onclick: () => { a[key] = true; regen(); } }, 'Oui')));
  const field = (key, label, max, multi) => {
    const cnt = h('span', { class: 'count' }, `${(L1[key] || '').length}/${max}`);
    const inp = h(multi ? 'textarea' : 'input', { class: 't', maxlength: max, oninput: (e) => { L1[key] = e.target.value; v.edited = true; if (key === 'shortDescription') v.featC = null; cnt.textContent = `${L1[key].length}/${max}`; } });
    inp.value = L1[key] || '';
    return [h('label', { class: 'f' }, label, cnt), inp];
  };
  const purpose = h('input', { class: 't', placeholder: 'Ex. : Lire et écouter ses livres en français', value: a.purpose || KNOWN[info.package]?.purpose || '', onchange: (e) => { a.purpose = e.target.value; regen(); } });
  const pickIcon = async () => { const r = await Nat.call('pick', ['images']); const f = r.files?.[0]; if (!f) return; const img = await loadImg(f.url); const c = canvas(512, 512); c.getContext('2d').drawImage(img, 0, 0, 512, 512); v.iconC = c; v.featC = null; render(); };
  // images générées
  const imgs = h('div', {});
  (async () => {
    try {
      if (!v.iconC) v.iconC = await makeIcon(info);
      if (!v.featC) v.featC = await makeFeature(info, v.iconC, L1.shortDescription);
      imgs.replaceChildren(h('label', { class: 'f' }, 'Icône (512 × 512) et bannière (1024 × 500) — générées'),
        h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('img', { class: 'icon512', src: v.iconC.toDataURL() }), h('button', { class: 'btn small', onclick: pickIcon }, 'Choisir une autre icône')),
        h('img', { class: 'gfx', style: { marginTop: '10px' }, src: v.featC.toDataURL('image/jpeg', 0.9) }));
    } catch (e) { imgs.textContent = e.message; }
  })();
  const shots = v.shots || (v.shots = app.shotsPaths ? app.shotsPaths.map((p) => ({ path: p, url: 'https://appassets.local/__f?p=' + encodeURIComponent(p) })) : []);
  const addShots = async () => {
    const r = await Nat.call('pick', ['images']);
    for (const f of r.files || []) { try { const c = await fitShot(f.url); const path = window.Pub.writeTemp(`capture-${Date.now()}-${shots.length}.png`, b64of(c)); shots.push({ path, url: c.toDataURL('image/jpeg', 0.7) }); } catch (e) { toast(e.message); } }
    render();
  };
  const policy = policyFor(info, a);
  const known = KNOWN[info.package]?.policy;
  const ok = shots.length >= 2 && L1.title && L1.shortDescription && L1.fullDescription.length >= 10;
  return [
    h('div', { class: 'card' }, h('h2', {}, '3 questions, un clic chacune'),
      h('label', { class: 'f' }, 'En une phrase, à quoi sert l’app ? (facultatif)'), purpose,
      yn('ads', 'L’app affiche-t-elle de la publicité ?'), yn('account', 'Faut-il un compte pour l’utiliser ?'), yn('sends', 'Envoie-t-elle des données personnelles à un serveur ?')),
    h('div', { class: 'card' }, h('h2', {}, 'Textes de la fiche (français, Canada)'), field('title', 'Nom', 30), field('shortDescription', 'Description courte', 80), field('fullDescription', 'Description complète', 4000, true)),
    h('div', { class: 'card' }, imgs),
    h('div', { class: 'card' }, h('h2', {}, `Captures d’écran (${shots.length}/8)`), h('p', {}, 'Google en exige au moins 2. Fais des captures de l’app sur ton téléphone, puis choisis-les : le Publieur les met au bon format.'),
      shots.length ? h('div', { class: 'shots' }, shots.map((s, i) => h('img', { src: s.url, alt: 'Capture ' + (i + 1), onclick: () => { if (confirm('Retirer cette capture ?')) { shots.splice(i, 1); render(); } } }))) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn' + (shots.length < 2 ? ' primary' : ''), onclick: addShots }, shots.length ? 'Ajouter des captures' : 'Choisir les captures'))),
    h('div', { class: 'card' }, h('h2', {}, 'Politique de confidentialité'),
      known ? [h('p', {}, 'Déjà en ligne :'), h('div', { class: 'copyline' }, h('span', {}, known), h('button', { class: 'btn small', onclick: () => copy(known, 'Adresse') }, 'Copier'))]
        : [h('p', {}, 'Rédigée pour toi d’après les permissions de l’app. Google demande une adresse web : demande à Claude de la mettre en ligne (gratuit, une minute).'),
          h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => copy(`Mets en ligne cette politique de confidentialité pour mon application ${info.label} (${info.package}) et donne-moi l'adresse :\n\n${policy}`, 'Demande pour Claude') }, 'Copier la demande pour Claude'),
            h('button', { class: 'btn small', onclick: () => { window.Pub.saveDownload(`confidentialite-${info.package}.md`, 'text/markdown', btoa(unescape(encodeURIComponent(policy)))) ? toast('Enregistrée dans Téléchargements/Publieur') : toast('Impossible d’enregistrer'); } }, 'Enregistrer')),
          h('label', { class: 'f' }, 'Adresse web de la politique (quand tu l’as)'), (() => { const i = h('input', { class: 't', placeholder: 'https://…', onchange: (e) => { app.policyUrl = e.target.value.trim(); save(); } }); i.value = app.policyUrl || ''; return i; })()]),
    h('div', { class: 'card' }, h('h2', {}, 'Ton courriel de contact'), h('p', {}, 'Google l’affiche sur la fiche (obligatoire). Demandé une seule fois.'),
      (() => { const i = h('input', { class: 't', type: 'email', placeholder: 'toi@exemple.com', onchange: (e) => { S.contactEmail = e.target.value.trim(); save(); } }); i.value = S.contactEmail || ''; return i; })()),
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', disabled: ok ? null : true, onclick: () => {
      if (!S.contactEmail) { toast('Ajoute ton courriel de contact'); return; }
      Object.assign(app, { label: info.label, answers: a, listing: L1, shotsPaths: shots.map((s) => s.path) });
      try { app.iconUrl = v.iconC.toDataURL('image/png'); } catch {}
      save(); view.step = app.created ? 'send' : 'create'; render(); scrollTo(0, 0);
    } }, ok ? 'Envoyer à Google' : 'Il manque des captures d’écran')),
  ];
}

function vCreate(v) {
  const info = v.info, app = appOf(info.package);
  const line = (label, val) => h('div', { class: 'copyline' }, h('span', {}, h('small', {}, label), h('br'), val), h('button', { class: 'btn small', onclick: () => copy(val, label) }, 'Copier'));
  const status = h('div', {});
  const verify = async () => {
    status.replaceChildren(h('p', {}, h('span', { class: 'spin' }), ' Vérification auprès de Google…'));
    for (let i = 0; i < 6; i++) {
      try { const e = await G.req('POST', `${info.package}/edits`, {}); await G.req('DELETE', `${info.package}/edits/${e.id}`).catch(() => {}); app.created = true; S.invited = true; save(); view.step = 'send'; render(); return; }
      catch (e) {
        const x = explain(e, { step: 'edit' });
        if (x.go === 'create' && i < 5) { await sleep(5000); continue; } // la Play Console met parfois quelques secondes
        status.replaceChildren(x.go === 'create' ? firstUploadCard(v, verify) : errorCard(x, info)); return;
      }
    }
  };
  return [
    h('div', { class: 'card' }, h('p', {}, 'Google ne permet pas aux outils de créer une nouvelle app : c’est le seul passage à faire toi-même. Ouvre la Play Console, touche « Créer une application », puis remplis avec ceci :'),
      line('Nom de l’application', info.label.slice(0, 30)), line('Langue par défaut', 'Français (Canada) – fr-CA'),
      h('p', {}, 'Choisis ensuite « Application », puis « Gratuite ». Coche les deux déclarations et touche « Créer l’application ».'),
      h('div', { class: 'row' }, h('button', { class: 'btn link', onclick: () => open(L.console) }, 'Ouvrir la Play Console ↗'), h('button', { class: 'btn primary', onclick: verify }, 'C’est fait'))),
    status,
  ];
}

// Plan B : Google n'accepte parfois le tout premier fichier que par la Play Console
function firstUploadCard(v, retry) {
  const info = v.info, ext = /\.apk$/i.test(info.file.name) ? 'apk' : 'aab';
  const fname = `${info.label.replace(/[^\p{L}\p{N}]+/gu, '-')}-${info.versionName || info.versionCode}.${ext}`;
  const step = (t) => h('li', {}, t);
  return h('div', { class: 'card' }, h('h3', {}, 'Le tout premier fichier passe par la Play Console'),
    h('p', {}, 'Si l’app est bien créée, Google veut parfois recevoir son tout premier fichier directement dans la Play Console. C’est la seule fois : ensuite, le Publieur s’occupe de tout.'),
    h('button', { class: 'btn primary', onclick: () => { window.Pub.copyToDownloads && window.Pub.copyToDownloads(info.file.path, fname, 'application/octet-stream') ? toast('Copié dans Téléchargements/Publieur') : toast('Impossible de copier le fichier'); } }, '1. Copier le fichier dans Téléchargements'),
    h('ol', { class: 'olist' },
      step('Dans la Play Console, ouvre ton app.'),
      step('Menu « Tester et publier » → « Tests » → « Tests internes ».'),
      step('Touche « Créer une version », puis « Importer » et choisis ' + fname + ' dans Téléchargements/Publieur.'),
      step('Touche « Suivant » puis « Enregistrer ». Inutile de la publier.')),
    h('div', { class: 'row' }, h('button', { class: 'btn link', onclick: () => open(L.console) }, 'Ouvrir la Play Console ↗'), h('button', { class: 'btn primary', onclick: retry }, 'C’est fait')));
}

function errorCard(x, info) {
  return h('div', { class: 'card', style: { borderColor: 'rgba(255,107,107,.5)' } }, h('h3', {}, '⛔ ' + x.title), h('p', {}, x.detail),
    h('div', { class: 'row' },
      x.url ? h('button', { class: 'btn link small', onclick: () => open(x.url) }, (x.urlLabel || 'Ouvrir') + ' ↗') : null,
      x.copy ? h('button', { class: 'btn small', onclick: () => copy(x.copy, 'Demande pour Claude') }, 'Copier la demande pour Claude') : null,
      x.go === 'setup' ? h('button', { class: 'btn small', onclick: () => go('setup') }, 'Préparation du compte') : null,
      x.go === 'create' && view.name === 'publish' ? h('button', { class: 'btn small', onclick: () => { view.step = 'create'; render(); } }, 'Créer l’app') : null));
}

// Le grand envoi : tout ce que l'API permet, d'un coup
function vSend(v) {
  const info = v.info, app = appOf(info.package);
  const log = h('ul', { class: 'log' }), bar = h('i'), result = h('div', {});
  const card = h('div', { class: 'card' }, h('h2', {}, 'Envoi en cours…'), log, h('div', { class: 'bar' }, bar));
  if (!v.running) { v.running = true; runPublish(v, log, bar, result, card).finally(() => { v.running = false; }); }
  return [card, result];
}
async function runPublish(v, log, bar, result, card) {
  const info = v.info, pkg = info.package, app = appOf(pkg), L1 = app.listing;
  const steps = [];
  const step = (label) => { const li = h('li', {}, h('span', { class: 'spin' }), h('span', {}, label)); log.append(li); steps.push(li); return { text: (t) => { li.lastChild.textContent = t; }, ok: (t) => { li.className = 'ok'; li.firstChild.replaceWith(h('span', {}, '✅')); if (t) li.lastChild.textContent = t; }, err: () => { li.className = 'err'; li.firstChild.replaceWith(h('span', {}, '⛔')); } }; };
  const pct = (p) => { bar.style.width = Math.round(p) + '%'; };
  let editId = null, cur = null;
  const track = S.accountNew !== false && !app.production ? 'alpha' : 'production';
  const trackName = track === 'alpha' ? 'test fermé' : 'production';
  try {
    cur = step('Connexion à Google'); await G.token(); cur.ok(); pct(5);
    cur = step('Ouverture d’une session d’envoi');
    try { editId = (await G.req('POST', `${pkg}/edits`, {})).id; } catch (e) { e.ctxStep = 'edit'; throw e; }
    cur.ok(); pct(10);
    cur = step('Vérification des versions déjà envoyées');
    const tracks = await G.req('GET', `${pkg}/edits/${editId}/tracks`);
    let maxVc = 0; for (const t of tracks.tracks || []) for (const r of t.releases || []) for (const c of r.versionCodes || []) maxVc = Math.max(maxVc, Number(c));
    if (maxVc && info.versionCode <= maxVc) { app.lastVersionCode = maxVc; save(); throw Object.assign(new Error(`Version code ${info.versionCode} has already been used`), { raw: 'already been used' }); }
    if ((tracks.tracks || []).some((t) => t.track === 'production' && (t.releases || []).some((r) => r.status === 'completed'))) app.production = true;
    cur.ok(maxVc ? `Dernière version chez Google : ${maxVc}` : 'Aucune version encore : première publication'); pct(15);
    cur = step(`Envoi du fichier (${fmtSize(info.size)})`);
    const upStep = cur, onProg = (s, t) => { pct(15 + (s / t) * 55); upStep.text(`Envoi du fichier : ${Math.round((s / t) * 100)} % de ${fmtSize(t)}`); };
    const up = info.kind === 'aab'
      ? await G.req('POST', `${pkg}/edits/${editId}/bundles`, undefined, { file: info.file.path, ctype: 'application/octet-stream', onProg })
      : await G.req('POST', `${pkg}/edits/${editId}/apks`, undefined, { file: info.file.path, ctype: 'application/vnd.android.package-archive', onProg });
    cur.ok(`Fichier reçu par Google (version ${up.versionCode || info.versionCode})`); pct(72);
    cur = step('Fiche : nom et descriptions');
    await G.req('PATCH', `${pkg}/edits/${editId}/details`, { defaultLanguage: LANG, contactEmail: S.contactEmail }).catch(() => {}); // langue par défaut et courriel
    await G.req('PUT', `${pkg}/edits/${editId}/listings/${LANG}`, { language: LANG, title: L1.title, shortDescription: L1.shortDescription, fullDescription: L1.fullDescription });
    cur.ok(); pct(78);
    cur = step('Icône, bannière et captures d’écran');
    const iconPath = window.Pub.writeTemp(`icone-${pkg}.png`, b64of(v.iconC || (await makeIcon(info))));
    const featPath = window.Pub.writeTemp(`banniere-${pkg}.jpg`, b64of(v.featC || (await makeFeature(info, v.iconC || (await makeIcon(info)), L1.shortDescription)), 'image/jpeg', 0.92));
    const img = async (type, path, ctype) => G.req('POST', `${pkg}/edits/${editId}/listings/${LANG}/${type}`, undefined, { file: path, ctype });
    for (const type of ['icon', 'featureGraphic', 'phoneScreenshots']) await G.req('DELETE', `${pkg}/edits/${editId}/listings/${LANG}/${type}`).catch(() => {});
    await img('icon', iconPath, 'image/png'); await img('featureGraphic', featPath, 'image/jpeg');
    for (const p of app.shotsPaths || []) await img('phoneScreenshots', p, 'image/png');
    cur.ok(); pct(88);
    cur = step(`Version placée en ${trackName}`);
    const release = (status) => ({ track, releases: [{ name: `${info.versionName || info.versionCode}`, versionCodes: [String(up.versionCode || info.versionCode)], status, releaseNotes: [{ language: LANG, text: app.notes || (app.lastVersionCode ? 'Améliorations et corrections.' : 'Première version.') }] }] });
    let draft = false;
    try { await G.req('PUT', `${pkg}/edits/${editId}/tracks/${track}`, release('completed')); }
    catch (e) { if (/draft/i.test(e.raw || e.message)) { draft = true; await G.req('PUT', `${pkg}/edits/${editId}/tracks/${track}`, release('draft')); } else throw e; }
    cur.ok(draft ? `Version placée en ${trackName} (brouillon : nouvelle app)` : undefined); pct(93);
    cur = step('Validation chez Google');
    let manual = false;
    try { await G.req('POST', `${pkg}/edits/${editId}:commit`); }
    catch (e) { if (/changesNotSentForReview|sent for review automatically|cannot be sent for review/i.test(e.raw || e.message)) { manual = true; await G.req('POST', `${pkg}/edits/${editId}:commit?changesNotSentForReview=true`); } else throw e; }
    editId = null; cur.ok(); pct(100);
    Object.assign(app, { sent: Date.now(), draft, manual, lastVersionCode: Number(up.versionCode || info.versionCode), lastVersionName: info.versionName, track, created: true, permissions: info.permissions });
    save();
    card.firstChild.textContent = 'Envoyé à Google ✅';
    result.replaceChildren(h('div', { class: 'card go' }, h('h2', {}, draft || manual ? 'Presque fini' : 'C’est envoyé'),
      h('p', {}, draft || manual ? 'Google exige encore quelques réponses dans la Play Console (une seule fois). Le Publieur te donne chaque réponse, prête à copier.' : `La version ${info.versionName} est envoyée en ${trackName}. Google l’examine (souvent quelques heures, parfois quelques jours).`),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { hist.length = 0; view = { name: 'home' }; go('app', { pkg }); } }, draft || manual ? 'Voir ce qu’il reste' : 'Voir l’application'))));
  } catch (e) {
    if (cur) cur.err();
    if (editId) G.req('DELETE', `${pkg}/edits/${editId}`).catch(() => {});
    const x = explain(e, { step: e.ctxStep, label: info.label });
    card.firstChild.textContent = 'Envoi arrêté';
    result.replaceChildren(errorCard(x, info), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { view.running = false; render(); } }, 'Réessayer')));
  }
}

// ---------- Fiche d'une application : ce qu'il reste à faire, suivi du test ----------
function todoFor(a) {
  const p = a.permissions || [], ans = a.answers || {}, k = KNOWN[a.pkg] || {};
  const t = [];
  const policy = k.policy || a.policyUrl || '';
  t.push({ id: 'store', title: 'Paramètres de la fiche', where: 'Développer la présence sur le Play Store → Paramètres de la fiche', answers: [['Catégorie', k.category || 'Outils'], ['Courriel', S.contactEmail || '(ton courriel)']] });
  t.push({ id: 'policy', title: 'Politique de confidentialité', where: 'Contenu de l’app → Règles relatives à la confidentialité', answers: [['Adresse', policy || 'Demande à Claude de la mettre en ligne (bouton dans la fiche)']] });
  t.push({ id: 'access', title: 'Accès à l’application', where: 'Contenu de l’app → Accès aux applications', answers: [['Réponse', ans.account ? 'Certaines fonctionnalités sont limitées : fournir un compte de test' : 'Toutes les fonctionnalités sont disponibles sans restriction d’accès']] });
  t.push({ id: 'ads', title: 'Annonces', where: 'Contenu de l’app → Annonces', answers: [['Réponse', ans.ads ? 'Oui, mon application contient des annonces' : 'Non, mon application ne contient pas d’annonces']] });
  t.push({ id: 'rating', title: 'Classification du contenu', where: 'Contenu de l’app → Classification du contenu → Commencer le questionnaire', answers: [['Courriel', S.contactEmail || '(ton courriel)'], ['Catégorie', k.category === 'Livres et références' ? 'Référence, actualités ou éducation' : 'Toutes les autres catégories d’applications'], ['Violence, sexualité, langage, drogues, jeux d’argent', 'Non à chaque question'], ['Échanges entre utilisateurs', 'Non (sauf si l’app permet de discuter ou d’échanger avec des inconnus)'], ['Partage de la position', p.some((x) => /LOCATION/.test(x)) ? 'Oui' : 'Non'], ['Achats numériques', 'Non']] });
  t.push({ id: 'audience', title: 'Public cible', where: 'Contenu de l’app → Public cible et contenu', answers: [['Tranches d’âge', '18 ans et plus (évite les règles strictes pour les enfants)'], ['Attire involontairement les enfants ?', 'Non']] });
  t.push({ id: 'safety', title: 'Sécurité des données', where: 'Contenu de l’app → Sécurité des données', answers: ans.sends ? [['Collecte ou partage de données', 'Oui — indique les types envoyés (Claude peut t’aider à remplir)']] : [['L’application collecte-t-elle ou partage-t-elle des données ?', 'Non'], ['À vérifier', 'Si une fonction envoie quelque chose à un service externe (traduction, IA en ligne, partage de fichier), Google peut le compter comme une collecte. En cas de doute, demande à Claude de remplir ce formulaire avec toi.']] });
  t.push({ id: 'gov', title: 'Applis gouvernementales, finances, santé', where: 'Contenu de l’app', answers: [['Application gouvernementale', 'Non'], ['Fonctionnalités financières', 'Mon application ne propose aucune fonctionnalité financière'], ['Santé', 'Mon application ne propose aucune fonctionnalité de santé']] });
  const fgs = p.filter((x) => /FOREGROUND_SERVICE_/.test(x));
  if (fgs.length) t.push({ id: 'fgs', title: 'Services de premier plan', where: 'Contenu de l’app → Services de premier plan', answers: fgs.map((x) => { const type = x.replace('android.permission.FOREGROUND_SERVICE_', ''); return [type.replace(/_/g, ' ').toLowerCase(), ({ MEDIA_PLAYBACK: 'Lecture audio qui continue quand l’écran est éteint (lecture à voix haute, livres audio), lancée par l’utilisateur.', MICROPHONE: 'Écoute du micro pendant une commande vocale lancée par l’utilisateur.', DATA_SYNC: 'Transfert d’un fichier lancé par l’utilisateur.', LOCATION: 'Suivi de position lancé par l’utilisateur.' })[type] || 'Tâche lancée par l’utilisateur et visible par une notification.']; }) });
  if (p.includes('android.permission.MANAGE_EXTERNAL_STORAGE')) t.push({ id: 'allfiles', title: 'Accès à tous les fichiers', where: 'Contenu de l’app → Autorisations', answers: [['Conseil', 'Google le refuse presque toujours : mieux vaut publier une version sans cette permission.']] });
  if (a.track === 'alpha') {
    t.push({ id: 'testers', title: 'Liste de testeurs (12 personnes ou plus)', where: 'Tester et publier → Tests → Test fermé → Testeurs', answers: [['Créer une liste', 'Ajoute au moins 12 adresses Gmail (14 à 16 c’est plus sûr)'], ['Lien à leur envoyer', L.testing(a.pkg)]], invite: true });
  }
  if (a.draft || a.manual) t.push({ id: 'review', title: 'Envoyer en examen', where: 'Vue d’ensemble de la publication → Envoyer les modifications pour examen', answers: [['Quand', 'Après avoir terminé les étapes ci-dessus']] });
  return t;
}
function vApp(v) {
  const a = S.apps[v.pkg]; if (!a) return [header('Application'), h('p', {}, 'Introuvable.')];
  const out = [header(a.label, a.pkg), h('div', { class: 'card' }, h('div', { class: 'app-head' }, a.iconUrl ? h('img', { src: a.iconUrl, alt: '' }) : h('div', { class: 'ph' }, initials(a.label)),
    h('div', {}, h('h2', {}, a.label), statusChip(a), h('br'), h('small', {}, a.lastVersionName ? `Dernière version envoyée : ${a.lastVersionName} (${a.lastVersionCode})` : 'Pas encore envoyée'))))];
  if (!a.sent) { out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: pickApp }, 'Choisir le fichier à publier'))); return out; }
  const list = todoFor(a), done = list.filter((x) => a.todo[x.id]).length;
  if (!a.live) out.push(h('div', { class: 'card' }, h('h2', {}, `Dans la Play Console : ${done}/${list.length}`), h('p', {}, 'Google réserve ces réponses à la Play Console. Ouvre-la, va à l’endroit indiqué et copie la réponse. Coche quand c’est fait.'),
    h('div', { class: 'row' }, h('button', { class: 'btn link small', onclick: () => open(L.console) }, 'Ouvrir la Play Console ↗')),
    list.map((x) => h('details', { class: 'card', style: { margin: '10px 0', background: 'var(--panel-2)' }, open: !a.todo[x.id] && list.find((y) => !a.todo[y.id]) === x ? true : null },
      h('summary', {}, (a.todo[x.id] ? '✅ ' : '◻️ ') + x.title), h('small', {}, x.where),
      x.answers.map(([q, r]) => h('div', { class: 'copyline' }, h('span', {}, h('small', {}, q), h('br'), r), h('button', { class: 'btn small', onclick: () => copy(r, q) }, 'Copier'))),
      x.invite ? h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => window.Pub.share(inviteText(a)) }, 'Envoyer l’invitation aux testeurs')) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn small' + (a.todo[x.id] ? '' : ' primary'), onclick: () => { a.todo[x.id] = !a.todo[x.id]; save(); render(); } }, a.todo[x.id] ? 'Pas encore fait' : 'C’est fait'))))));
  if (a.track === 'alpha' && !a.live) {
    const d = a.testStart ? testDay(a) : 0;
    out.push(h('div', { class: 'card' }, h('h2', {}, 'Test fermé : 12 testeurs pendant 14 jours'),
      h('p', {}, 'Règle de Google pour les comptes récents : au moins 12 testeurs inscrits sans interruption pendant 14 jours, qui ouvrent vraiment l’app quelques fois par semaine.'),
      a.testStart ? [h('div', { class: 'days' }, Array.from({ length: 14 }, (_, i) => h('i', { class: i < d ? 'on' : '' }))), h('p', {}, d >= 14 ? 'Les 14 jours sont passés : tu peux demander l’accès à la production.' : `Jour ${d} sur 14. Il reste ${14 - d + 1} jour${14 - d + 1 > 1 ? 's' : ''}.`)]
        : h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { a.testStart = Date.now(); save(); render(); } }, 'Les testeurs sont inscrits : démarrer le compte à rebours')),
      d >= 14 ? h('div', { class: 'q' }, h('b', {}, 'Demander l’accès à la production'), h('p', {}, 'Play Console → Tableau de bord → « Demander l’accès à la production ». Réponses suggérées :'),
        [['Comment as-tu recruté tes testeurs ?', 'Des proches et des connaissances qui utilisent Android, invités par courriel.'], ['Comment ont-ils utilisé l’app ?', 'Ils l’ont utilisée plusieurs fois par semaine pendant 14 jours et m’ont fait part de leurs commentaires.'], ['Qu’as-tu amélioré ?', 'J’ai corrigé les problèmes signalés et amélioré la fluidité et la mise en page.'], ['Ton app est-elle prête ?', 'Oui : elle a été testée sur plusieurs téléphones et les problèmes signalés sont corrigés.']]
          .map(([q, r]) => h('div', { class: 'copyline' }, h('span', {}, h('small', {}, q), h('br'), r), h('button', { class: 'btn small', onclick: () => copy(r, 'Réponse') }, 'Copier'))),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { a.production = true; a.track = 'production'; save(); render(); toast('Les prochains envois iront en production'); } }, 'Google a accepté : publier en production'))) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn link small', onclick: () => open(L.help12) }, 'Règle officielle ↗'))));
  }
  out.push(h('div', { class: 'card' }, h('h2', {}, 'Nouvelle version'), h('p', {}, 'Quand Claude a recompilé l’app, choisis le nouveau .aab : tout le reste est déjà prêt.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: pickApp }, 'Publier une mise à jour'), a.live || a.production ? h('button', { class: 'btn link small', onclick: () => open(L.store(a.pkg)) }, 'Voir sur Google Play ↗') : null),
    !a.live ? h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { a.live = true; save(); render(); } }, 'L’app est en ligne sur Google Play')) : null));
  return out;
}
const inviteText = (a) => `Bonjour ! J'aurais besoin de ton aide pour tester mon application « ${a.label} » avant sa sortie sur Google Play (Google exige 14 jours de test).\n\n1. Ouvre ce lien avec ton compte Gmail : ${L.testing(a.pkg)}\n2. Touche « Devenir testeur », puis installe l'app depuis Google Play.\n3. Ouvre-la quelques fois par semaine pendant 2 semaines et garde-la installée.\n\nMerci beaucoup !`;

window.__view = () => view; window.__render = render; // pour les tests automatiques
render();
