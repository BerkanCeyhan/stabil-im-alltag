"""Zuschnitte für die Statics November 2026. Aufruf: uv run --with pillow python scripts/vorbereiten-statics-2026-11.py"""
from PIL import Image

R = "assets/ads/2026-11/roh/"

# Echter Gurt, freigestellt, auf die sichtbare Fläche beschnitten
g = Image.open("assets/PackShot_01.png").convert("RGBA")
box = g.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
g = g.crop(box)
g = g.resize((1400, round(1400 * g.height / g.width)), Image.LANCZOS)
g.save(R + "gurt-frei.png")
print("gurt-frei", g.size)


# Bedienteil am Körper aus Christians Anleitungsvideo, ohne Untertitel
a = Image.open("assets/video/ref/getragen/anleitung-48.jpg").convert("RGB")
a.crop((388, 0, 868, 600)).resize((720, 900), Image.LANCZOS).save(R + "waerme.jpg", quality=92)

# Gründerporträt in handlicher Größe
c = Image.open("Assets_Marketing/Assets_Marketing/Portrait_Gruender_Christian_Senfleben.jpg").convert("RGB")
c.thumbnail((1600, 2000), Image.LANCZOS)
c.save(R + "christian.jpg", quality=90)
print("christian", c.size)
