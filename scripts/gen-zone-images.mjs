#!/usr/bin/env node
/**
 * Generiert die Bild-Highlights für Frage 2 (Schmerz-Zone) im Rücken-Check-Quiz
 * mit Nano Banana Pro (Gemini 3 Pro Image) über die generateContent-REST-API.
 *
 * Nutzung:  node scripts/gen-zone-images.mjs
 * Voraussetzung: GEMINI_API_KEY in .env
 *
 * Ausgabe:  assets/quiz/zone-<key>.png  (quadratisch 1:1, mobil-optimiert)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// Modelle in Reihenfolge probieren (Nano Banana Pro -> Fallbacks).
// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELS = ["gemini-3.1-flash-image"];

const STYLE =
  "Redaktionelle, ruhige Medizin-Illustration in warmem, vertrauenswürdigem Stil. " +
  "Rückansicht (leicht schräg) des Oberkörpers und unteren Rückens einer gesunden Person um die 55 Jahre, " +
  "aufrecht stehend, schlichter warm-cremefarbener Studiohintergrund, weiches Tageslicht, " +
  "gedämpfte Farbpalette mit sanften Blau- und Petrol-Akzenten einer seriösen Gesundheitsmarke. " +
  "Kein Text, keine Buchstaben, keine Logos, keine Wasserzeichen, minimalistisch und sauber. " +
  "Der untere Rücken steht klar im Fokus, quadratischer 1:1-Bildausschnitt, Motiv zentriert, mobil-optimiert, hohe Qualität. ";

const HIGHLIGHT =
  "Ein weiches, halbtransparentes warm-rotes bis oranges Wärme-Glühen (wie eine sanfte Thermografie-Markierung) " +
  "kennzeichnet AUSSCHLIESSLICH die betroffene Stelle, dezent leuchtend, ohne den Rest des Rückens einzufärben: ";

const ZONES = {
  mid: "mittig im unteren Rücken, direkt oberhalb des Beckens, entlang der Wirbelsäule.",
  side: "seitlich in den Flanken des unteren Rückens, links und rechts neben der Wirbelsäule.",
  band: "als breites waagerechtes Band, das quer über den gesamten Lendenbereich verläuft wie ein Gürtel.",
  radiate: "vom unteren Rücken ausstrahlend nach unten in eine Gesäßhälfte und den oberen Oberschenkel.",
};

async function generate(model, prompt, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${model} -> HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error(`${model} -> keine Bilddaten in Antwort`);
  return { b64: img.inlineData.data, mime: img.inlineData.mimeType || "image/png" };
}

async function main() {
  const key = loadKey();
  const outDir = resolve(ROOT, "assets/quiz");
  mkdirSync(outDir, { recursive: true });

  for (const [zone, desc] of Object.entries(ZONES)) {
    const prompt = STYLE + HIGHLIGHT + desc;
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`zone "${zone}" via ${model} ... `);
        const { b64, mime } = await generate(model, prompt, key);
        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const file = resolve(outDir, `zone-${zone}.${ext}`);
        writeFileSync(file, Buffer.from(b64, "base64"));
        console.log(`ok -> assets/quiz/zone-${zone}.${ext} (${mime})`);
        done = true;
        break;
      } catch (e) {
        console.log(`fehlgeschlagen: ${e.message}`);
      }
    }
    if (!done) console.error(`!! zone "${zone}" konnte nicht erzeugt werden`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
