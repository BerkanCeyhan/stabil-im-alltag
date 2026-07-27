#!/usr/bin/env python3
"""
Hintergrund von einem generierten Produktbild entfernen, ohne Kanten abzuschneiden.

    python3 scripts/remove-bg.py in.png out.png [--tol 26] [--feather 1.2] [--keep-shadow]

Funktioniert nur zuverlaessig, wenn das Bild schon mit einem *einfarbigen,
randlosen* Hintergrund erzeugt wurde. Siehe docs/SOP-nano-banana.md, Abschnitt
"Freisteller". Nano Banana kann keine Transparenz erzeugen, deshalb:
Bild auf reinem #FFFFFF (oder Chromakey) generieren lassen und hier keyen.

Warum Flood-Fill statt globalem Farb-Key:
Ein globaler Key auf Weiss loescht auch weisse Flaechen *im* Produkt (Labels,
Highlights, Papier). Hier wird stattdessen von allen vier Bildraendern aus
geflutet. Nur zusammenhaengender Hintergrund wird transparent, alles was vom
Produkt eingeschlossen ist bleibt erhalten.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def parse_args(argv):
    if len(argv) < 3:
        print(__doc__)
        sys.exit(1)
    opts = {"tol": 26.0, "feather": 1.2, "keep_shadow": False}
    rest = argv[3:]
    i = 0
    while i < len(rest):
        a = rest[i]
        if a == "--tol":
            opts["tol"] = float(rest[i + 1]); i += 2
        elif a == "--feather":
            opts["feather"] = float(rest[i + 1]); i += 2
        elif a == "--keep-shadow":
            opts["keep_shadow"] = True; i += 1
        else:
            print(f"unbekannte Option: {a}"); sys.exit(1)
    return argv[1], argv[2], opts


def flood_background(rgb, tol):
    """Maske aller Pixel, die vom Bildrand aus in Hintergrundfarbe erreichbar sind."""
    h, w, _ = rgb.shape
    arr = rgb.astype(np.int16)

    # Referenzfarbe: Median der vier Ecken (robust gegen einzelne Ausreisser).
    corners = np.array([arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]])
    ref = np.median(corners, axis=0)

    # Kandidaten: alles, was der Hintergrundfarbe nahe genug ist.
    dist = np.sqrt(((arr - ref) ** 2).sum(axis=2))
    close = dist <= tol

    # Von allen Randpixeln aus fluten (BFS ueber die close-Maske).
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen, dist


def main():
    src, dst, opts = parse_args(sys.argv)
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im)
    bg, dist = flood_background(rgb, opts["tol"])

    if bg.mean() < 0.02:
        print("Warnung: fast kein Hintergrund gefunden. Ist der Hintergrund wirklich einfarbig?")

    alpha = np.where(bg, 0.0, 255.0)

    # Weicher Uebergang an der Kante: Pixel knapp ausserhalb der Toleranz
    # bekommen Teiltransparenz, statt hart abgeschnitten zu werden.
    edge = (~bg) & (dist <= opts["tol"] * 2.2)
    ramp = np.clip((dist - opts["tol"]) / (opts["tol"] * 1.2), 0.0, 1.0) * 255.0
    alpha[edge] = ramp[edge]

    if opts["keep_shadow"]:
        # Sanfter Schlagschatten bleibt als halbtransparente Flaeche erhalten.
        shadow = bg & (dist > opts["tol"] * 0.35)
        alpha[shadow] = np.clip((dist[shadow] / (opts["tol"] * 2)) * 90.0, 0, 90)

    a = Image.fromarray(alpha.astype(np.uint8), "L")
    if opts["feather"] > 0:
        a = a.filter(ImageFilter.GaussianBlur(opts["feather"]))

    out = im.convert("RGBA")
    out.putalpha(a)

    # Auf den sichtbaren Inhalt zuschneiden, aber mit Sicherheitsrand,
    # damit nichts angeschnitten wirkt.
    box = out.getbbox()
    if box:
        pad = max(2, int(0.01 * max(out.size)))
        l, t, r, b = box
        box = (max(0, l - pad), max(0, t - pad),
               min(out.width, r + pad), min(out.height, b + pad))
        out = out.crop(box)

    out.save(dst)
    covered = 100.0 * (1.0 - bg.mean())
    print(f"{dst}: {out.size[0]}x{out.size[1]}, Motivflaeche {covered:.1f}%")


if __name__ == "__main__":
    main()
