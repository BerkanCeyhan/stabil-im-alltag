#!/usr/bin/env node
/**
 * Problem-aware Ad-Motive für die Rektusdiastase-Funnels mit Nano Banana Pro.
 *   node scripts/gen-rektus-ads.mjs
 * Voraussetzung: GEMINI_API_KEY in .env
 *
 * 4 Ads (2 Zielgruppen x 2 Angles), 4:5, hell, ohne Produkt, kurzer deutscher
 * Hook-Text im Bild. Dazu ein Produkt-Attach-Test (nutzt PackShot als Referenz).
 * Ausgabe: rektusdiastase/ads/
 * Copy (Primary Text + Headlines) steht in rektusdiastase/ads/ADS.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "rektusdiastase/ads");

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

const STYLE =
  "Fotorealistische, helle und warme Lifestyle-Aufnahme, natürliche Fensterbeleuchtung, weiche Farben, " +
  "authentisch und nahbar, dokumentarischer Look. Kein Produkt, keine Geräte, keine Gurte, keine Elektronik. " +
  "Oben im Bild viel ruhiger Freiraum für einen kurzen Text. Hochformat 4:5. ";

const TEXT =
  "Oben im Bild ein einziger, kurzer, gut lesbarer deutscher Text in kräftiger serifenloser Schrift, exakt so geschrieben: ";

const JOBS = [
  { name: "ad-schwangerschaft-aesthetic", aspect: "4:5", prompt: STYLE +
    "Eine sympathische Frau Anfang 30 steht seitlich in einem hellen Schlafzimmer und betrachtet nachdenklich ihre weiche Bauchmitte, eine Hand ruht locker darauf. Sie trägt ein schlichtes helles Oberteil, das den Bauch frei lässt. Ruhige, verständnisvolle Stimmung. " +
    TEXT + "\"Bauch wie im 5. Monat?\". Kein weiterer Text im Bild." },
  { name: "ad-schwangerschaft-stability", aspect: "4:5", prompt: STYLE +
    "Eine Frau Anfang 30 hält ihr Kleinkind auf dem Arm und stützt mit der freien Hand unauffällig ihren unteren Rücken, helles Wohnzimmer, warmer Moment. " +
    TEXT + "\"Rücken schwach seit der Geburt?\". Kein weiterer Text im Bild." },
  { name: "ad-menopause-aesthetic", aspect: "4:5", prompt: STYLE +
    "Eine souveräne Frau um die 55 mit grauem Bob steht seitlich in einem hellen, edlen Raum und legt eine Hand auf ihre weicher gewordene Bauchmitte, ruhiger, nachdenklicher Blick zur Seite. Schlichtes helles Oberteil. " +
    TEXT + "\"Bauch weicher in den Wechseljahren?\". Kein weiterer Text im Bild." },
  { name: "ad-menopause-stability", aspect: "4:5", prompt: STYLE +
    "Eine aktive Frau um die 55 in schlichter Sportkleidung pausiert bei einem Spaziergang im hellen Park und legt eine Hand auf ihren unteren Rücken, freundliches Tageslicht. " +
    TEXT + "\"Instabile Mitte ab 50?\". Kein weiterer Text im Bild." },
  // Produkt-Attach-Test (kein reales Ad-Motiv, nur um die Bild-Referenz zu prüfen)
  { name: "_test-produkt-attach", aspect: "4:5", attachFile: "assets/PackShot_01.png", prompt:
    "Fotorealistisch, hell und warm. Eine Frau um die 50 sitzt entspannt auf einem hellen Sofa und trägt den abgebildeten schwarzen Wellenpuls-Gurt aus der Referenz eng um die Körpermitte über einem hochgezogenen hellen Oberteil. Kein Text. Hochformat 4:5." },
];

async function main() {
  const key = loadKey();
  mkdirSync(OUT, { recursive: true });
  for (const j of JOBS) {
    const attach = j.attachFile ? [j.attachFile] : [];
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}${attach.length ? ", +ref" : ""}) via ${model} ... `);
        const { b64, mime } = await generate(model, j.prompt, j.aspect, attach, key);
        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const rel = `rektusdiastase/ads/${j.name}.${ext}`;
        writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
        console.log(`ok -> ${rel}`);
        done = true;
        break;
      } catch (e) { console.log(`fehlgeschlagen: ${e.message}`); }
    }
    if (!done) console.error(`!! ${j.name} nicht erzeugt`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
