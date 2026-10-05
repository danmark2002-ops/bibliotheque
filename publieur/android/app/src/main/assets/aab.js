// Lecture d'un Android App Bundle (.aab) : le manifeste et les ressources y sont au format protobuf d'aapt2.
// On décode juste ce qu'il faut : nom du paquet, versions, SDK, permissions, nom affiché et icône.
(function () {
  function reader(buf) {
    let p = 0;
    const varint = () => { let r = 0, s = 0, b; do { b = buf[p++]; r += (b & 0x7f) * Math.pow(2, s); s += 7; } while (b & 0x80 && p < buf.length); return r; };
    return {
      fields() { // [{n, wt, v}] où v = nombre ou sous-tableau d'octets
        const out = [];
        while (p < buf.length) {
          const key = varint(), n = Math.floor(key / 8), wt = key & 7;
          if (wt === 0) out.push({ n, wt, v: varint() });
          else if (wt === 2) { const len = varint(); out.push({ n, wt, v: buf.subarray(p, p + len) }); p += len; }
          else if (wt === 5) { out.push({ n, wt, v: buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24) }); p += 4; }
          else if (wt === 1) { p += 8; out.push({ n, wt, v: 0 }); }
          else break; // type inconnu : on s'arrête proprement
        }
        return out;
      },
    };
  }
  const fieldsOf = (b) => reader(b).fields();
  const str = (b) => new TextDecoder().decode(b);

  // Item { ref=1, str=2, raw_str=3, styled_str=4, file=5, id=6, prim=7 }
  function item(b) {
    const o = {};
    for (const f of fieldsOf(b)) {
      if (f.n === 1 && f.wt === 2) { for (const g of fieldsOf(f.v)) { if (g.n === 2 && g.wt === 0) o.refId = g.v; if (g.n === 3 && g.wt === 2) o.ref = str(g.v); } }
      if ((f.n === 2 || f.n === 3) && f.wt === 2) { for (const g of fieldsOf(f.v)) if (g.n === 1 && g.wt === 2) o.str = str(g.v); }
      if (f.n === 5 && f.wt === 2) { for (const g of fieldsOf(f.v)) if (g.n === 1 && g.wt === 2) o.file = str(g.v); }
      if (f.n === 7 && f.wt === 2) { for (const g of fieldsOf(f.v)) if (g.wt === 0 || g.wt === 5) o.prim = g.n === 8 ? !!g.v : g.v; }
    }
    return o;
  }

  // XmlNode { element=1, text=2 } ; XmlElement { name=3, attribute=4, child=5 } ; XmlAttribute { name=2, value=3, compiled_item=6 }
  function node(b) {
    for (const f of fieldsOf(b)) if (f.n === 1 && f.wt === 2) return element(f.v);
    return null;
  }
  function element(b) {
    const el = { name: '', attrs: {}, children: [] };
    for (const f of fieldsOf(b)) {
      if (f.n === 3 && f.wt === 2) el.name = str(f.v);
      else if (f.n === 4 && f.wt === 2) {
        let name = '', value = '', ci = null;
        for (const g of fieldsOf(f.v)) { if (g.n === 2 && g.wt === 2) name = str(g.v); if (g.n === 3 && g.wt === 2) value = str(g.v); if (g.n === 6 && g.wt === 2) ci = item(g.v); }
        if (!value && ci) value = ci.ref ? '@' + ci.ref : ci.str != null ? ci.str : ci.prim != null ? String(ci.prim) : '';
        el.attrs[name] = value;
      } else if (f.n === 5 && f.wt === 2) { const c = node(f.v); if (c) el.children.push(c); }
    }
    return el;
  }

  // ResourceTable { package=2 } ; Package { type=3 } ; Type { name=2, entry=3 } ; Entry { name=2, config_value=6 } ; ConfigValue { value=2 } ; Value { item=4 }
  function resources(b) {
    const map = {}; // 'string/app_name' → [{str|file}]
    for (const f of fieldsOf(b)) if (f.n === 2 && f.wt === 2) {
      for (const t of fieldsOf(f.v)) if (t.n === 3 && t.wt === 2) {
        let tname = ''; const entries = [];
        for (const g of fieldsOf(t.v)) { if (g.n === 2 && g.wt === 2) tname = str(g.v); if (g.n === 3 && g.wt === 2) entries.push(g.v); }
        for (const e of entries) {
          let ename = ''; const vals = [];
          for (const g of fieldsOf(e)) {
            if (g.n === 2 && g.wt === 2) ename = str(g.v);
            if (g.n === 6 && g.wt === 2) for (const cv of fieldsOf(g.v)) if (cv.n === 2 && cv.wt === 2) for (const vv of fieldsOf(cv.v)) if (vv.n === 4 && vv.wt === 2) vals.push(item(vv.v));
          }
          map[tname + '/' + ename] = vals;
        }
      }
    }
    return map;
  }

  function fromB64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  // manifestB64 / resourcesB64 : contenus de base/manifest/AndroidManifest.xml et base/resources.pb
  window.AAB = {
    parse(manifestB64, resourcesB64) {
      const root = node(fromB64(manifestB64));
      if (!root || root.name !== 'manifest') throw new Error('Manifeste illisible');
      const res = resourcesB64 ? resources(fromB64(resourcesB64)) : {};
      const resolve = (v) => {
        if (!v || v[0] !== '@') return v;
        const vals = res[v.slice(1)] || []; const s = vals.find((x) => x.str != null); return s ? s.str : v;
      };
      const out = { package: root.attrs.package, versionCode: Number(root.attrs.versionCode) || 0, versionName: root.attrs.versionName || '', permissions: [], minSdk: 0, targetSdk: 0 };
      const app = root.children.find((c) => c.name === 'application') || { attrs: {}, children: [] };
      for (const c of root.children) {
        if (c.name === 'uses-sdk') { out.minSdk = Number(c.attrs.minSdkVersion) || 0; out.targetSdk = Number(c.attrs.targetSdkVersion) || 0; }
        if (c.name === 'uses-permission' || c.name === 'uses-permission-sdk-23') out.permissions.push(c.attrs.name);
      }
      out.label = resolve(app.attrs.label || '');
      if (out.label && out.label[0] === '@') out.label = '';
      // icône : on prend le PNG de plus haute densité, s'il y en a un (une icône dessinée en XML ne peut pas être lue ici)
      const iconRef = app.attrs.icon || '';
      if (iconRef[0] === '@') {
        const files = (res[iconRef.slice(1)] || []).map((x) => x.file).filter((f) => f && /\.(png|webp)$/i.test(f));
        const rank = (f) => ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi'].findIndex((d) => f.includes(d + '-') || f.includes(d + '/'));
        files.sort((a, b) => (rank(a) < 0 ? 9 : rank(a)) - (rank(b) < 0 ? 9 : rank(b)));
        out.iconFile = files[0] ? 'base/' + files[0] : '';
      }
      return out;
    },
  };
})();
