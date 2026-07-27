#!/usr/bin/env node
/**
 * Bilder für die Rektusdiastase-Funnels mit Nano Banana Pro (Gemini 3 Pro Image).
 *   node scripts/gen-rektus-images.mjs
 * Voraussetzung: GEMINI_API_KEY in .env
 *
 * Erzeugt (assets/rektus/):
 *   - selbsttest-1..4.*  (1:1, WikiHow-Schritte, verkettet für gleichbleibende Figur)
 *   - luecke-1..3.*      (1:1, Lückenbreite ein/zwei/drei Finger)
 *   - anwendung-postpartum.* / anwendung-menopause.* (3:4, mit PackShot als Geräte-Referenz)
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
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}
// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELS = ["gemini-3.1-flash-image"];

function fileToPart(path) {
  const abs = resolve(ROOT, path);
  const buf = readFileSync(abs);
  const ext = abs.split(".").pop().toLowerCase();
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
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
    }),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error(`${model} keine Bilddaten`);
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

const SELF_STYLE =
  "Moderne, ruhige medizinische Aufklärungs-Illustration im flachen Vektorstil. " +
  "Eine Frau Anfang 30 mit hellem Trägertop und dunkler Leggings, freundlich, natürliche Proportionen. " +
  "Warme creme-rosé Farbpalette, weiche pastellige Flächen, klare dünne Konturen, viel heller Negativraum. " +
  "Kein Text, keine Buchstaben, keine Zahlen, keine Logos. Quadratisch 1:1, klare zentrale Komposition, mobil gut lesbar. ";

const GAP_STYLE =
  "Ruhige medizinische Illustration im flachen Vektorstil, warme creme-rosé Palette, klare dünne Konturen, " +
  "heller Hintergrund, kein Text, keine Zahlen, keine Logos, quadratisch 1:1. " +
  "Aufsicht von schräg oben auf die Bauchmitte einer auf dem Rücken liegenden Frau, Bauchnabel sichtbar, " +
  "die beiden senkrechten geraden Bauchmuskelstränge angedeutet, dazwischen die Mittellinie. ";

const APP_STYLE =
  "Fotorealistisch, weiche natürliche Fensterbeleuchtung, warmer heller Wohnraum, ruhige vertrauenswürdige Stimmung, " +
  "hochwertige Kameraoptik, angenehme geringe Schärfentiefe, keine Texteinblendung. Hochformat 3:4. ";

const JOBS = [
  // Selbsttest, Schritt 1 ohne Referenz
  { name: "selbsttest-1", aspect: "1:1", prompt: SELF_STYLE +
    "Die Frau liegt entspannt auf dem Rücken auf einer Yogamatte, beide Knie angewinkelt, Füße flach auf dem Boden, Arme seitlich abgelegt. Seitliche Ansicht von leicht schräg oben, ruhige Ausgangsposition." },
  // Schritte 2-4 mit Schritt 1 als Referenz -> gleiche Figur/Stil
  { name: "selbsttest-2", aspect: "1:1", attachFrom: 0, prompt: SELF_STYLE +
    "Identische Frau, identischer Stil und identische Szene wie in der Referenz. Sie liegt auf dem Rücken mit angewinkelten Knien und legt zwei Finger einer Hand flach längs auf die Mitte ihres Bauches, knapp oberhalb des Bauchnabels. Näherer Fokus auf Bauch und Hand." },
  { name: "selbsttest-3", aspect: "1:1", attachFrom: 0, prompt: SELF_STYLE +
    "Identische Frau, identischer Stil und identische Szene wie in der Referenz. Sie hebt Kopf und Schultern nur leicht vom Boden an, die Bauchmuskeln spannen sich sichtbar an, zwei Finger liegen weiter flach auf der Bauchmitte oberhalb des Nabels." },
  { name: "selbsttest-4", aspect: "1:1", attachFrom: 0, prompt: SELF_STYLE +
    "Identische Frau, identischer Stil und identische Szene wie in der Referenz. Nahaufnahme der Bauchmitte von schräg oben: zwei Finger sinken in eine schmale Längsrille zwischen den beiden Bauchmuskelsträngen oberhalb des Nabels, um den Abstand zu ertasten." },
  // Lückenbreite
  { name: "luecke-1", aspect: "1:1", prompt: GAP_STYLE +
    "Zwischen den beiden Bauchmuskelsträngen liegt eine sehr schmale Lücke von etwa einer Fingerbreite. Eine Hand legt einen einzelnen Finger längs in die schmale Rille oberhalb des Nabels." },
  { name: "luecke-2", aspect: "1:1", attachFile: "assets/rektus/luecke-1.jpg", prompt: GAP_STYLE +
    "Identischer Stil, gleiche Perspektive, gleiche Frau und gleiche Bauchdarstellung wie in der Referenz. " +
    "Zwischen den beiden Bauchmuskelsträngen liegt eine schmale Lücke von etwa zwei Fingerbreiten. Eine Hand legt zwei Finger nebeneinander längs in die schmale Rille oberhalb des Nabels." },
  { name: "luecke-3", aspect: "1:1", prompt: GAP_STYLE +
    "Zwischen den beiden Bauchmuskelsträngen liegt eine breite Lücke von etwa drei bis vier Fingerbreiten. Eine Hand legt drei Finger nebeneinander längs in die breite Rille oberhalb des Nabels, die Bauchmitte wölbt sich dabei leicht vor." },
  // Anwendung, mit PackShot als Referenz
  { name: "anwendung-postpartum", aspect: "3:4", attachFile: "assets/PackShot_01.png", prompt: APP_STYLE +
    "Eine sympathische Frau Anfang 30 sitzt entspannt auf einem hellen Sofa und trägt den abgebildeten schwarzen Wellenpuls-Gurt aus der Referenz eng um die untere Bauchmitte über der Haut. Sie trägt ein leicht hochgezogenes helles T-Shirt und eine bequeme Hose, lächelt ruhig und schaut gelassen zur Seite. Der Gurt sitzt vorne mittig über dem Bauch, das runde Bedienteil ist erkennbar." },
  { name: "anwendung-menopause", aspect: "3:4", attachFile: "assets/PackShot_01.png", prompt: APP_STYLE +
    "Eine souveräne Frau um die 55 mit grauem Bob steht aufrecht in einem hellen, freundlichen Raum und trägt den abgebildeten schwarzen Wellenpuls-Gurt aus der Referenz eng um die Taille und untere Bauchmitte, über einem leicht hochgezogenen hellen Oberteil. Ruhiger, selbstbewusster Ausdruck, sie blickt freundlich in die Kamera." },
];

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2); // z.B. "node gen-rektus-images.mjs luecke-2"
  const results = [];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    if (only.length && !only.includes(j.name)) continue;
    const attach = [];
    if (j.attachFile) attach.push(j.attachFile);
    if (typeof j.attachFrom === "number" && results[j.attachFrom]) attach.push(results[j.attachFrom]);
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}${attach.length ? ", +ref" : ""}) via ${model} ... `);
        const { b64, mime } = await generate(model, j.prompt, j.aspect, attach, key);
        const rel = `assets/rektus/${j.name}.jpg`; // Quizzes referenzieren .jpg
        writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
        results[i] = rel;
        console.log(`ok -> ${rel}`);
        done = true;
        break;
      } catch (e) {
        console.log(`fehlgeschlagen: ${e.message}`);
      }
    }
    if (!done) { results[i] = null; console.error(`!! ${j.name} nicht erzeugt`); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
