'use strict';
// Essais du Publieur : l'interface réelle (assets/) est chargée dans Chromium avec un faux pont Android et un faux Google Play / GitHub.
//   NODE_PATH=/opt/npm-tools/node_modules node publieur/tests/essai.cjs [filtre]
// Fixture : un vrai .aab de Bibliothèque réduit à son manifeste et ses ressources (fixture-bibliotheque.json.gz),
// ou FIXTURE=/chemin/vers/un/autre.json (même format : { list, files }).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright');
const { Faux, PKG } = require('./faux-google.cjs');

const ASSETS = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');
const JAVA = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'ca', 'publieur', 'app', 'MainActivity.java');
const fxFile = process.env.FIXTURE || path.join(__dirname, 'fixture-bibliotheque.json.gz');
const FIXTURE = JSON.parse(/\.gz$/.test(fxFile) ? zlib.gunzipSync(fs.readFileSync(fxFile)).toString() : fs.readFileSync(fxFile, 'utf8'));

const KEYJSON = JSON.stringify({ type: 'service_account', client_email: 'publieur@projet-test.iam.gserviceaccount.com', private_key: 'CLE-PRIVEE-SECRETE', token_uri: 'https://oauth2.googleapis.com/token', project_id: 'projet-test' });
const SIGNER = JSON.stringify({ signer: 'CN=Bibliotheque,O=Bibliotheque,C=CA', sha256: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99' });
const ready = (state = {}, vault = true) => ({
  'publieur.v1': JSON.stringify(Object.assign({ devAccount: true, accountNew: true, invited: true, contactEmail: '', repos: ['danmark2002-ops/bibliotheque'], apps: {} }, state)),
  ...(vault ? { __vault: JSON.stringify({ key: KEYJSON }) } : {}),
});

// ----- faux pont Android, injecté avant le code de l'application -----
function installStub(cfg) {
  const fx = cfg.fixture, work = (window.__work = {});
  window.__copied = []; window.__opened = []; window.__downloads = []; window.__keyText = cfg.keyText || ''; window.__signer = cfg.signer; window.__vaultBroken = !!cfg.vaultBroken;
  const host = (fn, args, id) => window.__host(fn, args).then((r) => window.__nat(id, JSON.stringify(r)), (e) => window.__nat(id, JSON.stringify({ error: String((e && e.message) || e) })));
  const vault = () => JSON.parse(localStorage.getItem('__vault') || '{}');
  const png = (w, h, tone) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = `hsl(${tone},50%,40%)`; g.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  if (!localStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(cfg.seed || {})) localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); }
  window.Pub = {
    ok: () => true, version: () => '1.0-test',
    vaultGet: (n) => vault()[n] || '',
    vaultPut: (n, v) => { if (window.__vaultBroken) return false; const o = vault(); if (v) o[n] = v; else delete o[n]; localStorage.setItem('__vault', JSON.stringify(o)); return true; },
    pick: (kind, id) => {
      if (kind === 'images') setTimeout(() => window.__nat(id, JSON.stringify({ files: [0, 1].map((i) => ({ path: '/work/p' + i + '.png', name: 'p' + i + '.png', size: 10, url: png(1080, 2340, 200 + i * 40) })) })), 5);
      else host('pick', [kind], id);
    },
    readText: () => window.__keyText,
    writeTemp: (name, b64) => { const p = '/work/gen/' + name; work[p] = b64.length; return p; },
    exists: (p) => p in work || p === '/work/Bibliotheque.aab',
    zipList: () => JSON.stringify(fx.list),
    zipRead: (p, e) => fx.files[e] || null,
    aabSigner: () => window.__signer,
    apkInfo: () => null,
    token: (k, id) => host('token', [k], id),
    http: (m, u, h, b, f, id) => host('http', [m, u, h, b, f], id),
    download: (u, name, id) => {
      window.__downloads.push(u);
      if (/\.aab$/i.test(name)) { window.__prog && window.__prog(id, 50, 100); host('download', [u, name], id); }
      else setTimeout(() => window.__nat(id, JSON.stringify({ path: '/work/src/' + name, name, size: 1000, url: png(1080, 2160, 90 + window.__downloads.length * 30) })), 5);
    },
    open: (u) => window.__opened.push(u), copy: (t) => window.__copied.push(t), saveDownload: () => true, copyToDownloads: () => true, share: () => {},
  };
}

// ----- outils -----
let browser; const results = [];
async function open(opts = {}) {
  const faux = opts.faux || new Faux(opts.o);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => errs.push(e.message));
  await page.exposeFunction('__host', async (fn, args) => {
    if (fn === 'http') return faux.http(...args);
    if (fn === 'token') return faux.token();
    if (fn === 'download') { faux.downloads.push(args[0]); return { path: '/work/' + args[1], name: args[1], size: 9451645, url: '' }; }
    if (fn === 'pick') return args[0] === 'json' ? { files: [{ path: '/work/cle.json', name: 'cle.json', size: 100, url: '' }] } : { files: [{ path: '/work/Bibliotheque.aab', name: 'Bibliotheque.aab', size: 9451645, url: '' }] };
    throw new Error('appel inconnu : ' + fn);
  });
  await page.addInitScript(installStub, { fixture: FIXTURE, seed: opts.seed || {}, signer: opts.signer === undefined ? SIGNER : opts.signer, keyText: opts.keyText, vaultBroken: opts.vaultBroken });
  await page.goto('file://' + ASSETS + '/index.html');
  await page.waitForSelector('#app *');
  return { page, faux, errs, ctx };
}
const text = (page) => page.locator('#app').innerText();
const html = (page) => page.locator('#app').textContent();
const wait = (page, s, ms = 15000) => page.waitForFunction((t) => document.querySelector('#app').innerText.includes(t), s, { timeout: ms }).catch(async () => { throw new Error(`texte attendu introuvable : « ${s} »\n--- écran ---\n${(await text(page)).slice(0, 700)}`); });
const btn = (page, name) => page.getByRole('button', { name, exact: true });
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const has = (s, t, msg) => ok(s.includes(t), `${msg || 'texte absent'} : « ${t} »\n--- écran ---\n${s.slice(0, 600)}`);
const lacks = (s, t, msg) => ok(!s.includes(t), `${msg || 'texte présent à tort'} : « ${t} »`);
const order = (faux, ...res) => { let last = -1; for (const re of res) { const i = faux.calls.findIndex((c, k) => k > last && re.test(c.m + ' ' + c.p + ' ' + (c.search || ''))); ok(i > last, `appel manquant ou dans le mauvais ordre : ${re}\n${faux.calls.map((c) => c.m + ' ' + c.p).join('\n')}`); last = i; } };
async function T(name, fn) {
  if (process.argv[2] && !name.toLowerCase().includes(process.argv[2].toLowerCase())) return;
  const t0 = Date.now(); let ctxs;
  try { ctxs = await fn(); results.push({ name, pass: true, ms: Date.now() - t0 }); console.log('✅', name, `(${Date.now() - t0} ms)`); }
  catch (e) { results.push({ name, pass: false, err: e.message }); console.log('⛔', name, '\n   ', e.message.replace(/\n/g, '\n    ')); }
}
const noErrs = (o) => eq(o.errs.length, 0, 'erreurs JavaScript dans la page : ' + o.errs.join(' | '));
// Parcours commun : de l'écran de vérification jusqu'au clic « Envoyer à Google »
async function toSend(o) {
  await wait(o.page, 'Tout est conforme');
  await btn(o.page, 'Continuer').click();
  await wait(o.page, 'Textes de la fiche');
  await o.page.locator('input[type=email]').fill('moi@exemple.com'); await o.page.locator('input[type=email]').dispatchEvent('change');
  await btn(o.page, 'Envoyer à Google').click();
}

(async () => {
  browser = await chromium.launch();

  // ===== 1. Le pont : chaque appel de l'interface existe côté Android =====
  await T('Pont : tous les appels JavaScript existent dans MainActivity.java', async () => {
    const js = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8'), java = fs.readFileSync(JAVA, 'utf8');
    const used = new Set([...js.matchAll(/window\.Pub\??\.(\w+)/g)].map((m) => m[1]).concat([...js.matchAll(/Nat\.call\('(\w+)'/g)].map((m) => m[1])));
    const have = new Set([...java.matchAll(/@JavascriptInterface\s+public\s+\w+\s+(\w+)\(/g)].map((m) => m[1]));
    const missing = [...used].filter((n) => !have.has(n));
    eq(missing.join(','), '', 'appels sans méthode Java');
    ok(used.size >= 15, 'trop peu d’appels repérés : ' + used.size);
  });

  // ===== 2. Accueil, version, GitHub =====
  await T('Accueil : version, liste GitHub (.aab seulement, dernière version de chaque app)', async () => {
    const o = await open({ seed: ready() }); await wait(o.page, 'Dernières versions trouvées');
    const t = await text(o.page);
    has(t, 'Publieur 1.0-test', 'version affichée'); has(t, 'Bibliotheque'); has(t, 'Bibliothèque — APK 101', 'dernière version'); lacks(t, 'APK 100'); lacks(t, 'Publieur.apk');
    eq(await o.page.locator('[data-gh]').count(), 1, 'une seule application listée');
    noErrs(o);
  });

  await T('Dépôts : ajout invalide refusé, dépôt introuvable signalé, retrait', async () => {
    const o = await open({ seed: ready() }); await wait(o.page, 'Dernières versions trouvées');
    await o.page.locator('summary').click();
    await o.page.locator('details input').fill('abc'); await btn(o.page, 'Ajouter').click();
    await wait(o.page, 'Dernières versions trouvées'); has(await o.page.locator('#toast').innerText(), 'propriétaire/dépôt');
    await o.page.locator('details input').fill('https://github.com/inconnu/depot/'); await btn(o.page, 'Ajouter').click();
    await wait(o.page, 'Dépôt introuvable ou privé : inconnu/depot');
    await o.page.getByRole('button', { name: 'Retirer', exact: true }).nth(1).click();
    await wait(o.page, 'Dernières versions trouvées');
    noErrs(o);
  });

  await T('GitHub limite les requêtes : message clair, et on peut quand même choisir un fichier', async () => {
    const o = await open({ seed: ready(), o: { ghRate: true } }); await wait(o.page, 'GitHub limite les requêtes');
    await btn(o.page, 'Choisir un fichier').click();
    await wait(o.page, 'Tout est conforme');           // la fiche automatique est facultative : le parcours continue
    await btn(o.page, 'Continuer').click(); await wait(o.page, 'Il manque des captures d’écran');
    has(await text(o.page), 'Rédigée pour toi', 'politique à demander à Claude quand rien n’est trouvé');
    noErrs(o);
  });

  // ===== 3. Parcours complet d'une nouvelle app, depuis GitHub =====
  await T('Nouvelle app depuis GitHub : fiche, politique, captures automatiques ; création ; envoi ; Premium', async () => {
    const o = await open({ seed: ready(), o: { exists: false, draftApp: true, manualReview: true } });
    await wait(o.page, 'Dernières versions trouvées');
    await o.page.locator('[data-gh="Bibliotheque.aab"]').click();
    await wait(o.page, 'Tout est conforme');
    let t = await text(o.page);
    has(t, 'version 10.1 (92)'); has(t, 'Vise Android 16'); has(t, 'empreinte AA:BB:CC:DD');
    await btn(o.page, 'Continuer').click(); await wait(o.page, 'Textes de la fiche');
    t = await text(o.page);
    has(t, 'Trouvée dans ton dépôt GitHub', 'politique détectée'); has(t, 'Captures d’écran (3/8)'); has(t, 'Reprises de ton dépôt GitHub');
    has(await o.page.locator('.choice.on').innerText(), 'Gratuite + Premium', 'modèle Premium repris de la fiche');
    eq(await o.page.locator('input.t').first().inputValue(), 'Votre bibliothèque personnelle : lisez et écoutez vos livres, en français', 'résumé repris de la fiche');
    await o.page.locator('input[type=email]').fill('moi@exemple.com'); await o.page.locator('input[type=email]').dispatchEvent('change');
    await btn(o.page, 'Envoyer à Google').click();
    await wait(o.page, 'Créer l’app sur Google Play'); has(await text(o.page), 'Google ne permet pas aux outils de créer');
    o.faux.o.exists = true;                               // l'utilisateur crée l'app dans la Play Console
    await btn(o.page, 'C’est fait').click();
    await wait(o.page, 'Presque fini', 40000);
    const f = o.faux;
    order(f, /POST \S+\/edits /, /GET \S+\/tracks /, /POST \S+\/bundles /, /PATCH \S+\/details /, /PUT \S+\/listings\/fr-CA /, /DELETE \S+\/icon /, /POST \S+\/listings\/fr-CA\/icon /, /POST \S+\/featureGraphic /, /POST \S+\/phoneScreenshots /,
      /PUT \S+\/tracks\/alpha /, /PUT \S+\/tracks\/alpha /, /:validate /, /:commit \s*$/, /:commit \?changesNotSentForReview=true/, /convertRegionPrices/, /PATCH \S+onetimeproducts\/premium/, /batchUpdateStates/);
    const up = f.calls.find((c) => /bundles$/.test(c.p)); eq(up.filePath, '/work/Bibliotheque.aab', 'le .aab est envoyé en flux depuis le fichier');
    eq(f.committed.images.phoneScreenshots, 3, 'captures envoyées'); eq(f.committed.images.icon, 1, 'icône'); eq(f.committed.images.featureGraphic, 1, 'bannière');
    eq(f.committed.release.track, 'alpha', 'compte récent : test fermé'); eq(f.committed.release.status, 'draft', 'nouvelle app : brouillon');
    eq(f.committed.release.versionCodes[0], '92', 'version envoyée'); eq(f.committed.listing.title, 'Bibliothèque', 'titre');
    ok(f.premium && f.premium.active, 'Premium créé et activé'); eq(f.premium.body.purchaseOptions[0].regionalPricingAndAvailabilityConfigs.length, 3, 'prix par pays');
    has(f.premium.search, 'regionsVersion.version=2022%2F02', 'version des prix');
    eq(await o.page.evaluate(() => window.__downloads.filter((u) => /captures/.test(u)).length), 3, 'captures du dépôt téléchargées');
    // fiche de l'app : Premium, liste « Dans la Play Console » avec réponses propres à l'app et politique du dépôt
    await btn(o.page, 'Voir ce qu’il reste').click(); await wait(o.page, 'Premium est en vente');
    const c = await html(o.page);
    has(c, 'Oui (réponse propre à l’app)', 'réponse propre à l’app'); has(c, 'https://github.com/danmark2002-ops/bibliotheque/blob/main/docs/confidentialite/ca.bibliotheque.app.md', 'adresse de la politique');
    // la clé d'accès n'est jamais dans le stockage de la page
    const ls = await o.page.evaluate(() => localStorage.getItem('publieur.v1'));
    lacks(ls, 'CLE-PRIVEE-SECRETE', 'clé en clair dans le stockage'); has(ls, '"signerSha256":"AA:BB', 'empreinte retenue pour la prochaine version');
    noErrs(o);
  });

  // ===== 4. Mise à jour d'une app déjà en production =====
  await T('Mise à jour (fichier choisi) : production, sans création, une seule confirmation', async () => {
    const state = { apps: { [PKG]: { pkg: PKG, label: 'Bibliothèque', todo: {}, created: true, production: true, track: 'production', lastVersionCode: 90, signerSha256: JSON.parse(SIGNER).sha256, answers: { ads: false, account: false, sends: false, model: 'free' }, listing: { title: 'Bibliothèque', shortDescription: 'Lire ses livres', fullDescription: 'Lire ses livres en français, simplement.' }, shotsPaths: ['/work/gen/a.png', '/work/gen/b.png'] } }, contactEmail: 'moi@exemple.com' };
    const o = await open({ seed: ready(state), o: { exists: true, draftApp: false, manualReview: false, versionCodes: [90], repoHasApp: false } });
    await o.page.evaluate(() => { window.__work['/work/gen/a.png'] = 1; window.__work['/work/gen/b.png'] = 1; });
    await btn(o.page, 'Choisir un fichier').click();
    await wait(o.page, 'Tout est conforme'); has(await text(o.page), 'Plus récente que la dernière envoyée (90)');
    await btn(o.page, 'Continuer').click(); await wait(o.page, 'Textes de la fiche');
    await btn(o.page, 'Envoyer à Google').click();
    await wait(o.page, 'C’est envoyé', 40000);
    const f = o.faux; ok(!f.has(/convertRegionPrices/), 'pas de Premium pour un modèle gratuit'); eq(f.calls.filter((c) => /:commit/.test(c.p)).length, 1, 'une seule confirmation');
    eq(f.committed.release.track, 'production', 'production'); eq(f.committed.release.status, 'completed', 'publiée');
    noErrs(o);
  });

  // ===== 5. Refus de Google : messages en français, session fermée proprement =====
  const created = { apps: { [PKG]: { pkg: PKG, todo: {}, created: true } }, contactEmail: 'moi@exemple.com' };
  const refus = [
    ['numéro de version déjà utilisé', { exists: true, draftApp: false, versionCodes: [92] }, 'Ce numéro de version a déjà été envoyé', true],
    ['validation refusée avant la confirmation', { exists: true, draftApp: false, manualReview: false, validateFails: true }, 'Google a refusé cette étape', true],
    ['accès refusé (clé non invitée)', { exists: true, noAccess: true }, 'n’a pas encore accès à ton compte Google Play', false],
    ['API Google Play non activée', { exists: true, apiDisabled: true }, 'L’API Google Play n’est pas activée', false],
  ];
  for (const [nom, o2, attendu, envoi] of refus) {
    await T('Refus : ' + nom, async () => {
      const o = await open({ seed: ready(envoi ? created : { contactEmail: 'moi@exemple.com' }), o: o2 });
      await btn(o.page, 'Choisir un fichier').click(); await toSend(o);
      if (!envoi) await btn(o.page, 'C’est fait').click();          // l'app n'est pas encore « créée » dans la mémoire du Publieur : il vérifie auprès de Google
      await wait(o.page, attendu, 40000);
      ok(!o.faux.committed, 'rien ne doit être confirmé');
      if (envoi) { has(await text(o.page), 'Envoi arrêté'); ok(o.faux.has(/DELETE \S+\/edits\/edit\d+$/), 'la session d’envoi doit être fermée'); }
      noErrs(o);
    });
  }

  await T('Refus : profil de paiement manquant → l’envoi réussit, Premium reste en attente avec la marche à suivre', async () => {
    const o = await open({ seed: ready(created), o: { exists: true, noMerchant: true } });
    await btn(o.page, 'Choisir un fichier').click(); await toSend(o);
    await wait(o.page, 'Presque fini', 40000);
    await btn(o.page, 'Voir ce qu’il reste').click(); await wait(o.page, 'Premium n’est pas encore en vente');
    has(await text(o.page), 'Profil de paiement requis'); ok(await btn(o.page, 'Créer Premium chez Google').isVisible(), 'bouton pour réessayer');
    o.faux.o.noMerchant = false; await btn(o.page, 'Créer Premium chez Google').click(); await wait(o.page, 'Premium est en vente');
    noErrs(o);
  });

  await T('Application absente de la Play Console : plan B pour le tout premier fichier', async () => {
    const o = await open({ seed: ready({ contactEmail: 'moi@exemple.com' }), o: { exists: false } });
    await btn(o.page, 'Choisir un fichier').click(); await toSend(o);
    await wait(o.page, 'Créer l’app sur Google Play'); await btn(o.page, 'C’est fait').click();
    await wait(o.page, 'Le tout premier fichier passe par la Play Console', 60000);
    ok(await btn(o.page, '1. Copier le fichier dans Téléchargements').isVisible(), 'bouton de copie du .aab');
    noErrs(o);
  });

  // ===== 6. Signature des .aab =====
  await T('Signature : un .aab signé en mode test est refusé', async () => {
    const o = await open({ seed: ready(), signer: JSON.stringify({ signer: 'CN=Android Debug,O=Android,C=US', sha256: 'DE:AD' }) });
    await btn(o.page, 'Choisir un fichier').click(); await wait(o.page, 'Signé en mode test');
    ok(await btn(o.page, 'À corriger d’abord').isDisabled(), 'le bouton doit être bloqué'); noErrs(o);
  });
  await T('Signature : une clé différente de la dernière version est signalée sans bloquer', async () => {
    const o = await open({ seed: ready({ apps: { [PKG]: { pkg: PKG, todo: {}, signerSha256: '11:22:33' } } }) });
    await btn(o.page, 'Choisir un fichier').click(); await wait(o.page, 'La clé de signature a changé');
    ok(await btn(o.page, 'Continuer').isEnabled(), 'avertissement seulement'); noErrs(o);
  });

  // ===== 7. Coffre de la clé d'accès Google =====
  await T('Coffre : une ancienne clé en clair est déplacée dans le coffre au démarrage', async () => {
    const o = await open({ seed: { 'publieur.v1': JSON.stringify({ devAccount: true, accountNew: true, invited: true, key: JSON.parse(KEYJSON) }) } });
    const r = await o.page.evaluate(() => ({ ls: localStorage.getItem('publieur.v1'), v: localStorage.getItem('__vault') }));
    lacks(r.ls, 'CLE-PRIVEE-SECRETE', 'clé encore en clair'); has(r.v, 'CLE-PRIVEE-SECRETE', 'clé dans le coffre');
    await wait(o.page, 'Publier une application'); lacks(await text(o.page), 'Préparer ton compte (une seule fois)', 'le compte reste préparé'); noErrs(o);
  });
  await T('Coffre indisponible : la clé importée n’est jamais enregistrée en clair', async () => {
    const o = await open({ seed: { 'publieur.v1': JSON.stringify({ devAccount: true, accountNew: true }) }, keyText: KEYJSON, vaultBroken: true });
    await btn(o.page, 'Continuer').click(); await btn(o.page, 'Importer le fichier .json').click();
    await wait(o.page, 'Préparer ton compte');
    await o.page.waitForFunction(() => /coffre sécurisé/.test(document.querySelector('#toast').textContent), null, { timeout: 8000 });
    lacks(await o.page.evaluate(() => localStorage.getItem('publieur.v1')), 'CLE-PRIVEE', 'clé en clair'); has(await text(o.page), 'Importer le fichier .json', 'étape 2 non validée'); noErrs(o);
  });
  await T('Coffre : import d’une clé, puis retrait de la clé du téléphone', async () => {
    const o = await open({ seed: { 'publieur.v1': JSON.stringify({ devAccount: true, accountNew: true }) }, keyText: KEYJSON });
    await btn(o.page, 'Continuer').click(); await btn(o.page, 'Importer le fichier .json').click();
    await wait(o.page, 'chiffrée dans le coffre du téléphone'); has(await text(o.page), 'publieur@projet-test.iam.gserviceaccount.com');
    has(await o.page.evaluate(() => localStorage.getItem('__vault')), 'CLE-PRIVEE-SECRETE'); lacks(await o.page.evaluate(() => localStorage.getItem('publieur.v1')), 'CLE-PRIVEE', 'clé en clair');
    await btn(o.page, 'Retirer la clé de ce téléphone').click(); await wait(o.page, 'Importer le fichier .json');
    eq(await o.page.evaluate(() => localStorage.getItem('__vault')), '{}', 'coffre vidé'); noErrs(o);
  });
  await T('Clé refusée par Google : message clair, rien d’enregistré', async () => {
    const o = await open({ seed: { 'publieur.v1': JSON.stringify({ devAccount: true, accountNew: true }) }, keyText: KEYJSON, o: { wrongKey: true } });
    await btn(o.page, 'Continuer').click(); await btn(o.page, 'Importer le fichier .json').click();
    await o.page.waitForFunction(() => /refusée par Google/.test(document.querySelector('#toast').textContent), null, { timeout: 8000 });
    eq(await o.page.evaluate(() => localStorage.getItem('__vault') || '{}'), '{}', 'rien dans le coffre'); noErrs(o);
  });

  // ===== 8. Navigation et captures =====
  await T('Captures choisies à la main : remises au bon format (2:1 au plus) et comptées', async () => {
    const o = await open({ seed: ready({ contactEmail: 'moi@exemple.com' }), o: { repoHasApp: false } });
    await btn(o.page, 'Choisir un fichier').click(); await wait(o.page, 'Tout est conforme'); await btn(o.page, 'Continuer').click();
    await wait(o.page, 'Il manque des captures d’écran'); ok(await btn(o.page, 'Il manque des captures d’écran').isDisabled(), 'envoi bloqué sans captures');
    await btn(o.page, 'Choisir les captures').click(); await wait(o.page, 'Captures d’écran (2/8)'); ok(await btn(o.page, 'Envoyer à Google').isEnabled(), 'envoi permis avec 2 captures');
    noErrs(o);
  });
  await T('Navigation : le geste Retour remonte d’un écran, puis rend la main à Android', async () => {
    const o = await open({ seed: ready(), o: { repoHasApp: false } });
    await btn(o.page, 'Choisir un fichier').click(); await wait(o.page, 'Tout est conforme');
    eq(await o.page.evaluate(() => window.__back()), true, 'retour vers l’accueil'); await wait(o.page, 'Publier une application');
    eq(await o.page.evaluate(() => window.__back()), false, 'à l’accueil : Android ferme l’app'); noErrs(o);
  });

  await browser.close();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} essais réussis`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
