#!/usr/bin/env node
/**
 * Bildteile für die Meta-Statics November 2026 (Nano Banana 2.1, gemini-nano-banana-2.1).
 *
 *   node scripts/gen-statics-2026-11.mjs            # alle Jobs
 *   node scripts/gen-statics-2026-11.mjs astronaut  # nur einzelne Jobs
 *   SEED=7 node scripts/gen-statics-2026-11.mjs matte   # anderer Seed, Datei bekommt den Seed im Namen
 *
 * Erzeugt nur Fotos und Illustrationen ohne Text. Schrift, Screenshots und der echte Gurt
 * kommen danach in scripts/bau-statics-2026-11.mjs dazu, damit Text und Produkt exakt stimmen.
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 * Ausgabe: assets/ads/2026-11/roh/<name>.jpg
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/2026-11/roh";
const MODEL = "gemini-nano-banana-2.1";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

function fileToPart(path) {
  const buf = readFileSync(resolve(ROOT, path));
  const ext = path.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

async function generate(prompt, aspect, attach, key, seed) {
  const parts = (attach || []).map(fileToPart);
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.2, seed, imageConfig: { aspectRatio: aspect } },
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
  if (!out) throw new Error("keine Bilddaten: " + JSON.stringify(data).slice(0, 300));
  return out.inlineData.data;
}

const KEIN_TEXT = "No text, no letters, no numbers, no logos, no brand names, no watermark, no captions anywhere in the image. ";

const JOBS = [
  {
    name: "astronaut",
    aspect: "4:5",
    seed: 1101,
    prompt:
      "Photorealistic documentary photograph taken inside a space station module, 24mm lens, even light from white LED panels. " +
      "One astronaut in a plain dark-blue polo shirt and grey cargo trousers floats weightlessly in the middle of the module. The body is horizontal, " +
      "seen from the side and slightly from behind, so the back and the lower back are clearly visible. Arms relaxed and stretched forward, legs slightly bent. " +
      "Background: white equipment racks, cable bundles, blue handrails, a laptop on an arm, one small round window at the upper right with the blue curve of the Earth. " +
      "Composition: vertical 4:5. The astronaut sits in the upper two thirds of the frame. The lowest 24 percent of the frame is calm and darker (racks in shadow), " +
      "so a caption bar can be placed over it later without covering the astronaut. " +
      KEIN_TEXT + "No flags, no mission patches, no agency insignia.",
  },
  {
    name: "matte",
    aspect: "16:9",
    seed: 1102,
    attach: ["assets/lp3/anwendung-sofa.jpg"],
    prompt:
      "Photorealistic candid photograph, taken with a phone, in the same living room and of the same woman as in the reference image: around 60 years old, " +
      "shoulder-length blonde-grey hair, light grey knit sweater, dark jeans, same beige wall, same floor lamp, same warm evening light. " +
      "She lies on her back on a thin blue gymnastics mat on the living-room floor and does a glute bridge: knees bent, feet flat on the mat, hips lifted off the floor, " +
      "arms flat beside the body. Her face shows strain: eyes squeezed, lips pressed together. Beside the mat on the wooden floor lie a printed sheet with small exercise drawings and a pair of reading glasses. " +
      "Camera at floor height, from the side, 35mm. Her head is at the left of the frame, her knees at the right, the body fills the middle band of the frame. " +
      "She wears no belt and no device. " + KEIN_TEXT + "Horizontal 16:9.",
  },
  {
    name: "lindert",
    aspect: "16:9",
    seed: 1103,
    prompt:
      "Photorealistic product photograph, soft daylight from the left, camera looking straight down onto a seamless plain off-white surface that fills the entire frame edge to edge, with no table edge, no floor and no other background visible. " +
      "Three objects lie in a row with clear space between them. Left: a beige adhesive heat patch, one corner peeled from its plain white backing paper. " +
      "Middle: a silver blister pack with ten round white tablets, two blisters pushed out and empty, the foil completely blank. " +
      "Right: a small white handheld TENS unit with a simple dark display and two round grey buttons; two thin white cables lead from it to two square beige adhesive electrode pads lying next to it. " +
      "All objects are plain and unbranded. Soft natural shadows. The three objects sit on one horizontal line in the lower two thirds of the frame and fill the middle 78 percent of the width, each fully visible with empty surface around it. The top third of the frame is empty surface. " +
      KEIN_TEXT + "Horizontal 16:9.",
  },
  {
    name: "sofa",
    aspect: "4:5",
    seed: 1104,
    attach: ["assets/lp3/packshot-vorn.jpg", "assets/video/ref/bedienteil.jpg"],
    prompt:
      "Photorealistic phone photo, first-person view looking down at one's own lap while sitting on a sofa in the evening. Slight phone-camera noise, casual framing, not staged. " +
      "A cream-coloured knitted wool blanket covers the legs. In the upper quarter of the frame, out of focus: a living room with a TV showing a blurred programme and a warm floor lamp. " +
      "At the right edge, on a small wooden side table: a mug of herbal tea with the tea-bag string hanging over the rim. On the blanket at the lower left: a black TV remote. " +
      "In the centre of the blanket lies the black back-training belt from reference image 1, flat, outer side up, exactly as in the reference: matte black fabric with fine light-grey horizontal stripes, " +
      "in its middle the white wordmark with the small W icon exactly as in reference image 1, and at its right end the round silver control dial. " +
      "The belt is about 60 percent of the frame width and lies slightly diagonal. Do not invent other markings on the belt. Warm tungsten light with a soft shadow under the belt. " +
      "No hands in the picture. No other text, no other logos, no watermark. Vertical 4:5.",
  },
  {
    name: "sessel",
    aspect: "4:5",
    seed: 1105,
    attach: ["assets/lp3/anwendung-sessel.jpg", "assets/video/ref/bedienteil.jpg", "assets/video/ref/getragen/vorn-rechts.jpg"],
    prompt:
      "Recreate the photograph from reference image 1 exactly: the same elderly man with glasses, the same beige checked shirt open at the bottom, the same brown leather armchair, the same room, " +
      "and the same black belt around his waist in exactly the same position. " +
      "The belt must match reference images 2 and 3 in every detail. From left to right in the picture: a section with fine light-grey stripes fanning out; " +
      "then the white wordmark that reads exactly 'Wellenpuls', sharp and legible, in the same clean sans-serif letters as in reference image 2; " +
      "then the horizontal oval control unit with a brushed silver ring and a dark face, showing exactly these symbols as in reference image 2: a small power symbol at the top, a minus sign at the left, " +
      "a plus sign at the right, three short wavy heat lines at the bottom, and four short red strokes forming an X in the centre; " +
      "then a smooth plain black flap across the belly; then one thin vertical silver metal buckle bar at the right. No other markings on the belt. " +
      "Change only the framing compared with reference image 1: zoom out a little and extend the picture upward, so that the top 34 percent of the frame shows the calm light wall and ceiling above and behind the armchair. " +
      "The man and the armchair sit in the lower 66 percent. Photorealistic, same daylight. No added text anywhere except the wordmark on the belt, no watermark. Vertical 4:5.",
  },
  {
    name: "anatomie",
    aspect: "4:3",
    seed: 1106,
    attach: ["assets/lp3/tiefenmuskulatur.jpg"],
    prompt:
      "Edit the attached illustration. Keep the same flat medical illustration style, the same lower back seen from behind, the same spine and vertebrae. " +
      "Remove the dark belt and the green curved wave lines completely, so the bare lower back and pelvis area are visible. " +
      "Recolour only the two long narrow muscle bands that run directly along the left and right side of the spine in a strong warm red-orange, so they clearly stand out. " +
      "Keep every other muscle in the pale beige and skin tones of the original. Plain white background. " +
      "No text, no letters, no numbers, no arrows, no labels, no watermark. Horizontal 4:3.",
  },
];

const only = process.argv.slice(2);
const seedOverride = process.env.SEED ? Number(process.env.SEED) : null;
const key = loadKey();
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });

for (const j of JOBS) {
  if (only.length && !only.some((o) => j.name.startsWith(o))) continue;
  const seed = seedOverride ?? j.seed;
  const rel = `${OUTDIR}/${j.name}${seedOverride ? "-" + seed : ""}.jpg`;
  try {
    const b64 = await generate(j.prompt, j.aspect, j.attach, key, seed);
    writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
    console.log("ok   ", rel);
  } catch (e) {
    console.log("FEHLER", j.name, String(e.message || e).slice(0, 300));
  }
}
