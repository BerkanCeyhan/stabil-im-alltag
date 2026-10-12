#!/usr/bin/env node
/**
 * Kontraktions-Clip am Ruecken fuer lp3 und die Advertorials.
 *
 *   node scripts/gen-kontraktion-ruecken.mjs            # Startbild + Video
 *   node scripts/gen-kontraktion-ruecken.mjs start      # nur Startbild
 *   node scripts/gen-kontraktion-ruecken.mjs video      # nur Video (aus vorhandenem Startbild)
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * 1. Startbild mit Nano Banana 2 (gemini-3.1-flash-image): Rueckenansicht, nackter
 *    unterer Ruecken, der echte Gurt aus Christians Anleitungsvideo als Referenz.
 * 2. Clip mit Veo 3.1 Fast (Bild zu Video): die Rueckenmuskulatur spannt sich
 *    etwa alle zwei Sekunden an und entspannt wieder.
 *
 * Der Clip ist eine KI-Darstellung und wird auf den Seiten als
 * "Animierte Darstellung" gekennzeichnet. Ersetzen, sobald echtes Material gedreht ist.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/video";
const START = `${OUTDIR}/kontraktion-ruecken-start.jpg`;
const RAW = `${OUTDIR}/ref/kontraktion-ruecken-veo-${process.env.TAKE || "1"}.mp4`;
const SEED = 715002;

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

const STYLE =
  "Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8 lens, " +
  "available natural daylight only, no flash, no studio lighting, no beauty retouching, no skin smoothing. " +
  "Subtle sensor grain, natural colour, gentle contrast, no HDR, no glossy commercial polish.";

const START_PROMPT = [
  STYLE,
  "Subject: a man of about 62, seen from directly behind, standing in a bright, lived-in living room. " +
    "With both hands at his sides he holds his light blue cotton shirt up to just below the shoulder blades, so his lower and middle back is bare. " +
    "Real, ordinary, non-athletic body with a little softness at the waist. Not a fitness model, no gym setting. " +
    "Mature skin with visible texture, pores, a few freckles and faint age spots.",
  "Around his lower back he wears exactly the black training belt from the reference image: black fabric with fine grey horizontal stripes, " +
    "a white 'Wellenpuls' wordmark with a V symbol on the side panel and an oval silver control unit with red lights sitting on his right hip. " +
    "The belt is about 15 cm tall and sits just above the waistband of beige chino trousers with a brown leather belt.",
  "Composition: camera at waist height, centred directly behind him. The frame shows his back from the shoulder blades down to the top of the trousers. " +
    "The belt sits in the lower third. Above the belt, the two long back muscles running alongside the spine are clearly visible under the skin. " +
    "Soft daylight from a window on the left grazes across the back, so the muscle relief and the groove of the spine read clearly.",
  "Background: a softly out-of-focus living room with a sofa and a plant. No other people.",
  "No text except the wordmark on the belt, no watermark, no captions, no arrows.",
  "Horizontal 16:9 composition.",
].join("\n");

const VIDEO_PROMPT =
  "Locked-off static camera, photorealistic rear view of a man's bare lower back wearing a black training belt. " +
  "He stands completely still, holding his shirt up with both hands. " +
  "The only motion happens in his back muscles: the long muscles on both sides of the spine, directly above the belt, " +
  "visibly tighten and bunch up for about one second, the skin above the belt tenses and the groove of the spine deepens, then everything relaxes again. " +
  "This tightening repeats rhythmically every two seconds, clearly visible each time, like a slow involuntary flex. " +
  "Purely natural, documentary footage: nothing appears on or around the body, no visual effects of any kind. " +
  "The belt, the control unit, the hands, the shirt and the background stay exactly the same. No camera movement, no zoom, no turning, no talking.";

async function genStart(key) {
  const parts = [fileToPart(`${OUTDIR}/ref/gurt-seite.jpg`), { text: START_PROMPT }];
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent";
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.15, seed: SEED, imageConfig: { aspectRatio: "16:9" } },
  };
  let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  if (res.status === 400) {
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  }
  if (!res.ok) throw new Error(`Bild HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error("keine Bilddaten");
  writeFileSync(resolve(ROOT, START), Buffer.from(out.inlineData.data, "base64"));
  console.log("Startbild:", START, out.inlineData.mimeType);
}

async function genVideo(key) {
  const img = readFileSync(resolve(ROOT, START)).toString("base64");
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const res = await fetch(`${base}/models/veo-3.1-fast-generate-preview:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      instances: [{ prompt: VIDEO_PROMPT, image: { bytesBase64Encoded: img, mimeType: "image/jpeg" } }],
      parameters: {
        aspectRatio: "16:9",
        durationSeconds: 8,
        personGeneration: "allow_adult",
        negativePrompt: "lightning, electric arcs, sparks, glow, glowing lines, energy effects, CGI, visual effects, overlays, camera movement, zoom, turning around, face, talking, morphing hands, changing belt, extra fingers, text changes",
      },
    }),
  });
  if (!res.ok) throw new Error(`Veo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { name } = await res.json();
  console.log("Veo-Job:", name);
  for (;;) {
    await new Promise((r) => setTimeout(r, 10000));
    const st = await (await fetch(`${base}/${name}`, { headers: { "x-goog-api-key": key } })).json();
    if (st.error) throw new Error(`Veo: ${JSON.stringify(st.error).slice(0, 300)}`);
    if (st.done) {
      const uri = st.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error(`Veo ohne Video: ${JSON.stringify(st.response).slice(0, 300)}`);
      const vid = await fetch(uri, { headers: { "x-goog-api-key": key } });
      writeFileSync(resolve(ROOT, RAW), Buffer.from(await vid.arrayBuffer()));
      console.log("Video:", RAW);
      return;
    }
  }
}

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, `${OUTDIR}/ref`), { recursive: true });
if (!only.length || only.includes("start")) await genStart(key);
if (!only.length || only.includes("video")) await genVideo(key);
