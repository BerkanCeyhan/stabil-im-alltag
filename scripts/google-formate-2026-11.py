#!/usr/bin/env python3
"""
Quadratische Fassungen der Meta-Motive November 2026 für Google (Demand Gen).

Google verlangt je Anzeige mindestens ein Bild 1:1 oder 1,91:1, das Hochformat 4:5 allein reicht nicht.
Die Motive werden deshalb auf ein Quadrat gesetzt, ohne etwas abzuschneiden:

  rand    Randspalten links und rechts werden fortgesetzt (einfarbige Flächen und waagerechte Bänder)
  weich   Hintergrund ist das unscharfe, leicht abgedunkelte Motiv selbst (Fotos)
  links   nur links auffüllen, Motiv bleibt am rechten Rand (Band in der rechten Ecke bei 18)

Aufruf:  uv run --with pillow python scripts/google-formate-2026-11.py
Ausgabe: assets/ads/2026-11/google/<name>-1x1.jpg, 1200 × 1200
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
QUELLE = ROOT / "assets/ads/2026-11"
ZIEL = QUELLE / "google"
SEITE = 1350  # Arbeitsgröße, danach auf 1200 verkleinert

MOTIVE = {
    "03-gelb": "rand",
    "04-zahl": "rand",
    "05-astronaut": "weich",
    "06-bisher-jetzt": "weich",
    "07-lindert-trainiert": "rand",
    "08-kreise": "rand",
    "09-vier-bilder": "weich",
    "11-story": "weich",
    "13-black-friday": "rand",
    "15-papa-sessel": "weich",
    "16-bf-sofa": "weich",
    "17-bf-schwarz": "rand",
    "18-bf-weihnachten": "links",
    "19-bf-geschenk": "weich",
}


def quadrat(name: str, art: str) -> Image.Image:
    bild = Image.open(QUELLE / f"{name}.jpg").convert("RGB")
    b, h = bild.size
    assert (b, h) == (1080, 1350), (name, bild.size)
    luecke = SEITE - b

    if art == "weich":
        grund = bild.resize((SEITE, round(h * SEITE / b)), Image.LANCZOS)
        oben = (grund.height - SEITE) // 2
        grund = grund.crop((0, oben, SEITE, oben + SEITE)).filter(ImageFilter.GaussianBlur(42))
        grund = ImageEnhance.Brightness(grund).enhance(0.72)
        grund.paste(bild, (luecke // 2, 0))
        return grund

    flaeche = Image.new("RGB", (SEITE, SEITE))
    if art == "links":
        x = luecke
        flaeche.paste(bild.crop((0, 0, 1, h)).resize((luecke, h)), (0, 0))
    else:
        x = luecke // 2
        flaeche.paste(bild.crop((0, 0, 1, h)).resize((x, h)), (0, 0))
        flaeche.paste(bild.crop((b - 1, 0, b, h)).resize((SEITE - x - b, h)), (x + b, 0))
    flaeche.paste(bild, (x, 0))
    return flaeche


ZIEL.mkdir(exist_ok=True)
for name, art in MOTIVE.items():
    aus = ZIEL / f"{name}-1x1.jpg"
    quadrat(name, art).resize((1200, 1200), Image.LANCZOS).save(aus, quality=90, optimize=True)
    print("ok", aus.relative_to(ROOT), f"{aus.stat().st_size // 1024} KB")
