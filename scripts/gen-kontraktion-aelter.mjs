#!/usr/bin/env node
/**
 * Kontraktions-Clip mit einer aelteren Person (Feedback 13.10.: nicht der junge, sportliche Mann).
 *
 *   node scripts/gen-kontraktion-aelter.mjs start     # Startbild (Nano Banana 2) aus den echten Gurt-Referenzen
 *   node scripts/gen-kontraktion-aelter.mjs video     # Clip (Veo 3.1 Fast) aus dem Startbild
 *
 * Voraussetzung: GEMINI_API_KEY in .env.
 * Ausgabe: assets/video/ref/kontraktion-aelter-start.jpg und assets/video/ref/kontraktion-aelter-veo.mp4
 * Der Clip ist eine KI-Darstellung und wird als "Animierte Darstellung" gekennzeichnet.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const START = "assets/video/ref/kontraktion-aelter-start.jpg";
const RAW = "assets/video/ref/kontraktion-aelter-veo.mp4";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}
const part = (p) => {
  const ext = p.split(".").pop().toLowerCase();
  return { inlineData: { mimeType: ext === "png" ? "image/png" : "image/jpeg", data: readFileSync(resolve(ROOT, p)).toString("base64") } };
};

const START_PROMPT =
  "The first reference image shows the real Wellenpuls training belt from the front on a body, the second a close-up of its control unit, " +
  "the third the belt from the side. Recreate this belt exactly. " +
  "Photo: a man of about 63 with short grey hair and a grey stubble beard, an ordinary, slightly soft, non-athletic body with a little belly, " +
  "mature skin with pores, a few moles and some grey chest hair, standing in a bright, lived-in German living room by a window. " +
  "Seen from the front-right at waist height, from about one metre: the frame shows his torso from the lower chest to the top of his trousers, " +
  "his face is out of frame. With both hands he holds his light blue cotton shirt up above the belt. " +
  "The belt is worn directly on his bare skin around his waist, above the waistband of his beige chinos. " +
  "Exactly as in the first reference image, where the man faces the camera: the front is a smooth matte black panel; " +
  "the control unit sits on it just LEFT of the navel as seen in the image (on his right side), exactly as in the second reference image: " +
  "a horizontal oval with a polished silver rim, a dark glass face, a power symbol at the top, minus on the left, plus on the right, " +
  "three small wavy heat lines at the bottom and four short red light bars lit in an X in the centre. " +
  "In the image, to the LEFT of the control unit the belt continues with fine curved light-grey stripes towards his right hip and wraps around to his back; " +
  "at the RIGHT side of the image (his left side) is the plain black closure flap with a vertical stitched seam and a small metal ring. " +
  "No lettering on the belt in this view, no round patch on the front. " +
  "35mm film photo, soft window light from the left, gentle grain, true skin tones, no retouching, slight softness at the edges. " +
  "Horizontal 16:9 composition, the control unit sits slightly left of the centre of the frame, the metal ring near the right edge of the belt. No text, no watermark.";

const VIDEO_PROMPT =
  "Locked-off static camera, photorealistic close-up of an older man's bare waist and lower belly, wearing a black training belt with an oval silver control unit. " +
  "He stands completely still, holding his light blue shirt up with both hands. " +
  "The training belt is switched on and working: the four small red indicator lights on the control unit softly pulse brighter with each impulse. " +
  "With every impulse, the muscles of the waist and lower belly directly above the belt tighten very gently for about one second and then relax. " +
  "The movement is subtle and natural, a slight firming of the skin, never a jerk or twitch, repeating calmly every two to three seconds. " +
  "Purely natural documentary footage, no visual effects of any kind. " +
  "The belt, the control unit, the hands, the shirt and the background stay exactly the same. No camera movement, no zoom, no breathing exaggeration, no talking.";
const NEG =
  "lightning, electric arcs, sparks, glow lines, energy effects, CGI, overlays, strong twitching, shaking, jerky movement, " +
  "camera movement, zoom, morphing hands, changing belt, changing control unit, text, face";

async function genStart(key) {
  const body = {
    contents: [{ parts: [part("assets/video/ref/gurt-front-nah.jpg"), part("assets/video/ref/bedienteil.jpg"), part("assets/video/ref/gurt-seite.jpg"), { text: START_PROMPT }] }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.15, seed: 6102, imageConfig: { aspectRatio: "16:9" } },
  };
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bild HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = ((await res.json())?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error("keine Bilddaten");
  writeFileSync(resolve(ROOT, START), Buffer.from(out.inlineData.data, "base64"));
  console.log("ok", START);
}

async function genVideo(key) {
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const img = readFileSync(resolve(ROOT, START)).toString("base64");
  const res = await fetch(`${base}/models/veo-3.1-fast-generate-preview:predictLongRunning`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      instances: [{ prompt: VIDEO_PROMPT, image: { bytesBase64Encoded: img, mimeType: "image/jpeg" } }],
      parameters: { aspectRatio: "16:9", durationSeconds: 8, personGeneration: "allow_adult", negativePrompt: NEG },
    }),
  });
  if (!res.ok) throw new Error(`Veo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { name } = await res.json();
  for (;;) {
    await new Promise((r) => setTimeout(r, 10000));
    const st = await (await fetch(`${base}/${name}`, { headers: { "x-goog-api-key": key } })).json();
    if (st.error) throw new Error(`Veo: ${JSON.stringify(st.error).slice(0, 300)}`);
    if (st.done) {
      const uri = st.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error(`Veo ohne Video: ${JSON.stringify(st.response).slice(0, 300)}`);
      const vid = await fetch(uri, { headers: { "x-goog-api-key": key } });
      writeFileSync(resolve(ROOT, RAW), Buffer.from(await vid.arrayBuffer()));
      return console.log("ok", RAW);
    }
  }
}

const key = loadKey();
mkdirSync(resolve(ROOT, "assets/video/ref"), { recursive: true });
const mode = process.argv[2];
if (mode === "start") await genStart(key);
else if (mode === "video") await genVideo(key);
else console.log("Aufruf: node scripts/gen-kontraktion-aelter.mjs start|video");
