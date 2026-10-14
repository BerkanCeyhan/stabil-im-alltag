#!/usr/bin/env node
/**
 * Statics fuer die Kampagnen Ruecken und Eltern ab Oktober 2026 (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-statics-2026-10.mjs              # alle Jobs
 *   node scripts/gen-statics-2026-10.mjs r-02 e-01    # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * Format nach dem Muster der aktiven Bodify-Statics (Person mit Geraet am Koerper,
 * kurze Ueberschrift in Markerkaesten, unten Produkt und "30 Tage testen"), aber in
 * unseren Farben (Navy, Mint) und mit unserer Zielgruppe. Bodify-Bilder werden NICHT
 * als Referenz uebergeben, das Layout ist nur im Prompt beschrieben.
 *
 *   r-01..04  Kampagne Ruecken  -> /ruecken/adv/2/ und /ruecken/lp3/
 *   e-01..04  Kampagne Eltern   -> /ruecken/eltern/adv/ und /ruecken/lp3/?fuer=eltern
 *   i-01      Illustration Tiefenmuskulatur fuer lp3
 *
 * Galerie: assets/ads/2026-10/index.html
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/2026-10";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODEL = "gemini-3.1-flash-image";

function fileToPart(path) {
  const buf = readFileSync(resolve(ROOT, path));
  const ext = path.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

async function generate(prompt, aspect, attach, key, seed) {
  const parts = [];
  (attach || []).forEach((p) => parts.push(fileToPart(p)));
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.15, seed, imageConfig: { aspectRatio: aspect } },
  };
  const post = () =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  let res = await post();
  if (res.status === 400) {
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await post();
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error("keine Bilddaten");
  return out.inlineData.data;
}

/* ------------------------------------------------------------------ *
 * Bausteine
 * ------------------------------------------------------------------ */

const REAL =
  "Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8 lens, available natural daylight, " +
  "no beauty retouching, no skin smoothing. Visible skin texture with pores, fine lines and uneven skin tone. " +
  "Subtle sensor grain, natural colour, gentle contrast, no HDR, no glossy commercial polish, no plastic-looking skin. " +
  "Real, ordinary, non-athletic body. Not a fitness model, no gym setting. ";

const BELT =
  "The person wears exactly the black lower-back training belt shown in the reference image: about 15 cm tall, black fabric " +
  "with fine grey horizontal stripes, a small white 'Wellenpuls' wordmark with a V symbol, and an oval silver control unit " +
  "with four buttons and small red lights, sitting at the side of the waist. The belt looks exactly like the reference, " +
  "no other device, no wires. ";

// Poster-Layout nach dem Muster der Bodify-Statics, in unseren Farben.
const POSTER =
  "Social media advertising poster, vertical 4:5. Background: a smooth vertical gradient from deep navy blue (#0f2740) at the top " +
  "to a slightly lighter steel blue (#1f4a6e) at the bottom, no texture, no pattern. ";

const MARKER = (lines) =>
  "In the upper left area, starting at about 8 percent from the top and 7 percent from the left edge, a headline set in a heavy, " +
  "bold condensed sans-serif in dark navy (#0f2740). Each line sits on its own solid mint-green (#86dcb8) highlight rectangle " +
  "that hugs the text like marker highlighting, with small even padding. Each line is approximately one eleventh of the image height. " +
  `There are exactly ${lines.length} lines, reading exactly, line by line: ` +
  lines.map((l, i) => `line ${i + 1}: ${l}`).join("; ") +
  ". ";

const BRAND =
  "In the top left corner above the headline, small white uppercase letters with wide letter spacing, about one fortieth of the " +
  "image height, reading exactly: WELLENPULS. ";

const FOOT = (a, b) =>
  "In the lower left area, about 8 percent from the bottom, two short lines of white text in a clean bold sans-serif. " +
  `The first line, about one twentieth of the image height, reads exactly: ${a}. ` +
  `The second line, thinner and about half that size, reads exactly: ${b}. `;

const ONLY = "No other text, no extra numbers, no icons, no arrows, no badges, no watermark anywhere in the image. ";

/* ------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------ */

const JOBS = [
  /* ---------- Kampagne Ruecken ---------- */
  {
    name: "r-01-30-tage-testen",
    seed: 1001,
    attach: ["assets/video/ref/gurt-seite.jpg"],
    prompt:
      POSTER + BRAND + MARKER(["30 Tage", "testen!"]) +
      "On the right half of the image, a photographic cut-out of a friendly man of about 62 with short grey hair, " +
      "seen in three-quarter view from behind, cleanly composited onto the gradient, visible from the head down to mid-thigh. " +
      "He lifts his light blue cotton shirt slightly with one hand so the belt on his lower back is clearly visible, " +
      "and looks back over his shoulder towards the camera with a relaxed, warm smile. Beige chino trousers. " +
      REAL + BELT +
      FOOT("Wellenpuls LWS", "Geld zurück, wenn er Ihnen nicht hilft") + ONLY,
  },
  {
    name: "r-02-gurt-an-fernseher-an",
    seed: 1002,
    attach: ["assets/video/ref/gurt-seite.jpg"],
    prompt:
      "Social media advertising photo, vertical 4:5, full-bleed photograph with a soft dark navy gradient overlay on the top third " +
      "so the headline is readable. " +
      "Scene: a cosy, lived-in German living room in the evening, warm lamp light. A woman of about 60 with shoulder-length grey-blonde hair " +
      "sits relaxed on a light grey sofa, leaning back against a cushion, holding a TV remote loosely in her right hand, " +
      "with a calm, content expression, looking slightly off camera towards the TV. She wears a fitted light grey long-sleeve top and dark jeans. " +
      "The belt sits around her lower back and waist over the top, the control unit visible at her right hip. " +
      "Camera at seated eye level, slightly to her right, she fills the lower two thirds of the frame. " +
      REAL + BELT + BRAND + MARKER(["Gurt an.", "Fernseher an."]) +
      FOOT("Rückentraining im Sitzen", "20 Minuten, zweimal pro Woche") + ONLY,
  },
  {
    name: "r-03-gezielt-unterer-ruecken",
    seed: 1013,
    attach: ["assets/video/kontraktion-ruecken-start.jpg"],
    prompt:
      POSTER + BRAND + MARKER(["Gezielt für", "den unteren", "Rücken!"]) +
      "On the right two thirds of the image, a photographic cut-out of the man from the reference image, seen directly from behind, " +
      "cleanly composited onto the gradient: he holds his light blue shirt open with both hands so his bare back is visible, " +
      "the black Wellenpuls belt sits on his lower back exactly as in the reference. Visible from the shoulders to the top of the trousers. " +
      "Soft light from the left shows the shape of the back muscles. " +
      REAL +
      FOOT("Entwickelt an der Sporthochschule Köln", "Jetzt 30 Tage testen") +
      "Spell the word Sporthochschule exactly letter by letter: S-p-o-r-t-h-o-c-h-s-c-h-u-l-e. " + ONLY,
  },
  {
    name: "r-04-in-drei-schritten",
    seed: 1004,
    attach: ["assets/video/ref/gurt-seite.jpg"],
    prompt:
      POSTER + BRAND + MARKER(["Rücken", "trainieren.", "Im Sitzen."]) +
      "Below the headline on the left, three short lines of white text in a clean bold sans-serif, each about one twenty-fifth of the image height, " +
      "stacked with generous spacing, reading exactly: line 1: Gurt anlegen; line 2: Stufe wählen; line 3: 20 Minuten sitzen. " +
      "On the right half of the image, a photographic cut-out of a woman of about 58 with short dark hair and glasses, " +
      "standing in three-quarter view, cleanly composited onto the gradient, visible from the head to the knees, " +
      "pressing a button on the control unit at her right hip with her right hand and smiling softly. " +
      "She wears a fitted white t-shirt tucked in and dark trousers; the belt sits around her lower back and waist over the t-shirt. " +
      REAL + BELT +
      FOOT("Wellenpuls LWS", "Jetzt 30 Tage testen") +
      "No other text, no extra numbers, no icons, no arrows, no badges, no watermark anywhere in the image. ",
  },

  /* ---------- Kampagne Eltern ---------- */
  {
    name: "e-01-papa-uebungen",
    seed: 2001,
    attach: ["assets/video/ref/gurt-seite.jpg"],
    prompt:
      "Social media advertising photo, vertical 4:5, full-bleed photograph with a soft dark navy gradient overlay on the top third " +
      "so the headline is readable. " +
      "Scene: a man of about 74 with thinning white hair and strong, worn hands sits in a brown leather armchair in a tidy, " +
      "slightly old-fashioned German living room with a wooden cabinet and a window with net curtains, afternoon daylight. " +
      "He holds an open newspaper on his lap and looks up over his reading glasses with a dry, amused half smile. " +
      "He wears a beige checked flannel shirt tucked into grey trousers, the belt sits around his lower back and waist over the shirt, " +
      "the control unit visible at his right hip. Camera at seated eye level, he fills the lower two thirds of the frame. " +
      REAL + BELT + BRAND + MARKER(["Papa macht", "seine Übungen", "nicht?"]) +
      FOOT("Rückentraining im Sessel", "Für Ihre Eltern. 30 Tage testen.") + ONLY,
  },
  {
    name: "e-02-vier-tasten",
    seed: 2002,
    attach: ["assets/video/ref/gurt-front.jpg"],
    prompt:
      POSTER + BRAND + MARKER(["Vier Tasten.", "Kein Handy.", "Keine App."]) +
      "In the lower two thirds, a photographic close-up, cleanly composited onto the gradient with soft rounded edges: " +
      "the oval silver control unit of the black Wellenpuls belt from the reference image, worn at the waist over a soft lilac cardigan, " +
      "and the hand of a woman of about 72, with visible age spots and a plain gold wedding ring, pressing the plus button with her index finger. " +
      "The four buttons and the small red lights are sharp and clearly visible. Soft daylight. " +
      REAL +
      FOOT("So einfach, dass Mama es allein schafft", "Wellenpuls LWS. 30 Tage testen.") + ONLY,
  },
  {
    name: "e-03-fuer-mama",
    seed: 2003,
    attach: ["assets/video/ref/gurt-seite.jpg"],
    prompt:
      "Social media advertising photo, vertical 4:5, full-bleed photograph with a soft dark navy gradient overlay on the top third " +
      "so the headline is readable. " +
      "Scene: a bright, cosy German living room, morning daylight. A woman of about 72 with short white hair sits in a blue armchair, " +
      "smiling warmly. Kneeling beside the armchair, her daughter of about 45 with a brown ponytail, in a denim shirt, " +
      "adjusts the control unit of the belt at her mother's hip and looks up at her; the two share a light, affectionate moment. " +
      "The mother wears a soft beige knitted top, the belt sits around her lower back and waist over the top. " +
      "Camera at seated eye level, both fill the lower two thirds of the frame. " +
      REAL + BELT + BRAND + MARKER(["Für Mama.", "Ganz ohne", "Übungen."]) +
      FOOT("Lieferung direkt zu Ihren Eltern", "30 Tage testen. Geld zurück.") + ONLY,
  },
  {
    name: "e-04-paket-eltern",
    seed: 2004,
    attach: ["assets/video/ref/packshot.jpg"],
    prompt:
      POSTER + BRAND + MARKER(["Rückentraining", "für Ihre Eltern."]) +
      "In the lower half, centred, the black Wellenpuls belt from the reference image, closed into a ring and standing upright " +
      "on a simple round white pedestal, with the oval silver control unit facing the viewer, studio product photograph with a soft shadow, " +
      "photorealistic, sharp detail of the striped fabric. " +
      "To the right of the belt, a closed black zip travel case and a small white spray bottle. " +
      FOOT("489 € einmalig. Kostenloser Versand.", "Jetzt 30 Tage testen") + ONLY,
  },

  /* ---------- Illustration fuer lp3 ---------- */
  {
    name: "i-01-tiefenmuskulatur",
    seed: 3001,
    aspect: "4:3",
    attach: [],
    prompt:
      "Clean editorial medical explainer illustration, flat vector shapes with soft subtle shading, gentle rounded line work, " +
      "generous white space, calm palette of deep navy (#0f2740), mint green (#86dcb8), warm skin beige and light grey, on a pure white background. " +
      "Subject: the lower back of a human figure seen from behind, drawn as a simplified anatomical cut-away: the lumbar spine with five vertebrae " +
      "in light grey, and directly on both sides of the vertebrae the small deep back muscles highlighted in mint green, " +
      "the larger outer back muscles shown semi-transparent in warm beige on top. " +
      "Around the lower back sits a simplified black belt band, drawn flat, with three soft concentric mint-green arcs radiating inward " +
      "from the belt towards the highlighted deep muscles to suggest a gentle pulse. " +
      "Horizontal 4:3 composition, the spine on the vertical centre line. " +
      "There is absolutely no text, no letters, no numbers, no labels, no arrows, no watermark anywhere in the image.",
  },
];

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });
for (const j of JOBS) {
  if (only.length && !only.some((o) => j.name.startsWith(o))) continue;
  try {
    const b64 = await generate(j.prompt, j.aspect || "4:5", j.attach, key, j.seed);
    const rel = `${OUTDIR}/${j.name}.jpg`;
    writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
    console.log("ok", rel);
  } catch (e) {
    console.log("FEHLER", j.name, e.message);
  }
}
