import hashlib, json, os, sys

SRC = sys.argv[1]
OUT = sys.argv[2]
SITE = os.path.dirname(os.path.abspath(OUT))
GAME = """water thought through though enough work walk bird world word heard early father mother brother three think thing nothing
month weather clothes usually measure television young yes yellow juice judge joke jacket ship sheep cheap chip cat cut cup hat heart
hot home phone know now house mouth eye buy boy enjoy here there hair near sure door four saw law low good food book foot full pull put
but love money country women busy people banana computer teacher doctor problem about again often listen island comfortable vegetable
wednesday chocolate interesting beautiful language question answer quiet quite very visit video voice zoo easy music sing finger long
english hello hungry hour honest half calm castle knife write wrong little milk colour minute birthday thursday breakfast garage
famous cousin journey learn heavy ready sugar machine nature picture future century thirty theatre leather healthy""".split()

dict_raw = open(os.path.join(SRC, "..", "data", "dict.txt"), encoding="utf-8").read()
words = {line.split("|", 1)[0] for line in dict_raw.split("\n")}
game = [w for w in dict.fromkeys(GAME) if w in words]
missing = [w for w in GAME if w not in words]

page = open(os.path.join(SRC, "template.html"), encoding="utf-8").read()
page = page.replace("__PHONEMES__", json.dumps(json.load(open(os.path.join(SRC, "phonemes.json"))), ensure_ascii=False))
for key in ("pairs", "l1", "strings", "resources"):
    data = json.load(open(os.path.join(SRC, key + ".json"), encoding="utf-8"))
    page = page.replace("__" + key.upper() + "__", json.dumps(data, ensure_ascii=False))
leftover = [m for m in ("__PHONEMES__", "__PAIRS__", "__L1__", "__STRINGS__", "__RESOURCES__") if m in page]
assert not leftover, leftover
page = page.replace("__GAMEWORDS__", json.dumps(game))
page = page.replace("__DICT__", json.dumps(dict_raw, ensure_ascii=False))
open(OUT, "w", encoding="utf-8").write(page)

HEAD = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Los 44 sonidos del inglés británico, explicados para hispanohablantes.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="theme-color" content="#F1F3F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1117" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Schwa">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>"""
TAIL = """<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>
</body></html>"""
open(os.path.join(SITE, "index.html"), "w", encoding="utf-8").write(HEAD + page + TAIL)

manifest = {
    "name": "Schwa",
    "short_name": "Schwa",
    "description": "Los 44 sonidos del inglés británico, explicados para hispanohablantes.",
    "lang": "es",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#F1F3F6",
    "theme_color": "#F1F3F6",
    "categories": ["education"],
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
open(os.path.join(SITE, "manifest.webmanifest"), "w", encoding="utf-8").write(json.dumps(manifest, ensure_ascii=False, indent=2))

assets = ["./", "index.html", "manifest.webmanifest"]
assets += ["icons/" + f for f in sorted(os.listdir(os.path.join(SITE, "icons"))) if f.endswith(".png")]
assets += ["audio/" + f for f in sorted(os.listdir(os.path.join(SITE, "audio"))) if f.endswith(".mp3")]
digest = hashlib.sha256()
for a in assets[1:]:
    digest.update(open(os.path.join(SITE, a), "rb").read())
sw = open(os.path.join(SRC, "sw.js"), encoding="utf-8").read()
sw = sw.replace("__VERSION__", digest.hexdigest()[:12]).replace("__ASSETS__", json.dumps(assets))
open(os.path.join(SITE, "sw.js"), "w", encoding="utf-8").write(sw)

print("game words:", len(game), "missing:", missing, "page:", os.path.getsize(OUT), "precache:", len(assets))
