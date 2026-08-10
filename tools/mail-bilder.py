#!/usr/bin/env python3
"""Erzeugt die Bildableitungen fuer die Auswertungsmail unter assets/mail/.

Mailclients laden keine Webfonts und skalieren Bilder schlecht. Deshalb liegt
jedes Motiv in doppelter Anzeigebreite vor und wird im HTML per width-Attribut
auf die halbe Groesse gesetzt. WebP faellt aus, Outlook kennt es nicht.

Aufruf aus dem Repo-Wurzelverzeichnis:  python3 tools/mail-bilder.py
"""
import os
from PIL import Image

ZIEL = "assets/mail"
SURFACE = (255, 253, 251)  # --surface der Seite, als sRGB

os.makedirs(ZIEL, exist_ok=True)


def speichern(im, name, qualitaet=None):
    pfad = os.path.join(ZIEL, name)
    if name.endswith(".png"):
        im.save(pfad, optimize=True)
    else:
        im.convert("RGB").save(pfad, quality=qualitaet, optimize=True, progressive=True)
    print(f"{pfad:34s} {im.size[0]}x{im.size[1]}  {os.path.getsize(pfad) // 1024} KB")


# Logo — Transparenz auf die Flaechenfarbe legen. Ein transparentes Logo
# verschwindet im Dunkelmodus, deshalb steht es im Kopf auf festem Grund.
logo = Image.open("assets/logo_transparent.png").convert("RGBA")
breite = 264  # Anzeige 132 px
logo = logo.resize((breite, round(breite * logo.height / logo.width)), Image.LANCZOS)
grund = Image.new("RGBA", logo.size, SURFACE + (255,))
speichern(Image.alpha_composite(grund, logo).convert("RGB"), "logo-264.png")

# Motiv unter dem Kopf — Mutter mit Kind, traegt den Wellenpuls LWS.
hero = Image.open("assets/rektus/foto-schwangerschaft.jpg")
speichern(hero.crop((0, 60, 1200, 860)), "hero-1200.jpg", 72)

# Anatomie-Illustration zum Selbsttest. Flache Farbflaechen, vertraegt
# staerkere Kompression nicht — Banding im Verlauf.
anat = Image.open("assets/rektus/rektus-anatomie.jpg")
speichern(anat.crop((0, 150, 1024, 770)), "anatomie-1024.jpg", 80)

# Portrait fuer die Unterschrift. Quadratischer Ausschnitt auf das Gesicht;
# der Kreis entsteht im HTML, Outlook zeigt ihn eckig und das ist in Ordnung.
por = Image.open("assets/Portrait_Gruender_Christian_Senfleben.jpg")
mitte_x, mitte_y, seite = 1827, 1379, 2000
por = por.crop((mitte_x - seite // 2, mitte_y - seite // 2,
                mitte_x + seite // 2, mitte_y + seite // 2))
speichern(por.resize((112, 112), Image.LANCZOS), "portrait-112.jpg", 82)
