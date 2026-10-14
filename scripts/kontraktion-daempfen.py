#!/usr/bin/env python3
"""
Macht den Kontraktions-Clip subtiler und laesst den Wellenpuls sichtbar mitarbeiten.

    python3 scripts/kontraktion-daempfen.py EINGABE.mp4 AUSGABE.mp4 [--staerke 0.4] [--start 1.2] [--ende 6.6]

1. Bewegung daempfen: Fuer jedes Bild wird der optische Fluss zum entspannten Referenzbild
   (Bild bei --start) berechnet, mit --staerke skaliert und das Referenzbild damit verzerrt.
   0.4 heisst: 40 Prozent der Bewegung aus dem Original bleiben uebrig, ohne Geisterbilder.
2. LEDs pulsieren: Die roten Lichter am Bedienteil werden im Takt der Kontraktion heller
   und bekommen einen leichten Schein. Die Staerke folgt der Bewegung im Bauchbereich.

Benoetigt: opencv-python-headless, numpy. ffmpeg fuer die Kodierung.
"""
import argparse
import subprocess

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("eingabe")
ap.add_argument("ausgabe")
ap.add_argument("--staerke", type=float, default=0.4)
ap.add_argument("--start", type=float, default=1.2)
ap.add_argument("--ende", type=float, default=6.6)
# Bereiche im 1280x720-Clip: Bedienteil mit LEDs, Bauch ueber dem Gurt
ap.add_argument("--led", default="470,400,600,500")
ap.add_argument("--bauch", default="440,40,1040,300")
a = ap.parse_args()

cap = cv2.VideoCapture(a.eingabe)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
i0, i1 = int(round(a.start * fps)), int(round(a.ende * fps))
clip = frames[i0:i1]
ref = clip[0]
ref_g = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
h, w = ref_g.shape
gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))

lx0, ly0, lx1, ly1 = map(int, a.led.split(","))
bx0, by0, bx1, by1 = map(int, a.bauch.split(","))

# LED-Maske aus dem Referenzbild: kraeftiges Rot im Bereich des Bedienteils
hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV)
red = ((hsv[..., 0] < 10) | (hsv[..., 0] > 168)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 120)
led = np.zeros((h, w), np.float32)
led[ly0:ly1, lx0:lx1] = red[ly0:ly1, lx0:lx1].astype(np.float32)
glow = cv2.GaussianBlur(cv2.dilate(led, np.ones((5, 5), np.uint8)), (0, 0), 7)
glow = glow / (glow.max() + 1e-6)

out_frames, strength = [], []
for f in clip:
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(g, ref_g, None, 0.5, 4, 25, 4, 7, 1.5, 0)
    strength.append(float(np.abs(flow[by0:by1, bx0:bx1]).mean()))
    mx = gx + a.staerke * flow[..., 0]
    my = gy + a.staerke * flow[..., 1]
    out_frames.append(cv2.remap(ref, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE))

s = np.array(strength)
s = (s - s.min()) / (s.max() - s.min() + 1e-6)
s = np.convolve(s, np.ones(3) / 3, mode="same")

pipe = subprocess.Popen(
    ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
     "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
     "-movflags", "+faststart", a.ausgabe],
    stdin=subprocess.PIPE,
)
for f, k in zip(out_frames, s):
    o = f.astype(np.float32)
    lift = 0.25 + 0.75 * k  # LEDs leuchten immer, im Impuls deutlich heller
    o[..., 2] += glow * 120 * lift
    o[..., 1] += glow * 25 * lift
    o[..., 0] += glow * 20 * lift
    o += (led[..., None] * np.array([40, 40, 90], np.float32)) * lift
    pipe.stdin.write(np.clip(o, 0, 255).astype(np.uint8).tobytes())
pipe.stdin.close()
pipe.wait()
print("ok", a.ausgabe, len(out_frames), "Bilder")
