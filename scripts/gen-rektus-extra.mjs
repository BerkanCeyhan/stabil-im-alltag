#!/usr/bin/env node
/**
 * Zusatzbilder für die Rektusdiastase-Quizzes (Nano Banana Pro).
 *   node scripts/gen-rektus-extra.mjs
 * - hero-schwangerschaft / hero-menopause: helle Problembilder für die erste Quizseite (1:1, kein Text)
 * - luecke-unknown: passendes Bild für die Option "noch nie gemessen" (unschlüssige Hand)
 * Ausgabe: assets/rektus/
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
// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELS = ["gemini-3.1-flash-image"];
async function generate(model, prompt, aspect, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } }),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error(`${model} keine Bilddaten`);
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

const PHOTO = "Fotorealistisch, hell und warm, natürliche Fensterbeleuchtung, weiche Farben, authentisch und nahbar, geringe Schärfentiefe, kein Text, keine Schrift, kein Produkt, quadratisch 1:1. ";

const JOBS = [
  { name: "hero-schwangerschaft", aspect: "1:1", prompt: PHOTO +
    "Eine sympathische Frau Anfang 30 sitzt in einem hellen Schlafzimmer auf der Bettkante und blickt ruhig an sich herunter auf ihre weiche Bauchmitte nach der Geburt, beide Hände liegen sanft seitlich am Bauch. Sie trägt ein leicht hochgezogenes helles Oberteil. Ehrliche, warme, verständnisvolle Stimmung." },
  { name: "hero-menopause", aspect: "1:1", prompt: PHOTO +
    "Eine souveräne Frau um die 55 mit grauem Bob steht seitlich an einem hellen Fenster und legt beide Hände ruhig auf ihre Bauchmitte, nachdenklicher Blick nach unten. Schlichtes helles Leinenoberteil, edler heller Raum. Ruhige, würdevolle Stimmung." },
  { name: "luecke-unknown", aspect: "1:1", prompt:
    "Ruhige medizinische Illustration im flachen Vektorstil, warme creme-rosé Palette, klare dünne Konturen, heller Hintergrund, kein Text, keine Buchstaben, quadratisch 1:1. Aufsicht von schräg oben auf die Bauchmitte einer auf dem Rücken liegenden Frau, Bauchnabel sichtbar. Eine geöffnete Hand schwebt unschlüssig einige Zentimeter über der Bauchmitte, ohne sie zu berühren, die Finger sind gespreizt und zögern. Über der Hand schwebt ein einzelnes, weiches, rundes Fragezeichen-Symbol aus dünnen Linien. Ruhige, freundliche Bildsprache." },
];

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  for (const j of JOBS) {
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}) via ${model} ... `);
        const { b64, mime } = await generate(model, j.prompt, j.aspect, key);
        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const rel = `assets/rektus/${j.name}.${ext}`;
        writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
        console.log(`ok -> ${rel}`);
        done = true; break;
      } catch (e) { console.log(`fehlgeschlagen: ${e.message}`); }
    }
    if (!done) console.error(`!! ${j.name} nicht erzeugt`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
