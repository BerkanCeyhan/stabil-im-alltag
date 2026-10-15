#!/usr/bin/env node
/**
 * Statics v3 fuer die Kampagnen Ruecken und Eltern (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-statics-2026-10-v3.mjs              # alle Jobs, eine Variante je Seed
 *   node scripts/gen-statics-2026-10-v3.mjs e-03 r-02    # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * Aenderungen gegenueber v2 (Feedback 13.10. nachmittags):
 * - Das Bedienteil sass in v2 mittig auf dem Bauch. Am echten Gurt sitzt es vorn auf der rechten
 *   Koerperseite, ueber dem rechten Hueftknochen, eine Handbreite neben dem Bauchnabel. Ueber dem
 *   Bauchnabel liegt die glatte Verschlusslasche mit Metallbuegel.
 * - Referenzen sind jetzt Fotos vom Gurt am Koerper statt Produktbildern:
 *   Christians Anleitungsvideo (vorn rechts), Shabnam (Gurt unter dem Shirt, seitlich angehoben),
 *   Ilona (von hinten). Liegen in assets/video/ref/getragen/.
 * - Weniger Haut: Der Gurt wird unter der Kleidung getragen. Das Oberteil wird nur an der rechten
 *   Seite ein Stueck angehoben, damit Bedienteil und Schriftzug zu sehen sind. Kein nackter Bauch,
 *   kein Bauchnabel, kein Unterhemd hochgerollt.
 * - r-03 ist gestrichen. r-01 bleibt aus v2.
 *
 * Ausgabe: assets/ads/2026-10/v3/roh/<name>-<seed>.jpg (Rohbild ohne Logo)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/2026-10/v3/roh";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODEL = "gemini-3.1-flash-image";

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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.2, seed, imageConfig: { aspectRatio: aspect } },
  };
  const post = () =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  let res = await post();
  if (res.status === 400) {
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await post();
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error("keine Bilddaten");
  return out.inlineData.data;
}

/* ------------------------------------------------------------------ *
 * Referenzen und Bausteine
 * ------------------------------------------------------------------ */

const G = "assets/video/ref/getragen";
const REF_WORN_FRONT = `${G}/vorn-rechts.jpg`;   // echt: Christian, Bedienteil vorn rechts, Lasche ueber dem Nabel
const REF_WORN_SHIRT = `${G}/unter-shirt.jpg`;   // echt: Shabnam, Gurt unter dem Shirt, rechts angehoben
const REF_WORN_BACK = `${G}/hinten-ilona.jpg`;   // echt: Ilona von hinten, Klettfleck links, Schriftzug rechts
const REF_CONTROL = "assets/video/ref/bedienteil.jpg"; // echt: Bedienteil nah
const REF_LOGO = "assets/logo_wellenpuls.png";
const REFS = [REF_WORN_FRONT, REF_WORN_SHIRT, REF_WORN_BACK, REF_CONTROL, REF_LOGO];

const REFNOTE =
  "Reference images, all real photos of the real Wellenpuls LWS training belt being worn: " +
  "image 1 shows the belt from the wearer's front right, with the oval control unit on the wearer's right side above the hip " +
  "and the plain black closure flap with a metal buckle bar over the navel. " +
  "Image 2 shows how it is worn in everyday life: under a normal T-shirt, the hem lifted only at the wearer's right side to show the control unit. " +
  "Image 3 shows it from behind: striped back panel, round dark patch on the left, white wordmark on the right. " +
  "Image 4 is a close-up of the control unit. Image 5 is the logo; the small wordmark on the belt looks like it, in white. " +
  "Copy the belt and the way it sits on the body exactly from these photos. ";

// Wie der Gurt sitzt. Muss in jedem Bild mit Produkt exakt stimmen.
const BELT =
  "The belt is about 15 cm tall, black, worn around the waist between the lowest ribs and the top of the hip bones, " +
  "directly on the skin underneath the clothing, with its lower edge a finger's width above the trouser waistband. Never over clothing, never on the trousers. " +
  "Front of the belt: the control unit is a HORIZONTAL oval, about twice as wide as tall, lying flat along the belt (polished silver rim, dark glass face, power symbol at the top, minus left, plus right, " +
  "three small heat waves at the bottom, four short red light bars forming an X in the middle; about 10 cm wide and only about one third of the belt's height) sits on the wearer's RIGHT side of the belly, " +
  "directly above the right hip bone, about a hand's width away from the navel towards the side of the body. It is NOT in the centre of the belly. " +
  "The navel is covered by the plain smooth black closure flap, which ends on the wearer's left side at a thin vertical metal buckle bar. " +
  "Between the control unit and the wearer's right flank, fine curved light-grey stripes and the small white 'Wellenpuls' wordmark. " +
  "From behind: wide striped panel over the spine, round dark patch left of the spine, wordmark right. " +
  "No wires, no extra buttons, no other logos, no other device. ";

// Laterale Lage in Bildkoordinaten. "Rechte Koerperseite" verwechselt das Modell oft, "im Bild links" nicht.
const FRONT_LAYOUT =
  "The person's body faces the camera, so the wearer's right side is on the LEFT of the image. " +
  "Along the belt, from the left of the image to the right: curved light-grey stripes with the small white wordmark at the person's side, " +
  "then the oval silver control unit, then the plain smooth black flap over the navel, ending at a thin vertical metal bar " +
  "just to the right of the navel in the image. So the control unit is clearly in the LEFT half of the person's belly as seen in the image, " +
  "exactly as in reference image 1. ";

// Weniger Haut: Kleidung bleibt an, nur rechts angehoben.
const COVERED =
  "Modest and natural: the person stays dressed. The top hangs down normally over most of the belt; only at the wearer's right side " +
  "the hem is lifted or tucked up by a few centimetres, just enough to show the control unit and a bit of the belt next to it. " +
  "No bare belly, the navel is not visible, no rolled-up shirt, no undershirt pulled up, no bare back. ";

// Realismus nach dem Prompt-Guide: Handyfoto mit Kamerafehlern, echte Haut.
const PHONE =
  "Phone photo, handheld, slight softness and a little noise, the light the room would have, real skin with pores and a bit of shine, " +
  "flat true colours with shadows a bit grey rather than black, framing slightly off, caught a second too early, no filter, no retouching. ";
const FILM =
  "35mm film photo, natural light, gentle grain, soft contrast, colours slightly faded, an unposed moment, no digital sharpening, " +
  "real skin with visible pores and fine lines, no beauty retouching. ";
const BODY = "Real, ordinary, non-athletic body. Not a model, no gym setting. ";

// Poster-Layout wie v2 (Bodify-Muster in unseren Farben).
const POSTER =
  "Social media advertising poster, vertical 4:5. Background: a smooth vertical gradient from deep navy blue (#0f2740) at the top " +
  "to a slightly lighter steel blue (#1f4a6e) at the bottom, no texture, no pattern. ";
const PHOTO_AD =
  "Social media advertising photo, vertical 4:5, full-bleed photograph with a soft dark navy gradient overlay on the top third " +
  "so the headline is readable. ";
const MARKER = (lines) =>
  "In the upper left area, starting at about 9 percent from the top and 7 percent from the left edge, a headline set in a heavy, " +
  "bold condensed sans-serif in dark navy (#0f2740). Each line sits on its own solid mint-green (#86dcb8) highlight rectangle " +
  "that hugs the text like marker highlighting, with small even padding. Each line is approximately one eleventh of the image height. " +
  `There are exactly ${lines.length} lines, reading exactly, line by line: ` +
  lines.map((l, i) => `line ${i + 1}: ${l}`).join("; ") +
  ". Keep the top right corner free of text. ";
const FOOT = (a, b) =>
  "In the lower left area, about 8 percent from the bottom, two short lines of white text in a clean bold sans-serif. " +
  `The first line, about one twentieth of the image height, reads exactly: ${a}. ` +
  `The second line, thinner and about half that size, reads exactly: ${b}. `;
const ONLY_NOPRODUCT =
  "No other text anywhere, no brand names, no product, no device, no belt, no extra numbers, no icons, no arrows, no badges, no watermark. ";
const ONLY =
  "No other text anywhere, no brand name written in the image apart from the small wordmark printed on the belt itself, " +
  "no extra numbers, no icons, no arrows, no badges, no watermark. ";

/* ------------------------------------------------------------------ *
 * Jobs (nur Motive mit Produkt am Koerper; r-01, Preis- und p-Motive bleiben aus v2)
 * ------------------------------------------------------------------ */

const JOBS = [
  {
    name: "r-02-gurt-an-fernseher-an",
    // Das Modell setzt das Bedienteil dorthin, wo eine Hand drueckt, und legt die Fernbedienung gern in die Hand im Bild links.
    // Darum hier keine drueckende Hand: Fernbedienung links, Saum links hochgeschoben, die andere Hand liegt auf der Lehne.
    seeds: [6182, 6192, 6202, 6212],
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a lived-in German living room in the evening, a floor lamp on, bluish TV light on her face. " +
      "A woman of about 62 with shoulder-length grey-blonde hair sits upright on a light grey sofa, body facing the camera, " +
      "her head turned a little towards the TV off frame, a calm, content half smile. She wears a loose light grey knitted jumper and dark jeans. " +
      "Her right hand (on the LEFT of the image) rests on her thigh holding a TV remote. Her left arm (on the RIGHT of the image) lies relaxed on the sofa armrest. " +
      "On the LEFT of the image, at her hip just above the hand with the remote, the jumper hem is pushed up a few centimetres and shows the control unit " +
      "with its red lights; to the right of it the jumper hangs down over the rest of the belt. Nobody touches the control unit. " +
      "Camera at seated eye level, straight on, about two metres away, she fills the lower two thirds of the frame. " +
      PHONE + BODY + BELT + FRONT_LAYOUT + COVERED + MARKER(["Gurt an.", "Fernseher an."]) +
      FOOT("Rückentraining im Sitzen", "20 Minuten, zweimal pro Woche") + ONLY,
  },
  {
    name: "r-04-im-sitzen",
    seeds: [6104, 6114, 6124, 6134, 6144],
    prompt:
      REFNOTE + POSTER + MARKER(["Rücken", "trainieren.", "Im Sitzen."]) +
      "Below the headline on the left, three short lines of white text in a clean bold sans-serif, each about one twenty-fifth of the image height, " +
      "stacked with generous spacing, reading exactly: line 1: Gurt anlegen; line 2: Stufe wählen; line 3: 20 Minuten sitzen. " +
      "On the right half, a photographic cut-out of a woman of about 60 with short dark hair and glasses, seated in a simple grey armchair, " +
      "cleanly composited onto the gradient, seen from her front right. She wears a loose white T-shirt and dark trousers. " +
      "With her left hand she lifts the T-shirt hem a little at her right hip; with her right index finger she presses the plus button " +
      "on the oval control unit, which sits on the belt above her right hip bone, and she looks down at it with a small, focused smile. " +
      FILM + BODY + BELT + COVERED +
      FOOT("Wellenpuls LWS", "30 Tage Geld-zurück-Garantie") + ONLY,
  },
  {
    name: "e-01-papa-rueckenuebungen",
    seeds: [6221, 6231, 6241],
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a tidy, slightly old-fashioned German living room in the afternoon, a dark wooden cabinet, net curtains, window light from the left, " +
      "the corner of the room a bit dark. A man of about 74 with thinning white hair and big worn hands sits in a brown leather armchair, " +
      "body facing the camera, an open newspaper resting on his left thigh (on the right of the image), looking up over his reading glasses " +
      "with a dry, amused half smile, caught mid sentence. He wears a beige checked flannel shirt, untucked, over grey trousers. " +
      "The shirt hangs down over most of the belt; on the left of the image, at his right hip, the hem has ridden up a little, showing the control unit " +
      "with its red lights. Camera at seated eye level, straight on, about two metres away, he fills the lower two thirds of the frame. " +
      PHONE + BODY + BELT + FRONT_LAYOUT + COVERED + MARKER(["Papa macht", "seine Rückenübungen", "nicht?"]) +
      FOOT("Rückentraining im Sessel", "Für Ihre Eltern. 30 Tage Geld-zurück-Garantie.") + ONLY,
  },
  {
    name: "e-02-vier-tasten",
    seeds: [6202, 6212, 6222, 6232],
    prompt:
      REFNOTE + POSTER + MARKER(["Vier Tasten.", "Kein Handy.", "Keine App."]) +
      "In the lower two thirds, a photographic close-up with soft rounded corners, composited onto the gradient, framed like reference image 1: " +
      "the right side of the waist of a woman of about 72, seen from her front right. She wears a soft lilac cardigan over a white top. " +
      "With her left hand she lifts the hem of the top a little at her right hip, showing the belt; the oval control unit sits above her right hip bone, " +
      "exactly as in reference images 1 and 4, and her right index finger, with visible age spots and a plain gold wedding ring, presses the plus button. " +
      "To the left of the control unit in the image, the curved stripes and the small white wordmark run towards her side. " +
      "The four buttons and the red lights are sharp. Mature skin with fine creases, only a narrow strip of skin above and below the belt. " +
      "Soft window daylight, slight softness at the edges. " +
      PHONE + BELT + COVERED +
      FOOT("So einfach, dass Mama es allein schafft", "30 Tage Geld-zurück-Garantie") + ONLY,
  },
  {
    name: "e-03-fuer-mama",
    seeds: [6223, 6233, 6243],
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a bright, cosy German living room in the morning, window light from the left. A woman of about 72 with short white hair sits in a blue armchair " +
      "in the right half of the image, body facing the camera, smiling warmly down at her daughter. She wears a soft beige knitted jumper over light trousers. " +
      "The daughter, about 45, brown ponytail, denim shirt, kneels on the LEFT of the image beside the armchair, at her mother's right side, " +
      "holding the jumper hem up a few centimetres at her mother's hip with one hand and pressing the plus button on the control unit with the other, " +
      "looking up at her mother; a light, affectionate moment, caught a second before both laugh. " +
      "The control unit is on the side of the mother's belly nearest to the daughter, on the left of the image; the rest of the jumper hangs down over the belt. " +
      "Camera at seated eye level, straight on, about two metres away. " +
      PHONE + BODY + BELT + FRONT_LAYOUT + COVERED + MARKER(["Für Mama.", "Ganz ohne", "Rückenübungen."]) +
      FOOT("Vier Tasten, keine App", "30 Tage Geld-zurück-Garantie") + ONLY,
  },
  /* ---------- Ohne Produkt, nach Christians Feedback (14.10.): "Geht schon" braucht einen Bezug zum Ruecken ---------- */
  {
    name: "p-e-01-geht-schon",
    seeds: [6401, 6411, 6421],
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: a German living room on a winter Sunday afternoon, grey window light, a brown leather armchair. A man of about 74 with thinning white hair, " +
      "in a beige cardigan, is getting up out of the armchair: one hand pushes down on the armrest, the other hand is pressed flat into the small of his back, " +
      "his upper body still bent forward, his face tight with the effort, eyes half closed, caught halfway up. It is obvious that his lower back hurts. " +
      "In the foreground, out of focus at the left edge of the frame, the shoulder and arm of his adult son standing in the doorway. " +
      "Shot from the doorway at standing height, the man in the lower half of the frame. " +
      PHONE + BODY + MARKER(["„Geht schon“,", "sagt Papa.", "Sein Rücken sagt", "etwas anderes."]) +
      FOOT("Ein Sohn erzählt", "was am Ende wirklich geholfen hat") + ONLY_NOPRODUCT,
  },
];

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });
const tasks = [];
for (const j of JOBS.filter((j) => !only.length || only.some((o) => j.name.startsWith(o)))) {
  j.seeds.forEach((seed) => tasks.push({ ...j, seed, rel: `${OUTDIR}/${j.name}-${seed}.jpg` }));
}
await Promise.all(
  tasks.map(async (t) => {
    try {
      const b64 = await generate(t.prompt, "4:5", t.attach || REFS, key, t.seed);
      writeFileSync(resolve(ROOT, t.rel), Buffer.from(b64, "base64"));
      console.log("ok", t.rel);
    } catch (e) {
      console.log("FEHLER", t.rel, e.message);
    }
  })
);
