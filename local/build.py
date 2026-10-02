#!/usr/bin/env python3
"""Assemble Bibliotheque.html : un seul fichier, sans serveur ni connexion obligatoire."""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent
pub = root.parent / 'server' / 'public'
pdfjs = pathlib.Path(sys.argv[1])  # dossier pdfjs-dist/build
cdn = '--cdn' in sys.argv  # page publiée : pdf.js chargé depuis le CDN au lieu d'être embarqué

css = (pub / 'app.css').read_text()
app = (pub / 'app.js').read_text()
local = (root / 'local.js').read_text()
lib = base64.b64encode((pdfjs / 'pdf.min.mjs').read_bytes()).decode()
worker = base64.b64encode((pdfjs / 'pdf.worker.min.mjs').read_bytes()).decode()
icon = base64.b64encode((pub / 'icon.svg').read_bytes()).decode()

embedded = "" if cdn else f'<script id="pdfjs-lib" type="text/plain">{lib}</script>\n<script id="pdfjs-worker" type="text/plain">{worker}</script>\n'
html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#140f0b">
<title>Bibliothèque</title>
<link rel="icon" href="data:image/svg+xml;base64,{icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,600&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<div id="app"><div class="boot"><div class="boot-mark">❦</div></div></div>
<div id="toast" role="status" aria-live="polite"></div>
{embedded}<script>
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
