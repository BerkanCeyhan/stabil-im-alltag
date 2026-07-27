#!/usr/bin/env node
/**
 * Bilder für das neue Schwangerschafts-Quiz (Nano Banana Pro).
 *   node scripts/gen-rektus-v2.mjs
 * - rektus-anatomie: Erklärgrafik Rektusdiastase (Linea alba, verbreiterte Lücke), 1:1
 * - ergebnis-vorher / ergebnis-nachher: dieselbe Frau, subtile Alltagsmotive, 3:4
 *   (nachher trägt den Wellenpuls-Gurt korrekt, PackShot als Referenz)
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

const PHOTO = "Fotorealistisch, hell und warm, natürliche Fensterbeleuchtung, weiche Farben, authentisch und nahbar, geringe Schärfentiefe, kein Text, kein Logo, Hochformat 3:4. ";

const JOBS = [
  { name: "rektus-anatomie", aspect: "1:1", prompt:
    "Ruhige, hochwertige medizinische Erklär-Illustration im flachen Vektorstil, warme creme-rosé Palette, klare dünne Konturen, heller Hintergrund, kein Text, keine Buchstaben, keine Zahlen, quadratisch 1:1. Frontale schematische Ansicht eines weiblichen Rumpfes von der Brust bis zum Becken. Deutlich sichtbar die beiden senkrechten geraden Bauchmuskelstränge (Rectus abdominis) links und rechts, dazwischen die Mittellinie (Linea alba). In der Bauchmitte, oberhalb und unterhalb des Bauchnabels, ist der Abstand zwischen den beiden Muskelsträngen sichtbar verbreitert, eine erkennbare längliche Lücke. Anatomisch verständlich, ruhig und freundlich, nicht klinisch-kalt." },
  { name: "ergebnis-vorher", aspect: "3:4", prompt: PHOTO +
    "Eine sympathische Frau Anfang 30 mit schulterlangem braunem Haar steht in einem hellen, warmen Wohnzimmer und legt eine Hand auf ihren unteren Rücken, die andere ruht an der weichen Bauchmitte. Ihr Ausdruck ist leicht angestrengt und nachdenklich. Natürliche postpartale Körperform, vollständig bekleidet in bequemer Alltagskleidung, helles T-Shirt und dunkle Hose. Kein Produkt, kein Gerät." },
  { name: "ergebnis-nachher", aspect: "3:4", attachFrom: 1, attachFile: "assets/PackShot_01.png", prompt: PHOTO +
    "Dieselbe Frau wie in der ersten Referenz (identisches Gesicht, gleiches braunes schulterlanges Haar, gleiche Person), im selben hellen Wohnzimmer. Sie steht jetzt aufrecht, sicher und gelassen und wirkt aktiv im Alltag. Sie trägt den abgebildeten schwarzen Wellenpuls-Gurt aus der zweiten Referenz korrekt und eng um die Körpermitte, über einem leicht hochgezogenen hellen Oberteil, das runde Bedienteil vorne mittig sichtbar. Natürliche postpartale Körperform, keine extreme Veränderung, glaubwürdig und ruhig." },
];

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  const results = [];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    const attach = [];
    if (typeof j.attachFrom === "number" && results[j.attachFrom]) attach.push(results[j.attachFrom]);
    if (j.attachFile) attach.push(j.attachFile);
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}${attach.length ? ", +ref" : ""}) via ${model} ... `);
        const { b64, mime } = await generate(model, j.prompt, j.aspect, attach, key);
        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const rel = `assets/rektus/${j.name}.${ext}`;
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
