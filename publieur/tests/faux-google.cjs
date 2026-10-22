'use strict';
// Faux Google Play (API Android Publisher), faux OAuth et faux GitHub : permet de tester tout le parcours du Publieur
// sans compte réel, y compris les refus de Google. Chaque appel est enregistré dans `calls`.

const PKG = 'ca.bibliotheque.app';
const OLD = '2026-10-20T12:00:00Z', NEW = '2026-10-21T23:38:00Z';

const FICHE = {
  category: 'Livres et références',
  purpose: 'Votre bibliothèque personnelle : lisez et écoutez vos livres, en français',
  features: ['Lit les PDF, EPUB, Word, Kindle, BD et livres audio', 'Lecture à voix haute avec voix québécoise'],
  ads: false, account: false, sends: true,
  model: 'premium', price: '4.99',
  premium: { title: 'Bibliothèque Premium', description: 'Le Professeur, les résumés IA et le partage. Paiement unique.' },
  todo: { safety: [['Collecte ou partage de données', 'Oui (réponse propre à l’app)']] },
};

class Faux {
  constructor(opts = {}) {
    this.o = Object.assign({
      exists: false,        // l'app existe-t-elle déjà dans la Play Console ?
      draftApp: true,       // app jamais publiée : Google n'accepte que des versions « brouillon »
      manualReview: true,   // Google ne peut pas envoyer en examen automatiquement
      versionCodes: [],     // versions déjà chez Google
      newVersion: 92,       // version du fichier envoyé
      apiDisabled: false, noAccess: false, validateFails: false, noMerchant: false, wrongKey: false, ghRate: false,
      repoHasApp: true, shots: 3, hasPolicy: true,
    }, opts);
    this.calls = [];
    this.n = 0;
    this.committed = null;
    this.images = { icon: 0, featureGraphic: 0, phoneScreenshots: 0 };
    this.premium = null;
    this.downloads = [];
  }

  log(m, p, extra) { this.calls.push(Object.assign({ m, p }, extra || {})); }
  names() { return this.calls.map((c) => c.p); }
  has(re) { return this.calls.some((c) => re.test(c.m + ' ' + c.p)); }
  idx(re) { return this.calls.findIndex((c) => re.test(c.m + ' ' + c.p)); }

  static res(status, obj) { const body = typeof obj === 'string' ? obj : JSON.stringify(obj); return { status, body, json: obj && typeof obj === 'object' ? obj : null }; }
  static err(status, message, st) { return Faux.res(status, { error: { code: status, message, status: st || 'ERROR' } }); }

  token() {
    if (this.o.wrongKey) return Faux.res(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
    return Faux.res(200, { access_token: 'jeton-test', expires_in: 3600 });
  }

  async http(method, url, headersJson, body, filePath) {
    const u = new URL(url); const headers = headersJson ? JSON.parse(headersJson) : {};
    if (u.host === 'oauth2.googleapis.com') return this.token();
    if (u.host === 'androidpublisher.googleapis.com') return this.google(method, u, headers, body, filePath);
    if (u.host === 'api.github.com' || u.host === 'raw.githubusercontent.com') return this.github(method, u);
    return Faux.err(404, 'hôte inconnu du faux serveur : ' + u.host);
  }

  google(method, u, headers, body, filePath) {
    if (headers.Authorization !== 'Bearer jeton-test') return Faux.err(401, 'Request had invalid authentication credentials.', 'UNAUTHENTICATED');
    const path = u.pathname.replace(/^\/upload/, '').replace('/androidpublisher/v3/applications/', '');
    const key = method + ' ' + path;
    const b = body ? JSON.parse(body) : null;
    this.log(method, path, { search: u.search, filePath: filePath || null, body: b });
    let m;
    if (new RegExp('^POST ' + PKG.replace(/\./g, '\\.') + '/edits$').test(key)) {
      if (this.o.apiDisabled) return Faux.err(403, 'Google Play Android Developer API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=123 then retry.', 'PERMISSION_DENIED');
      if (this.o.noAccess) return Faux.err(403, 'The caller does not have permission', 'PERMISSION_DENIED');
      if (!this.o.exists) return Faux.err(404, 'Package not found: ' + PKG, 'NOT_FOUND');
      return Faux.res(200, { id: 'edit' + ++this.n });
    }
    if ((m = key.match(/^DELETE [^/]+\/edits\/(\w+)$/))) return Faux.res(200, {});
    if (/^GET [^/]+\/edits\/\w+\/tracks$/.test(key)) return Faux.res(200, this.o.versionCodes.length ? { tracks: [{ track: 'alpha', releases: [{ versionCodes: this.o.versionCodes.map(String), status: 'completed' }] }] } : {});
    if (/^POST [^/]+\/edits\/\w+\/bundles$/.test(key)) {
      if (!filePath) return Faux.err(400, 'Pas de fichier envoyé');
      if (this.o.versionCodes.includes(this.o.newVersion)) return Faux.err(403, 'APK specifies a version code that has already been used.');
      return Faux.res(200, { versionCode: this.o.newVersion, sha256: 'abc' });
    }
    if (/^PATCH [^/]+\/edits\/\w+\/details$/.test(key)) return Faux.res(200, b);
    if (/^PUT [^/]+\/edits\/\w+\/listings\/fr-CA$/.test(key)) {
      if (!b.title || b.title.length > 30 || !b.shortDescription || b.shortDescription.length > 80 || !b.fullDescription) return Faux.err(400, 'Fiche invalide');
      this.listing = b; return Faux.res(200, b);
    }
    if ((m = key.match(/^DELETE [^/]+\/edits\/\w+\/listings\/fr-CA\/(\w+)$/))) { this.images[m[1]] = 0; return Faux.res(200, {}); }
    if ((m = key.match(/^POST [^/]+\/edits\/\w+\/listings\/fr-CA\/(\w+)$/))) {
      if (!filePath) return Faux.err(400, 'Pas d’image envoyée');
      this.images[m[1]]++; return Faux.res(200, { image: { id: 'img' + this.images[m[1]] } });
    }
    if ((m = key.match(/^PUT [^/]+\/edits\/\w+\/tracks\/(\w+)$/))) {
      const r = b.releases && b.releases[0];
      if (!r || !r.versionCodes || !r.versionCodes.length) return Faux.err(400, 'Version manquante');
      if (this.o.draftApp && r.status === 'completed') return Faux.err(400, 'Only releases with status draft may be created on draft app.');
      this.release = { track: m[1], ...r }; return Faux.res(200, b);
    }
    if (/^POST [^/]+\/edits\/\w+:validate$/.test(key)) return this.o.validateFails ? Faux.err(400, 'Apps must have a data safety declaration before they can be validated.') : Faux.res(200, { id: 'edit' });
    if (/^POST [^/]+\/edits\/\w+:commit$/.test(key)) {
      if (this.o.manualReview && u.searchParams.get('changesNotSentForReview') !== 'true') return Faux.err(400, 'Changes cannot be sent for review automatically. Please set the query parameter changesNotSentForReview to true.');
      this.committed = { release: this.release, listing: this.listing, images: { ...this.images } };
      return Faux.res(200, { id: 'edit' });
    }
    if (/^POST [^/]+\/pricing:convertRegionPrices$/.test(key)) {
      const cad = b.price;
      return Faux.res(200, {
        convertedRegionPrices: { CA: { regionCode: 'CA', price: cad }, US: { regionCode: 'US', price: { currencyCode: 'USD', units: '3', nanos: 590000000 } }, FR: { regionCode: 'FR', price: { currencyCode: 'EUR', units: '3', nanos: 290000000 } } },
        convertedOtherRegionsPrice: { usdPrice: { currencyCode: 'USD', units: '3', nanos: 590000000 }, eurPrice: { currencyCode: 'EUR', units: '3', nanos: 290000000 } },
        regionVersion: { version: '2022/02' },
      });
    }
    if (/^PATCH [^/]+\/onetimeproducts\/premium$/.test(key)) {
      if (this.o.noMerchant) return Faux.err(400, 'This application cannot be monetized: a merchant (payments profile) is required.');
      const po = b.purchaseOptions && b.purchaseOptions[0];
      if (!po || !po.regionalPricingAndAvailabilityConfigs.length || b.productId !== 'premium') return Faux.err(400, 'Produit invalide');
      this.premium = { body: b, search: u.search }; return Faux.res(200, b);
    }
    if (/^POST [^/]+\/oneTimeProducts\/premium\/purchaseOptions:batchUpdateStates$/.test(key)) { if (this.premium) this.premium.active = true; return Faux.res(200, {}); }
    return Faux.err(404, 'Méthode inconnue du faux serveur : ' + key);
  }

  github(method, u) {
    this.log(method, u.host + u.pathname, {});
    if (this.o.ghRate) return Faux.res(403, { message: 'API rate limit exceeded' });
    const p = u.pathname; let m;
    if (u.host === 'api.github.com') {
      if (/^\/repos\/[^/]+\/[^/]+$/.test(p)) return Faux.res(200, { default_branch: 'main' });
      if ((m = p.match(/^\/repos\/([^/]+\/[^/]+)\/releases$/))) {
        if (m[1] === 'inconnu/depot') return Faux.res(404, { message: 'Not Found' });
        const asset = (tag, name, size, d) => ({ name, size, updated_at: d, browser_download_url: `https://github.com/${m[1]}/releases/download/${tag}/${name}` });
        return Faux.res(200, [
        // GitHub range les versions par date de création de l'étiquette, pas par date de publication : l'ordre réel peut être trompeur
          { tag_name: 'apk-100', name: 'Bibliothèque — APK 100', published_at: OLD, assets: [asset('apk-100', 'Bibliotheque.apk', 8900000, OLD), asset('apk-100', 'Bibliotheque.aab', 9400000, OLD)] },
          { tag_name: 'publieur-3', name: 'Publieur — APK 3', published_at: NEW, assets: [asset('publieur-3', 'Publieur.apk', 50069, NEW)] },
          { tag_name: 'apk-101', name: 'Bibliothèque — APK 101', published_at: NEW, assets: [asset('apk-101', 'Bibliotheque.apk', 9000000, NEW), asset('apk-101', 'Bibliotheque.aab', 9451645, NEW)] },
          { tag_name: 'apk-102', name: 'Bibliothèque — APK 102', published_at: '2026-10-22T08:00:00Z', prerelease: true, assets: [asset('apk-102', 'Bibliotheque.apk', 9000000, NEW), asset('apk-102', 'Bibliotheque.aab', 9451645, NEW)] },
        ]);
      }
      if ((m = p.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/docs\/play\/([^/]+)\/captures$/))) {
        if (!this.o.repoHasApp || m[2] !== PKG) return Faux.res(404, { message: 'Not Found' });
        return Faux.res(200, Array.from({ length: this.o.shots }, (_, i) => ({ type: 'file', name: `0${i + 1}.png`, download_url: `https://raw.githubusercontent.com/${m[1]}/main/docs/play/${m[2]}/captures/0${i + 1}.png` })).concat([{ type: 'file', name: 'LISEZMOI.txt', download_url: 'x' }]));
      }
    }
    if (u.host === 'raw.githubusercontent.com') {
      if (!this.o.repoHasApp) return Faux.res(404, '404: Not Found');
      if (p.endsWith('/docs/play/' + PKG + '/fiche.json')) return Faux.res(200, JSON.stringify(FICHE));
      if (p.endsWith('/docs/confidentialite/' + PKG + '.md')) return this.o.hasPolicy ? Faux.res(200, '# Politique de confidentialité') : Faux.res(404, '404: Not Found');
    }
    return Faux.res(404, '404: Not Found');
  }
}

module.exports = { Faux, PKG, FICHE };
