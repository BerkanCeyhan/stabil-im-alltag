#!/usr/bin/env python3
"""
Setzt das echte Logo klein oben rechts in die Statics.

    python3 scripts/ads-logo.py assets/ads/2026-10/v2/roh assets/ads/2026-10/v2

- Motive r-* und e-* (Produkt-Anzeigen) bekommen das Wellenpuls-Logo, Schriftzug weiss, V blau.
- Motive p-* (ohne Produkt, Ziel Advertorial) bekommen das Logo von Stabil im Alltag in Weiss,
  weil das Produkt dort erst im Artikel vorgestellt wird.

Benoetigt: Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)


def white_wellenpuls():
    im = Image.open(ROOT / "assets/logo_wellenpuls.png").convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if b > r + 40:  # das blaue V bleibt, etwas heller
                px[x, y] = (min(255, r + 40), min(255, g + 40), 255, a)
            else:  # Schriftzug weiss
                px[x, y] = (255, 255, 255, a)
    return im


def white_all(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (255, 255, 255, a)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


LOGO_WP = white_wellenpuls()
LOGO_SIA = white_all(ROOT / "assets/logo_transparent.png")

for f in sorted(src.glob("*.jpg")):
    im = Image.open(f).convert("RGB")
    w, h = im.size
    if f.name.startswith("p-"):
        logo, rel_w = LOGO_SIA, 0.12
    else:
        logo, rel_w = LOGO_WP, 0.22
    lw = int(w * rel_w)
    lh = int(logo.height * lw / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS)
    margin_x, margin_y = int(w * 0.05), int(h * 0.04)
    im.paste(lg, (w - lw - margin_x, margin_y), lg)
    out = dst / f.name
    im.save(out, quality=90)
    print("ok", out)
