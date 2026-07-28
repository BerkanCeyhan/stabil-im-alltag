#!/usr/bin/env node
/**
 * Bildmotive fuer die Google-Ads-PMax-Kampagne Creatin HCL
 * (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-gads-creatin.mjs                 # alle Jobs
 *   node scripts/gen-gads-creatin.mjs studio glas     # nur einzelne Motive
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * WAS HIER ANDERS IST ALS BEI DEN META-MOTIVEN
 *
 * Kein Text im Bild. Google setzt Titel und Beschreibung selbst darueber; ein
 * eingebrannter Claim kollidiert damit und zieht die Anzeigenstaerke nach
 * unten. Die Meta-Statics unter assets/ads/brustbizeps/ machen das Gegenteil
 * und sind fuer PMax deshalb nicht brauchbar.
 *
 * Drei Motive in je drei Seitenverhaeltnissen, weil PMax alle drei Formate
 * getrennt ausspielt:
 *   16:9  wird danach auf 1,91:1 beschnitten (MARKETING_IMAGE)
 *   1:1   SQUARE_MARKETING_IMAGE
 *   4:5   PORTRAIT_MARKETING_IMAGE
 *
 * gemini kennt kein 1,91:1. Deshalb 16:9 erzeugen und mit ffmpeg mittig auf
 * 1,91:1 beschneiden — siehe scripts/crop-191.sh.
 *
 * Ein Seed je Motiv, nicht je Job: so bleiben die drei Formate desselben
 * Motivs untereinander erkennbar dasselbe Bild.
 *
 * Motive absichtlich verschieden: Studio, Beweis, Alltag. PMax lernt ueber
 * Formate und Motive hinweg; drei Varianten derselben Bildidee bringen nichts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/brustbizeps/gads";
const REF = "assets/ads/brustbizeps/ref-hcl-dose.jpg";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELL = "gemini-3.1-flash-image";

function fileToPart(path) {
  const buf = readFileSync(resolve(ROOT, path));
  const ext = path.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

async function generate(prompt, aspect, attach, key, seed) {
  const parts = [];
  (attach || []).forEach((p) => parts.push(fileToPart(p)));
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: 0.15,
      seed,
      imageConfig: { aspectRatio: aspect },
    },
  };
  const ruf = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });

  let res = await ruf();
  if (res.status === 400) {
    // Manche Modellstaende nehmen seed/temperature nicht an -> ohne erneut.
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await ruf();
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error("keine Bilddaten in der Antwort");
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

/* Gilt fuer jedes Motiv. Der Satz zum Text steht doppelt, weil das Modell ihn
   sonst gelegentlich zugunsten eines Claims im Bild uebergeht. */
const REGELN = [
  "Fotorealistisch, Werbequalitaet, hohe Detailschaerfe, natuerliche Farben.",
  "Das Etikett der Dose exakt wie in der Referenz: mattschwarz, weisse Typografie,",
  "BRUSTBIZEPS und CREATIN-HCL lesbar, die vier Icon-Claims darunter.",
  "KEIN zusaetzlicher Text im Bild. Keine Headline, kein Claim, kein Preis, kein",
  "Wasserzeichen, kein Logo ausser dem auf der Dose selbst. Wirklich kein Text.",
  "Motiv mittig mit Luft zum Rand, weil Google das Bild je Platzierung beschneidet.",
  "Keine Personen, keine Haende.",
].join(" ");

const MOTIVE = [
  {
    id: "studio",
    seed: 730101,
    prompt:
      "Produktfoto der abgebildeten mattschwarzen Creatin-HCL-Dose, freistehend und zentriert " +
      "auf einem nahtlosen hellgrauen Studiohintergrund. Grossflaechiges weiches Softbox-Licht " +
      "von links oben, weicher Schlagschatten nach rechts unten, dezente Reflexion auf der " +
      "Standflaeche. Ruhig, hochwertig, aufgeraeumt. " + REGELN,
  },
  {
    id: "glas",
    seed: 730202,
    prompt:
      "Die abgebildete mattschwarze Creatin-HCL-Dose steht links im Bild. Rechts daneben ein " +
      "schlankes klares Trinkglas mit vollstaendig klarem Wasser, in dem sich das Pulver " +
      "rueckstandslos geloest hat: keine Schlieren, keine Kluempchen, kein Bodensatz, keine " +
      "Truebung. Davor ein kleiner Messloeffel mit feinem weissem Pulver. Heller, kuehler " +
      "Hintergrund, seitliches Licht, das die Klarheit des Wassers durchscheinen laesst. " + REGELN,
  },
  {
    id: "gym",
    seed: 730303,
    prompt:
      "Die abgebildete mattschwarze Creatin-HCL-Dose steht auf der schwarzen Polsterbank einer " +
      "Hantelbank in einem modernen, hellen Fitnessstudio. Daneben ein schwarzer Shaker. Im " +
      "unscharfen Hintergrund Hantelscheiben und eine Fensterfront. Natuerliches Seitenlicht, " +
      "geringe Schaerfentiefe, ruhige und hochwertige Anmutung, kein Gedraenge. " + REGELN,
  },
];

const FORMATE = [
  { suffix: "16x9", aspect: "16:9" }, // wird danach auf 1,91:1 beschnitten
  { suffix: "1x1", aspect: "1:1" },
  { suffix: "4x5", aspect: "4:5" },
];

const nur = process.argv.slice(2);
const key = loadKey();
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });

for (const m of MOTIVE) {
  if (nur.length && !nur.includes(m.id)) continue;
  for (const f of FORMATE) {
    const name = `hcl-${m.id}-${f.suffix}`;
    try {
      const { b64, mime } = await generate(m.prompt, f.aspect, [REF], key, m.seed);
      const ext = mime.includes("png") ? "png" : "jpg";
      const ziel = `${OUTDIR}/${name}.${ext}`;
      writeFileSync(resolve(ROOT, ziel), Buffer.from(b64, "base64"));
      console.log(`ok    ${ziel}`);
    } catch (e) {
      console.error(`FEHL  ${name}: ${e.message}`);
    }
  }
}
