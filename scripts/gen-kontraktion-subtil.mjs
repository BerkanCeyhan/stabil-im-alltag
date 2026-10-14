#!/usr/bin/env node
/**
 * Subtile Kontraktions-Clips aus dem echten Frame von Christian (Gurt vorn, Display an).
 *
 *   node scripts/gen-kontraktion-subtil.mjs veo     # Google Veo 3.1 Fast (GEMINI_API_KEY aus .env)
 *   node scripts/gen-kontraktion-subtil.mjs sora    # OpenAI Sora 2 (OPENAI_API_KEY aus der Umgebung)
 *
 * Ausgabe: assets/video/ref/kontraktion-subtil-<modell>.mp4
 * Die Clips sind KI-Darstellungen und werden auf den Seiten als "Animierte Darstellung" gekennzeichnet.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const START = "assets/video/ref/gurt-front.jpg";
const OUT = (m) => `assets/video/ref/kontraktion-subtil-${m}.mp4`;

const PROMPT =
  "Locked-off static camera, photorealistic close-up of a man's bare torso from the side-front, wearing a black lower-back training belt " +
  "with a small oval control unit. He stands completely still, holding his white t-shirt up with both hands. " +
  "The training belt is switched on and working: the small red indicator lights on the control unit softly pulse brighter with each impulse. " +
  "With every impulse, the muscles of the waist and lower abdomen directly above the belt tighten very gently for about one second and then relax. " +
  "The movement is subtle and natural, a slight firming of the skin and muscle, never a jerk or twitch, repeating calmly every two to three seconds. " +
  "Purely natural documentary footage, no visual effects of any kind. " +
  "The belt, the control unit, the hands, the shirt and the background stay exactly the same. No camera movement, no zoom, no breathing exaggeration, no talking.";

const NEG =
  "lightning, electric arcs, sparks, glow lines, energy effects, CGI, overlays, strong twitching, shaking, jerky movement, " +
  "camera movement, zoom, morphing hands, changing belt, text changes, face";

function envKey(name) {
  if (process.env[name]) return process.env[name].trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"));
  if (!m) throw new Error(`${name} nicht gefunden`);
  return m[1].replace(/^["']|["']$/g, "").trim();
}

async function veo() {
  const key = envKey("GEMINI_API_KEY");
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const img = readFileSync(resolve(ROOT, START)).toString("base64");
  const res = await fetch(`${base}/models/veo-3.1-fast-generate-preview:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      instances: [{ prompt: PROMPT, image: { bytesBase64Encoded: img, mimeType: "image/jpeg" } }],
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
      writeFileSync(resolve(ROOT, OUT("veo")), Buffer.from(await vid.arrayBuffer()));
      return console.log("ok", OUT("veo"));
    }
  }
}

async function sora() {
  const key = envKey("OPENAI_API_KEY");
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", PROMPT + " Avoid: " + NEG + ".");
  form.append("seconds", "8");
  form.append("size", "1280x720");
  // Sora verlangt, dass das Referenzbild genau die Zielgroesse hat (1280x720).
  const buf = readFileSync(resolve(ROOT, "assets/video/ref/gurt-front-720.jpg"));
  form.append("input_reference", new Blob([buf], { type: "image/jpeg" }), "start.jpg");
  const res = await fetch("https://api.openai.com/v1/videos", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Sora HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  let job = await res.json();
  while (job.status === "queued" || job.status === "in_progress") {
    await new Promise((r) => setTimeout(r, 10000));
    job = await (await fetch(`https://api.openai.com/v1/videos/${job.id}`, { headers: { Authorization: `Bearer ${key}` } })).json();
  }
  if (job.status !== "completed") throw new Error(`Sora: ${JSON.stringify(job).slice(0, 400)}`);
  const vid = await fetch(`https://api.openai.com/v1/videos/${job.id}/content`, { headers: { Authorization: `Bearer ${key}` } });
  writeFileSync(resolve(ROOT, OUT("sora")), Buffer.from(await vid.arrayBuffer()));
  console.log("ok", OUT("sora"));
}

mkdirSync(resolve(ROOT, "assets/video/ref"), { recursive: true });
const mode = process.argv[2];
if (mode === "veo") await veo();
else if (mode === "sora") await sora();
else console.log("Aufruf: node scripts/gen-kontraktion-subtil.mjs veo|sora");
