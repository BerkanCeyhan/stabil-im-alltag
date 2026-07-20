#!/usr/bin/env node
/**
 * WikiHow-Stil Selbsttest-Bilder + Lücken-Darstellung (Nano Banana Pro).
 *   node scripts/gen-selbsttest.mjs
 * Geteilt von allen Rektus-Quizzes (assets/rektus/selbsttest-1..4.jpg, luecke-2.jpg).
 * Consistent character/style via Referenz-Chaining. Englische, exakte Prompts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/rektus");
function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env");
  return m[1].replace(/^["']|["']$/g, "").trim();
}
const MODELS = ["gemini-3-pro-image-preview", "gemini-3-pro-image", "gemini-2.5-flash-image"];
function fileToPart(path) {
  const buf = readFileSync(resolve(ROOT, path));
  const ext = path.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}
async function generate(model, prompt, aspect, attach, key) {
  const parts = [];
  (attach || []).forEach((p) => parts.push(fileToPart(p)));
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } }),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error(`${model} keine Bilddaten`);
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

// Shared WikiHow illustration look, matching the warm rose/cream funnel palette.
const STYLE =
  "Clean, friendly instructional how-to illustration in a modern WikiHow explainer style. " +
  "Flat vector shapes with soft, subtle shading, gentle rounded line work, minimal detail, " +
  "warm cream and soft rose palette with a calm sage-green accent, plain light off-white background, " +
  "no text, no letters, no numbers, no labels, no arrows, no logos. Square 1:1 composition, " +
  "well lit and easy to read at a glance. " +
  "The character is an ordinary, relatable adult woman with a soft, natural belly and an average, " +
  "non-athletic body, medium skin tone, brown hair loosely tied back, wearing a light rose fitted " +
  "tank top and soft grey leggings. She lies on a light grey exercise mat on a plain floor. " +
  "Keep the exact same woman, clothing, mat and style consistent with the reference image. ";

const JOBS = [
  { name: "selbsttest-1", aspect: "1:1", prompt: STYLE +
    "STEP: lying down to start the test. Side view of the whole woman lying flat on her back on the mat, " +
    "knees bent, both feet flat on the floor, arms resting relaxed at her sides, head resting calmly on the mat. " +
    "Calm, neutral resting pose. Her belly is soft and relaxed." },
  { name: "selbsttest-2", aspect: "1:1", attachIdx: 0, prompt: STYLE +
    "STEP: feeling the edges of the abdominal muscles. Side-angle view of the same woman lying on the mat, " +
    "knees bent, feet flat. She lifts her head and shoulders slightly off the mat (a small gentle crunch), " +
    "her abdominal muscles are engaged, and she presses two fingertips of one hand straight down into the " +
    "centre line of her belly just above the navel to feel the inner edges of the two vertical muscle bands. " +
    "Show the small head-lift clearly." },
  { name: "selbsttest-3", aspect: "1:1", attachIdx: 1, prompt: STYLE +
    "STEP: relaxing the muscles again. Side-angle view of the same woman now lying back down flat, " +
    "head resting relaxed on the mat again, belly soft and relaxed, but keeping the two fingertips of one hand " +
    "still resting on the centre line of her belly just above the navel. Calm and relaxed expression." },
  { name: "selbsttest-4", aspect: "1:1", attachIdx: 2, prompt: STYLE +
    "STEP: measuring the gap. Close-up top-down bird's-eye view looking straight down onto the woman's bare " +
    "midsection around the navel (tank top lifted just enough to show the belly). Two fingers of one hand are " +
    "laid flat and horizontal, side by side, pressed gently down into the soft vertical groove (the gap) between " +
    "the two vertical abdominal muscle bands, just above the navel. The two side-by-side fingers clearly sink into " +
    "the gap and visually show a width of about two finger-widths. The gap between the muscles is clearly visible." },
  { name: "luecke-2", aspect: "1:1", attachIdx: 3, prompt: STYLE.replace("She lies on a light grey exercise mat on a plain floor. ", "") +
    "Strict overhead top-down bird's-eye view: the camera looks straight down from directly above onto a woman's bare " +
    "relaxed midsection around the navel, so the belly is seen flat from above like the other test illustrations. " +
    "The vertical midline groove (the gap between the two abdominal muscle bands) runs from the top to the bottom of the frame. " +
    "One hand comes in from the bottom of the frame, and exactly two fingers (index and middle) are laid flat DOWN FROM ABOVE, " +
    "stacked one above the other along the midline, pressed gently INTO the vertical gap just above the navel. The two fingers " +
    "sit inside the groove and clearly span about two finger-widths of gap. Do NOT place the hand or fingers from the side. " +
    "The fingers must be pressed straight down into the gap from directly above, unmistakably visible. Soft natural non-athletic " +
    "belly, calm neutral clinical-friendly illustration." },
];

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2); // z.B. "node gen-selbsttest.mjs luecke-2"
  const results = [];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    if (only.length && !only.includes(j.name)) continue;
    const attach = [];
    // Referenz aus vorherigem Job ODER (bei Einzellauf) aus vorhandener Datei
    if (typeof j.attachIdx === "number") {
      if (results[j.attachIdx]) attach.push(results[j.attachIdx]);
      else attach.push(`assets/rektus/${JOBS[j.attachIdx].name}.jpg`);
    }
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}${attach.length ? ", +ref" : ""}) via ${model} ... `);
        const { b64, mime } = await generate(model, j.prompt, j.aspect, attach, key);
        const rel = `assets/rektus/${j.name}.jpg`; // Quizzes referenzieren .jpg
        writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
        results[i] = rel;
        console.log(`ok -> ${rel}`);
        done = true; break;
      } catch (e) { console.log(`fehlgeschlagen: ${e.message}`); }
    }
    if (!done) { results[i] = null; console.error(`!! ${j.name} nicht erzeugt`); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
