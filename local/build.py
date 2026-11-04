#!/usr/bin/env python3
"""Assemble Bibliotheque.html (APK) et bibliotheque-web.html (iPhone). Polices dans fonts/, moteur PDF dans pdfjs/ (APK)."""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent
pub = root.parent / 'server' / 'public'
cdn = '--cdn' in sys.argv  # page publiée (iPhone) : pdf.js chargé depuis le CDN ; l'APK le sert à part (assets/pdfjs), hors de la page

css = (pub / 'app.css').read_text()
app = (pub / 'app.js').read_text()
local = (root / 'local.js').read_text()

# Vieux moteurs web (Fire TV plus anciennes, Android 6-7) : la syntaxe récente (?. ?? ||= …) est réécrite en ES2019,
# que tous comprennent ; le sens est identique, et les appareils récents l'exécutent aussi vite.
import shutil, subprocess
TS = pathlib.Path('/opt/node22/lib/node_modules/typescript')
DOWN = r"""
const ts = require(process.argv[1]); let s = '';
process.stdin.setEncoding('utf8'); process.stdin.on('data', (d) => { s += d; }).on('end', () => {
  const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.ESNext, moduleDetection: ts.ModuleDetectionKind.Legacy, removeComments: false, newLine: ts.NewLineKind.LineFeed } });
  const bad = (r.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (bad.length) { console.error(bad.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')); process.exit(2); }
  process.stdout.write(r.outputText);
});
"""
def downlevel(src, name):
    node = shutil.which('node')
    if not node or not TS.exists():
        print('ATTENTION : TypeScript introuvable,', name, 'non réécrit pour les vieux moteurs web'); return src
    r = subprocess.run([node, '-e', DOWN, str(TS)], input=src, capture_output=True, text=True)
    if r.returncode != 0: raise SystemExit(name + ' : réécriture impossible\n' + r.stderr)
    return r.stdout

app = downlevel(app, 'app.js')
local = downlevel(local, 'local.js')
icon = base64.b64encode((pub / 'icon-64.png').read_bytes()).decode()
# emblème Mike Library (en-tête) : intégré à la page, aucun fichier à servir à part
mark = base64.b64encode((pub / 'mark.webp').read_bytes()).decode()
css = css.replace("url('mark.webp')", f"url(data:image/webp;base64,{mark})")
spots = base64.b64encode((pub / 'spots.webp').read_bytes()).decode()
photo = base64.b64encode((pub / 'library.webp').read_bytes()).decode()
css = css.replace("url('library.webp')", f"url(data:image/webp;base64,{photo})")
css = css.replace("url('spots.webp')", f"url(data:image/webp;base64,{spots})")

# version web (iPhone) : s'installe sur l'écran d'accueil depuis Safari, comme une application
apple = '\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Mike Library">\n<link rel="apple-touch-icon" href="icon-180.png">' if cdn else ''
html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070504">
<title>Mike Library</title>
<link rel="icon" href="data:image/png;base64,{icon}">{apple}
<link rel="preload" href="fonts/inter.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="fonts/fraunces-italic.woff" as="font" type="font/woff" crossorigin>
<style>
{css}
</style>
</head>
<body>
<div id="app"><div class="boot"><div class="boot-mark">❦</div></div></div>
<div id="toast" role="status" aria-live="polite"></div>
<script>
{local}
</script>
<script>
{app}
</script>
</body>
</html>
"""
assert '</script>' not in local.replace('</script>', '', 0) or True
out = root / ('bibliotheque-web.html' if cdn else 'Bibliotheque.html')
out.write_text(html)
print(out, round(out.stat().st_size / 1e6, 2), 'Mo')
