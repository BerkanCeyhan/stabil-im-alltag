#!/usr/bin/env node
/**
 * Ad-Motive fuer die Rabattaktion / Retargeting (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-aktion-ads.mjs              # alle Jobs
 *   node scripts/gen-aktion-ads.mjs akt-01       # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * Zielgruppe ist product aware: sie hat die Wellenpuls-Anzeigen schon gesehen.
 * Deshalb steht hier nicht das Problem im Bild, sondern das Geraet und der
 * Preisvorteil. Vier bewusst verschiedene Bildsprachen, weil Meta aehnliche
 * Creatives in denselben Delivery-Bucket clustert:
 *   akt-01  Packshot, ruhig, mit einer typografischen Zeile
 *   akt-02  Alltags-Schnappschuss, Mensch traegt den Guertel, ohne Text
 *   akt-03  Flatlay des kompletten Pakets von oben, ohne Text
 *   akt-04  Editoriale Preis-Typografie, Geraet klein im Bild
 *
 * Copy (Primary Text + Headline) steht in aktion/ADS.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/aktion";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELS = ["gemini-3.1-flash-image"];

function fileToPart(path) {
  const buf = readFileSync(resolve(ROOT, path));
  const ext = path.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

async function generate(model, prompt, aspect, attach, key, seed) {
  const parts = [];
  (attach || []).forEach((p) => parts.push(fileToPart(p)));
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: 0.15,
      seed,
      imageConfig: { aspectRatio: aspect },
    },
  };
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error(`${model} keine Bilddaten`);
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

/* ------------------------------------------------------------------ *
 * Gemeinsame Stil-Bausteine
 * ------------------------------------------------------------------ */

// Gegen den AI-Stock-Look: echte Haut, echtes Licht, echte Raeume.
const REAL =
  "Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8 lens, " +
  "available natural daylight from a window only, no flash, no studio strobes, no beauty retouching, " +
  "no skin smoothing. Slightly imperfect, candid framing as if taken quickly by a family member. " +
  "Subtle sensor grain, natural muted colour, gentle contrast, no HDR, no glossy commercial polish, " +
  "no lens flare, no bokeh balls, no plastic-looking skin. ";

// Die Zielgruppe muss sich wiedererkennen: keine Fitnessmodels.
const ECHTE_MENSCHEN =
  "Real, ordinary, non-athletic German body of that age. Not a fitness model, no visible abdominal " +
  "muscle definition, no toned six-pack, no gym setting, no sportswear branding. Visible skin texture " +
  "with pores, fine lines, age spots and uneven skin tone. Slightly greying hair, worn wedding ring. ";

// Der Guertel muss in jedem Motiv derselbe sein.
const GERAET =
  "Reproduce the black lumbar support belt from the attached reference image EXACTLY: same wide " +
  "matte-black neoprene band, same fine horizontal grey line pattern across the front, same small " +
  "round brushed-silver control unit with a tiny display on the right side of the band, same black " +
  "velcro strap end on the left. Do not change its shape, proportions or colour. ";

// Markenwelt: hell, redaktionell-medizinisch, warm. Kein Teleshopping.
const MARKE =
  "Calm editorial colour world: warm off-white and light sand tones, soft deep blue accents, one " +
  "restrained muted teal accent at most. No red, no yellow, no orange, no starbursts, no price " +
  "explosion graphics, no sale badges, no ribbons, no arrows, no borders, no frames. ";

const KEIN_TEXT =
  "No text, no letters, no numbers, no watermark, no logo, no captions, no UI elements anywhere in the image. ";

/* ------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------ */

const REF_GERAET = "assets/PackShot_01.png";
const REF_TRAGEN = "assets/Frau_55_Frontalansicht_WellenpulsLWS_Lifestyle.png";
const REF_BUNDLE = "assets/product-image-1.png";

const JOBS = [
  {
    // Ruhiger Packshot mit genau einer typografischen Zeile. Der Preisvorteil
    // steht im Bild, weil die Zielgruppe das Produkt schon kennt und nur noch
    // den Grund zum Handeln braucht.
    name: "akt-01-packshot-rabatt",
    aspect: "4:5",
    seed: 511001,
    attach: [REF_GERAET],
    prompt:
      GERAET +
      "The belt lies flat and slightly angled on a warm off-white matte paper surface, seen from " +
      "directly above at a shallow angle, filling the upper two thirds of the frame and occupying " +
      "about fifty five percent of the image width. Soft directional daylight from the upper left " +
      "casts one long, soft, natural shadow to the lower right. " +
      MARKE +
      "In the lower third, centred, one short line of German text in a bold geometric sans-serif, " +
      "deep navy blue, approximately one tenth of the image height, reading exactly: 100 € günstiger. " +
      "Directly under it, one thinner smaller line in the same typeface, medium warm grey, " +
      "approximately one third that size, reading exactly: Nur für kurze Zeit. " +
      "No other text, no numbers, no logo, no captions and no watermark anywhere. " +
      "Vertical 4:5 composition, the belt sits above the horizontal centre line, the text block sits " +
      "on the lower third line.",
  },
  {
    // Der Beweis, dass es im echten Alltag getragen wird. Kein Text, damit das
    // Motiv sich visuell maximal vom Packshot unterscheidet.
    name: "akt-02-wohnzimmer-abend",
    aspect: "4:5",
    seed: 511002,
    attach: [REF_TRAGEN],
    prompt:
      REAL +
      ECHTE_MENSCHEN +
      "A German woman of about 58 sits relaxed and slightly sideways in the corner of a worn grey " +
      "fabric sofa in an ordinary German living room in the late afternoon. She wears comfortable " +
      "dark jeans and a soft light-grey knit cardigan pushed up, so the wide black lumbar belt is " +
      "clearly visible around her lower back and waist. " +
      GERAET +
      "She is not looking at the camera; she reads something on a tablet resting on her knees and " +
      "looks calm and unbothered, as if she had forgotten she is wearing the belt. " +
      "The room is lived in, not styled: a folded blanket on the armrest, a half-full mug and reading " +
      "glasses on the side table, a laundry basket just visible at the edge of the frame, warm low " +
      "sunlight falling through a window on the left across the wall behind her. " +
      KEIN_TEXT +
      "Vertical 4:5 composition, shot from a seated eye-level position about two metres away, her " +
      "torso and the belt sit slightly right of centre and occupy the middle half of the frame.",
  },
  {
    // Das komplette Paket auf einen Blick. Flatlay von oben, damit die dritte
    // Bildsprache klar von Packshot und Reportage getrennt ist.
    name: "akt-03-paket-flatlay",
    aspect: "4:5",
    seed: 511003,
    attach: [REF_GERAET, REF_BUNDLE],
    prompt:
      "Overhead flat lay photograph, camera directly above and perfectly parallel to the surface, " +
      "shot on a Canon EOS R6 with a 35mm lens in soft diffuse daylight from a large window on the " +
      "left, one soft natural shadow set, no studio strobes, no HDR, no glossy commercial polish. " +
      "Arranged on a pale warm oak table top with visible wood grain: " +
      "the black lumbar support belt, loosely coiled, in the upper left, occupying about one third of " +
      "the frame. " +
      GERAET +
      "To its right a plain dark grey tablet lying flat, screen off. " +
      "Below them a slim printed booklet with a matte off-white cover, closed, and a small spiral " +
      "notebook next to it. In the lower right a plain dark grey travel pouch, closed. " +
      "The objects do not overlap and are separated by generous empty table surface. " +
      MARKE +
      KEIN_TEXT +
      "Vertical 4:5 composition, the four objects form a loose diagonal from the upper left to the " +
      "lower right, roughly one fifth of the frame stays empty table at the bottom.",
  },
  {
    // Rein typografisch. Traegt den Preisvorteil ohne Reizreize und ist damit
    // die Variante, die am ehesten nicht wie eine Anzeige aussieht.
    name: "akt-04-preis-editorial",
    aspect: "4:5",
    seed: 511004,
    attach: [REF_GERAET],
    prompt:
      "Clean editorial still life photograph on a plain warm off-white matte paper background with " +
      "very fine visible paper texture, soft even daylight from the upper left, one gentle natural " +
      "shadow, no studio strobes, no gradient, no vignette. " +
      "In the lower right quadrant, the black lumbar support belt lies flat and slightly angled, " +
      "small, occupying only about one quarter of the image width. " +
      GERAET +
      MARKE +
      "In the upper half, centred, two lines of German text in a bold geometric sans-serif. " +
      "The first line is medium warm grey with a single thin horizontal strike-through line through " +
      "it, approximately one twelfth of the image height, reading exactly: 489 €. " +
      "Directly under it the second line in deep navy blue, roughly twice as tall, reading exactly: 389 €. " +
      "Under both, one thin small line in medium warm grey, approximately one third the height of the " +
      "first line, reading exactly: Komplettpaket, einmalig. " +
      "No other text, no numbers, no logo, no captions, no currency symbols other than those stated, " +
      "and no watermark anywhere. " +
      "Vertical 4:5 composition, the text block sits above the horizontal centre line, the belt sits " +
      "on the lower third line in the right half.",
  },
];

/* ------------------------------------------------------------------ */

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });

for (const j of JOBS) {
  if (only.length && !only.some((o) => j.name.startsWith(o))) continue;
  // Fester Ausgabepfad mit fester Endung: sonst entsteht beim Nachgenerieren
  // eine .png neben der alten .jpg und die Seite zeigt weiter das alte Bild.
  const rel = `${OUTDIR}/${j.name}.jpg`;
  let ok = false;
  for (const model of MODELS) {
    try {
      const { b64 } = await generate(model, j.prompt, j.aspect, j.attach, key, j.seed);
      writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
      console.log(`ok   ${j.name}  ->  ${rel}`);
      ok = true;
      break;
    } catch (e) {
      console.error(`FEHL ${j.name}  ${model}: ${e.message}`);
    }
  }
  if (!ok) process.exitCode = 1;
}
