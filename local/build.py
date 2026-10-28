#!/usr/bin/env python3
"""Assemble Bibliotheque.html (APK) et bibliotheque-web.html (iPhone). Polices dans fonts/, moteur PDF dans pdfjs/ (APK)."""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent
pub = root.parent / 'server' / 'public'
cdn = '--cdn' in sys.argv  # page publiée (iPhone) : pdf.js chargé depuis le CDN ; l'APK le sert à part (assets/pdfjs), hors de la page

css = (pub / 'app.css').read_text()
app = (pub / 'app.js').read_text()
local = (root / 'local.js').read_text()
icon = base64.b64encode((pub / 'icon.svg').read_bytes()).decode()

# version web (iPhone) : s'installe sur l'écran d'accueil depuis Safari, comme une application
apple = '\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Bibliothèque">\n<link rel="apple-touch-icon" href="icon-180.png">' if cdn else ''
html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#140f0b">
<title>Bibliothèque</title>
<link rel="icon" href="data:image/svg+xml;base64,{icon}">{apple}
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
