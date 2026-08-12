#!/usr/bin/env python3
"""Anzeigenmotive fuer die Rabattaktion aus echten Produktaufnahmen bauen.

    python3 scripts/bau-aktion-ads.py

Bewusst kein Bildmodell: Nano Banana hat den Guertel in der ersten Runde nur
annaehernd getroffen und in einem Motiv ueber der Kleidung getragen. Bei einem
Produkt, das die Zielgruppe aus frueheren Anzeigen schon kennt, ist eine
ungenaue Darstellung teurer als ein weniger ueberraschendes Bild.

Quellen, alle echt:
    assets/PackShot_01.png                              freigestellt, Alpha sauber
    assets/bundle_image.png                             Komplettpaket
    assets/Frau_50_WellenpulsLWS_Lifestyle_Rueckansicht Anwendung am unteren Ruecken

NICHT verwendet: assets/Anwendung-wellenpuls.jpg zeigt ein anderes Geraet
(sichtbare Elektrodenpads aussen, abweichende Bedieneinheit).

Ausgabe: assets/ads/aktion/*.jpg im Format 4:5 (1080x1350).
"""
import unicodedata
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/ads/aktion"
FONTS = Path("/tmp/claude-0/-root-projects-stabil-im-alltag/"
             "f9460ef2-a70e-4af8-ad16-5306a73299ae/scratchpad")
B, H = 1080, 1350

# ── Farben aus denselben oklch-Token wie die Landingpage ────────────────────
# Eine Quelle fuer Seite und Anzeige: sonst driften Blau und Grau auseinander,
# und der Wechsel von der Anzeige auf die Seite fuehlt sich nach zwei Marken an.
def oklch(L, C, h_deg):
    import math
    h = math.radians(h_deg)
    a, b_ = C * math.cos(h), C * math.sin(h)
    l_, m_, s_ = L + .3963377774*a + .2158037573*b_, \
                 L - .1055613458*a - .0638541728*b_, \
                 L - .0894841775*a - 1.2914855480*b_
    l, m, s = l_**3, m_**3, s_**3
    r = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bb = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    def gam(x):
        x = max(0.0, min(1.0, x))
        return 1.055*x**(1/2.4) - 0.055 if x > 0.0031308 else 12.92*x
    return tuple(round(gam(v) * 255) for v in (r, g, bb))

NAVY   = oklch(0.38, 0.10, 240)   # --primary
NAVY_D = oklch(0.30, 0.10, 240)   # --primary-dark
GRAU   = oklch(0.52, 0.02, 240)   # --text-muted
BG     = (245, 242, 236)          # warmes Off-White, waermer als --bg der Seite

def font(px, wght=400):
    f = ImageFont.truetype(str(FONTS / "LibreFranklin-var.ttf"), px)
    f.set_variation_by_axes([wght])
    return f

def mitte(d, y, text, f, farbe, durchstreichen=False):
    """Zeichnet zentriert und gibt die Unterkante zurueck."""
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    x = (B - (r - l)) // 2 - l
    d.text((x, y - t), text, font=f, fill=farbe)
    if durchstreichen:
        hoehe = b - t
        yy = y + hoehe * 0.42
        d.line([(x + l - 12, yy), (x + r + 12, yy)], fill=farbe, width=max(3, hoehe // 22))
    return y + (b - t)

def schatten(basis, obj, xy, unschaerfe=38, deckung=110, versatz=(14, 26)):
    """Weicher Schlagschatten aus dem Alphakanal des Objekts."""
    s = Image.new("RGBA", basis.size, (0, 0, 0, 0))
    maske = obj.getchannel("A").point(lambda v: int(v * deckung / 255))
    schwarz = Image.new("RGBA", obj.size, (30, 35, 45, 255))
    schwarz.putalpha(maske)
    s.paste(schwarz, (xy[0] + versatz[0], xy[1] + versatz[1]), schwarz)
    s = s.filter(ImageFilter.GaussianBlur(unschaerfe))
    basis.alpha_composite(s)

def leinwand():
    im = Image.new("RGBA", (B, H), BG + (255,))
    # Sehr flacher Lichtverlauf von oben links, damit die Flaeche nicht tot wirkt.
    v = Image.new("L", (B, H))
    dv = ImageDraw.Draw(v)
    for i in range(H):
        dv.line([(0, i), (B, i)], fill=int(16 * (1 - i / H)))
    im.alpha_composite(Image.merge("RGBA", (
        Image.new("L", (B, H), 255), Image.new("L", (B, H), 255),
        Image.new("L", (B, H), 255), v)))
    return im

def zuschneiden(pfad, ziel_b, ziel_h, fokus_x=0.5, fokus_y=0.5):
    """Auf Zielverhaeltnis beschneiden, Bildmitte frei waehlbar."""
    im = Image.open(ROOT / pfad).convert("RGB")
    soll = ziel_b / ziel_h
    ist = im.width / im.height
    if ist > soll:
        nb = int(im.height * soll)
        x = int((im.width - nb) * fokus_x)
        im = im.crop((x, 0, x + nb, im.height))
    else:
        nh = int(im.width / soll)
        y = int((im.height - nh) * fokus_y)
        im = im.crop((0, y, im.width, y + nh))
    return im.resize((ziel_b, ziel_h), Image.LANCZOS)

def platziere(basis, pfad, breite, mitte_y, mit_schatten=True):
    obj = Image.open(ROOT / pfad).convert("RGBA")
    obj = obj.crop(obj.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    h = round(obj.height * breite / obj.width)
    obj = obj.resize((breite, h), Image.LANCZOS)
    xy = ((B - breite) // 2, mitte_y - h // 2)
    if mit_schatten:
        schatten(basis, obj, xy)
    basis.alpha_composite(obj, xy)
    return xy[1] + h

def sichern(im, name):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / (name + ".jpg")
    im.convert("RGB").save(p, "JPEG", quality=92, subsampling=0, optimize=True)
    print("ok  %-30s %s" % (name, p.relative_to(ROOT)))

# ── akt-01  Packshot mit Rabattzeile ───────────────────────────────────────
im = leinwand()
platziere(im, "assets/PackShot_01.png", 760, 520)
d = ImageDraw.Draw(im)
u = mitte(d, 940, "100 € günstiger", font(112, 800), NAVY)
mitte(d, u + 46, "Nur für kurze Zeit", font(46, 400), GRAU)
sichern(im, "akt-01-packshot-rabatt")

# ── akt-02  Anwendung, echtes Foto, mit Rabattplakette ─────────────────────
# Der Guertel sitzt am unteren Ruecken unter der Bluse. Genau die Darstellung,
# die im generierten Motiv falsch war.
#
# Die Plakette ist noetig, weil der Primary Text im Instagram-Feed abgeschnitten
# wird — dort traegt das Bild die Aussage allein. Bewusst eine ruhige Flaeche in
# der Markenfarbe statt Stoerer, Sterne oder Signalrot: die Marke verbietet
# Teleshopping-Optik, und die Zielgruppe kauft ueber Glaubwuerdigkeit.
foto = zuschneiden("assets/Frau_50_WellenpulsLWS_Lifestyle_Rückansicht.png",
                   B, H, fokus_x=0.30).convert("RGBA")

f_gross, f_klein = font(58, 800), font(34, 500)
z1, z2 = "100 € günstiger", "nur bis 16. August"
d = ImageDraw.Draw(foto)
b1 = d.textbbox((0, 0), z1, font=f_gross)
b2 = d.textbbox((0, 0), z2, font=f_klein)
pad_x, pad_y, luft = 44, 34, 14
pb = max(b1[2] - b1[0], b2[2] - b2[0]) + 2 * pad_x
ph = (b1[3] - b1[1]) + luft + (b2[3] - b2[1]) + 2 * pad_y
px, py = 56, H - ph - 56

plakette = Image.new("RGBA", (pb, ph), (0, 0, 0, 0))
ImageDraw.Draw(plakette).rounded_rectangle([0, 0, pb - 1, ph - 1], radius=18,
                                           fill=NAVY + (242,))
schatten(foto, plakette, (px, py), unschaerfe=26, deckung=90, versatz=(0, 10))
foto.alpha_composite(plakette, (px, py))

d = ImageDraw.Draw(foto)
d.text((px + pad_x - b1[0], py + pad_y - b1[1]), z1, font=f_gross, fill=(255, 255, 255))
d.text((px + pad_x - b2[0], py + pad_y + (b1[3] - b1[1]) + luft - b2[1]), z2,
       font=f_klein, fill=(255, 255, 255, 225))
sichern(foto, "akt-02-anwendung-ruecken")

# ── akt-03  Komplettpaket ──────────────────────────────────────────────────
im = leinwand()
unten = platziere(im, "assets/bundle_image.png", 1000, 520, mit_schatten=False)
d = ImageDraw.Draw(im)
u = mitte(d, 1020, "389 € statt 489 €", font(88, 800), NAVY)
mitte(d, u + 40, "Komplettpaket · bis 16. August", font(42, 400), GRAU)
sichern(im, "akt-03-paket-komplett")

# ── akt-04  Preis, redaktionell ────────────────────────────────────────────
im = leinwand()
d = ImageDraw.Draw(im)
u = mitte(d, 250, "489 €", font(96, 600), GRAU, durchstreichen=True)
u = mitte(d, u + 30, "389 €", font(200, 800), NAVY)
mitte(d, u + 44, "Komplettpaket, einmalig", font(44, 400), GRAU)
platziere(im, "assets/PackShot_01.png", 620, 1030)
sichern(im, "akt-04-preis-editorial")
