#!/usr/bin/env python3
"""Zitat-Anzeigen fuer das zweite Advertorial bauen.

    python3 scripts/bau-zitat-ads.py            # alle
    python3 scripts/bau-zitat-ads.py a2-09      # einzeln

Zwei Schichten, bewusst getrennt:

    Foto      kommt aus scripts/gen-adv2-ads.mjs (Nano Banana, *-basis.jpg)
    Schrift   wird hier gesetzt, nicht generiert

Der Grund fuer die Trennung: ein Zitat muss auf jeder einzelnen Auslieferung
buchstabengleich dastehen. Ein Bildmodell setzt Text jedes Mal etwas anders,
verschluckt Umlaute und bricht an falschen Stellen -- bei einem Satz, der die
ganze Anzeige traegt, ist das kein Restrisiko, sondern der Normalfall.

Ausgabe: assets/ads/adv2/<name>.jpg im Format 4:5 (1080x1350).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/ads/adv2"
FONTS = ROOT / "assets/fonts"          # im Repo, nicht im Scratchpad: sonst
                                       # laeuft das Skript nur auf einem Geraet
B, H = 1080, 1350


# ── Farben aus denselben oklch-Token wie adv/2 und lp2 ─────────────────────
def oklch(L, C, h_deg):
    import math
    h = math.radians(h_deg)
    a, b_ = C * math.cos(h), C * math.sin(h)
    l_, m_, s_ = (L + .3963377774 * a + .2158037573 * b_,
                  L - .1055613458 * a - .0638541728 * b_,
                  L - .0894841775 * a - 1.2914855480 * b_)
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def gam(x):
        x = max(0.0, min(1.0, x))
        return 1.055 * x ** (1 / 2.4) - 0.055 if x > 0.0031308 else 12.92 * x
    return tuple(round(gam(v) * 255) for v in (r, g, bb))


NAVY = oklch(0.38, 0.10, 240)     # --primary
GRAU = oklch(0.52, 0.02, 240)     # --text-muted
BG = (245, 242, 236)              # warmes Off-White wie in den Aktionsmotiven


def franklin(px, wght=400):
    f = ImageFont.truetype(str(FONTS / "LibreFranklin-var.ttf"), px)
    f.set_variation_by_axes([wght])
    return f


def lora(px, wght=400, kursiv=False):
    f = ImageFont.truetype(str(FONTS / "Lora-var.ttf"), px)
    f.set_variation_by_axes([wght])
    return f


def umbrechen(d, text, f, maxbreite):
    """Woerter umbrechen, bis jede Zeile in maxbreite passt."""
    zeilen, zeile = [], ""
    for wort in text.split():
        probe = (zeile + " " + wort).strip()
        if d.textlength(probe, font=f) <= maxbreite or not zeile:
            zeile = probe
        else:
            zeilen.append(zeile)
            zeile = wort
    if zeile:
        zeilen.append(zeile)
    return zeilen


def zuschneiden(pfad, ziel_b, ziel_h, fokus_x=0.5, fokus_y=0.5):
    im = Image.open(ROOT / pfad).convert("RGB")
    soll, ist = ziel_b / ziel_h, im.width / im.height
    if ist > soll:
        nb = int(im.height * soll)
        x = int((im.width - nb) * fokus_x)
        im = im.crop((x, 0, x + nb, im.height))
    else:
        nh = int(im.width / soll)
        y = int((im.height - nh) * fokus_y)
        im = im.crop((0, y, im.width, y + nh))
    return im.resize((ziel_b, ziel_h), Image.LANCZOS)


def bauen(job):
    """Foto ganzflaechig, Zitatflaeche unten, Knopf darunter."""
    im = zuschneiden(job["basis"], B, H,
                     fokus_x=job.get("fokus_x", 0.5),
                     fokus_y=job.get("fokus_y", 0.5)).convert("RGBA")

    f_zitat = lora(job.get("zitat_px", 56), 500)
    f_quelle = franklin(30, 500)
    f_cta = franklin(44, 700)

    mess = ImageDraw.Draw(im)
    innen = B - 2 * 84
    zeilen = umbrechen(mess, job["zitat"], f_zitat, innen)
    zeilenhoehe = round(job.get("zitat_px", 56) * 1.34)

    # Hoehe der Flaeche aus dem Inhalt, nicht geraten: Zitat + Quelle + Knopf.
    knopf_h, luft = 104, 34
    flaeche_h = 56 + len(zeilen) * zeilenhoehe + 26 + 38 + luft + knopf_h + 52
    y0 = H - flaeche_h

    # Weicher Uebergang statt harter Kante: das Foto laeuft in die Flaeche aus,
    # sonst sieht die Anzeige nach Banner aus und nicht nach Beitrag.
    verlauf = Image.new("L", (B, H), 0)
    dv = ImageDraw.Draw(verlauf)
    ueberblend = 150
    for i in range(ueberblend):
        dv.line([(0, y0 - ueberblend + i), (B, y0 - ueberblend + i)],
                fill=int(255 * (i / ueberblend) ** 1.7))
    dv.rectangle([0, y0, B, H], fill=255)
    flaeche = Image.new("RGBA", (B, H), BG + (255,))
    flaeche.putalpha(verlauf)
    im.alpha_composite(flaeche)

    d = ImageDraw.Draw(im)
    y = y0 + 56
    for z in zeilen:
        d.text((84, y), z, font=f_zitat, fill=NAVY)
        y += zeilenhoehe

    y += 26
    d.text((84, y), job["quelle"], font=f_quelle, fill=GRAU)
    y += 38 + luft

    # Knopf: ruhige Flaeche in der Markenfarbe, kein Stoerer, kein Signalrot.
    # Die Marke verbietet Teleshopping-Optik, die Zielgruppe kauft ueber
    # Glaubwuerdigkeit.
    bb = d.textbbox((0, 0), job["cta"], font=f_cta)
    kb = min(B - 2 * 84, (bb[2] - bb[0]) + 2 * 62)
    kx = (B - kb) // 2
    d.rounded_rectangle([kx, y, kx + kb, y + knopf_h], radius=knopf_h // 2, fill=NAVY)
    d.text((kx + (kb - (bb[2] - bb[0])) // 2 - bb[0],
            y + (knopf_h - (bb[3] - bb[1])) // 2 - bb[1]),
           job["cta"], font=f_cta, fill=(255, 255, 255))

    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / (job["name"] + ".jpg")
    im.convert("RGB").save(p, "JPEG", quality=92, subsampling=0, optimize=True)
    print("ok  %-24s %s" % (job["name"], p.relative_to(ROOT)))


JOBS = [
    {
        # Der Satz ist der eigentliche Hook. Er stammt aus der Sprache der
        # Zielgruppe, nicht aus der Marketingsprache: keine Diagnose, keine
        # Schmerzskala, sondern die Angst vor dem Verlust der Selbstaendigkeit.
        "name": "a2-09-zitat-schuhe",
        "basis": "assets/ads/adv2/a2-09-zitat-schuhe-basis.jpg",
        "zitat": "„Ich hab Angst, dass mir irgendwann jemand die Schuhe zubinden muss.“",
        "quelle": "Georg, 63 · Erfahrungsbericht eines Lesers (Symbolbild)",
        "cta": "Jetzt Lesen",
        "zitat_px": 56,
        "fokus_y": 0.5,
    },
    {
        # Gleiche Bauart, zweiter O-Ton aus demselben Brief. Nicht der Schmerz
        # ist die Aussage, sondern was er kostet: die Zusage, die man nicht
        # mehr gibt.
        "name": "a2-10-zitat-zusage",
        "basis": "assets/ads/adv2/a2-10-zitat-zusage-basis.jpg",
        "zitat": "„Ich sage nicht mehr einfach zu. Ich sage: Mal schauen, wie es mir geht.“",
        "quelle": "Georg, 63 · Erfahrungsbericht eines Lesers (Symbolbild)",
        "cta": "Jetzt Lesen",
        "zitat_px": 54,
        "fokus_y": 0.5,
    },
]

only = sys.argv[1:]
for j in JOBS:
    if only and not any(j["name"].startswith(o) for o in only):
        continue
    bauen(j)
