#!/usr/bin/env node
/**
 * Statics v2 fuer die Kampagnen Ruecken und Eltern (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-statics-2026-10-v2.mjs              # alle Jobs
 *   node scripts/gen-statics-2026-10-v2.mjs r-01 p-e     # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * Aenderungen gegenueber v1 (Feedback 13.10.):
 * - Der Gurt muss exakt stimmen: breites Teil immer auf dem unteren Ruecken, direkt auf der
 *   nackten Haut statt auf der Kleidung, oberhalb des Hosenbunds. Von hinten: Streifen,
 *   runder Klettfleck links, weisser Schriftzug rechts, kein Bedienteil. Bedienteil vorn rechts
 *   vom Bauchnabel. Dafuer vier Referenzbilder in jedem Prompt (vorn, Seite, hinten, Logo).
 * - Kein generierter Markenname mehr im Bild. Das echte Logo setzt scripts/ads-logo.py danach
 *   klein oben rechts ein.
 * - Realismus-Bloecke (Handyfoto, Kamerafehler, echte Haut) statt Studio-Look.
 * - Texte nach Feedback: "Rueckenuebungen" statt "Uebungen", "30 Tage Geld-zurueck-Garantie".
 * - Neu: p-Motive ohne Produkt fuer Problem-Aware und Unaware, Ziel Advertorial.
 *
 * Ausgabe: assets/ads/2026-10/v2/<name>.jpg (Rohbild ohne Logo)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/2026-10/v2/roh";

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
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.15, seed, imageConfig: { aspectRatio: aspect } },
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

const REF_FRONT = "assets/video/ref/gurt-front.jpg";   // echt: Bedienteil vorn
const REF_SIDE = "assets/video/ref/gurt-seite.jpg";    // echt: Schriftzug seitlich, Bedienteil vorn
const REF_BACK = "assets/video/ref/gurt-hinten.jpg";   // Produktbild: Rueckseite mit Klettfleck und Schriftzug
const REF_LOGO = "assets/logo_wellenpuls.png";         // Logo
const REFS_ALL = [REF_FRONT, REF_SIDE, REF_BACK, REF_LOGO];

const REFNOTE =
  "The first reference images show the real Wellenpuls LWS training belt from the front, from the side and from behind. " +
  "The last reference image is the Wellenpuls logo; the wordmark printed on the belt looks exactly like it, in white. ";

// Wie der Gurt sitzt. Muss in jedem Bild mit Produkt exakt stimmen.
const BELT =
  "The belt must match the reference images exactly. It is about 15 cm tall, made of black fabric with fine horizontal light-grey pinstripes. " +
  "It is worn directly on bare skin, never over clothing: the shirt or top is lifted, rolled or tucked up above it so the belt is clearly on the skin. " +
  "It sits around the lower back and waist, between the waist and the top of the hip bones, completely above the trouser waistband, " +
  "never resting on or covering the trousers. The widest part of the belt is always on the lower back, centred over the spine. " +
  "Seen from behind: the wide striped panel, a smooth round dark patch slightly left of the spine, and the small white 'V Wellenpuls' wordmark " +
  "on the right side of the back. No control unit is visible from behind. " +
  "Seen from the front: the belt closes at the front, and the oval silver control unit with four small buttons " +
  "(power at the top, minus on the left, plus on the right, a heat symbol at the bottom) and small red indicator lights " +
  "sits on the front of the belly, slightly to the wearer's right of the navel. " +
  "No wires, no extra buttons, no other logos, no other device. ";

// Realismus nach dem Prompt-Guide: Handyfoto mit Kamerafehlern, echte Haut.
const PHONE =
  "Phone photo, handheld, slight softness and a little noise, the light the room would have, real skin with pores and a bit of shine, " +
  "flat true colours with shadows a bit grey rather than black, framing slightly off, caught a second too early, no filter, no retouching. ";
const FILM =
  "35mm film photo, natural light, gentle grain, soft contrast, colours slightly faded, an unposed moment, no digital sharpening, " +
  "real skin with visible pores and fine lines, no beauty retouching. ";
const BODY = "Real, ordinary, non-athletic body, a little softness at the waist. Not a fitness model, no gym setting. ";

// Poster-Layout nach dem Muster der Bodify-Statics, in unseren Farben.
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
const ONLY =
  "No other text anywhere, no brand name written in the image apart from the small wordmark printed on the belt itself, " +
  "no extra numbers, no icons, no arrows, no badges, no watermark. ";
const ONLY_NOPRODUCT =
  "No other text anywhere, no brand names, no product, no device, no belt, no extra numbers, no icons, no arrows, no badges, no watermark. ";

/* ------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------ */

const JOBS = [
  /* ---------- Produkt, Kampagne Ruecken (Ziel lp3) ---------- */
  {
    name: "r-01-30-tage-testen",
    seed: 5101,
    attach: REFS_ALL,
    prompt:
      REFNOTE + POSTER + MARKER(["30 Tage", "testen!"]) +
      "On the right half of the image, a photographic cut-out of a friendly man of about 62 with short grey hair, " +
      "seen in three-quarter view from behind and slightly to his right, cleanly composited onto the gradient, visible from the head down to mid-thigh. " +
      "With his right hand he holds the back of his light blue cotton shirt up to just below the shoulder blades, so his bare lower back is visible, " +
      "and he looks back over his shoulder towards the camera with a relaxed, warm smile. Beige chino trousers with a brown leather belt. " +
      "The training belt sits on his bare lower back, a hand's width above the trouser waistband: the wide striped panel over his spine, " +
      "the round dark patch slightly left of the spine, the white 'V Wellenpuls' wordmark on the right side; at his right side towards the front, " +
      "just the edge of the silver control unit. " +
      FILM + BODY + BELT +
      FOOT("Wellenpuls LWS", "Geld zurück, wenn er Ihnen nicht hilft") + ONLY,
  },
  {
    name: "r-02-gurt-an-fernseher-an",
    seed: 5102,
    attach: REFS_ALL,
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a lived-in German living room in the evening, a floor lamp on, the TV light flickering bluish on her face. " +
      "A woman of about 60 with shoulder-length grey-blonde hair sits sideways on a light grey sofa, leaning against a cushion, " +
      "a TV remote loosely in her right hand, looking off frame towards the TV with a calm, content half smile. " +
      "She wears a loose light grey knitted top and dark jeans. The hem of her top is rolled up a few centimetres above her waist, " +
      "so the training belt is clearly worn on her bare skin around the waist, the oval silver control unit with its red lights " +
      "visible on the front of her belly, slightly to her right of the navel. The belt sits above the jeans waistband. " +
      "Camera at seated eye level, slightly to her right, from about two metres away, she fills the lower two thirds of the frame. " +
      PHONE + BODY + BELT + MARKER(["Gurt an.", "Fernseher an."]) +
      FOOT("Rückentraining im Sitzen", "20 Minuten, zweimal pro Woche") + ONLY,
  },
  {
    name: "r-03-gezielt-unterer-ruecken",
    seed: 5103,
    attach: [REF_BACK, REF_SIDE, REF_LOGO],
    prompt:
      "The first reference image shows the real Wellenpuls training belt from behind, the second from the side; the third is the Wellenpuls logo. " +
      POSTER + MARKER(["Gezielt für", "den unteren", "Rücken!"]) +
      "On the right two thirds of the image, a photographic cut-out of a man of about 60 with short grey hair, seen directly from behind, " +
      "cleanly composited onto the gradient, visible from the shoulders to the top of his beige trousers. " +
      "He holds his light blue shirt open with both hands so his whole bare back is visible. " +
      "The belt sits on his bare lower back, a hand's width above the trousers, exactly like the first reference image: the wide striped panel centred over the spine, " +
      "the smooth round dark patch slightly left of the spine, the white 'V Wellenpuls' wordmark on the right side. No control unit visible. " +
      "Soft daylight from the left shows the gentle shape of the back muscles. " +
      FILM + BODY + BELT +
      FOOT("Entwickelt an der Sporthochschule Köln", "Jetzt 30 Tage testen") +
      "Spell the word Sporthochschule exactly letter by letter: S-p-o-r-t-h-o-c-h-s-c-h-u-l-e. " + ONLY,
  },
  {
    name: "r-04-im-sitzen",
    seed: 5104,
    attach: REFS_ALL,
    prompt:
      REFNOTE + POSTER + MARKER(["Rücken", "trainieren.", "Im Sitzen."]) +
      "Below the headline on the left, three short lines of white text in a clean bold sans-serif, each about one twenty-fifth of the image height, " +
      "stacked with generous spacing, reading exactly: line 1: Gurt anlegen; line 2: Stufe wählen; line 3: 20 Minuten sitzen. " +
      "On the right half, a photographic cut-out of a woman of about 58 with short dark hair and glasses, seated in a simple grey armchair, " +
      "cleanly composited onto the gradient, seen from the front-right. Her white t-shirt is knotted up above her waist so the training belt " +
      "is worn on her bare skin; with her right index finger she presses the plus button on the oval silver control unit on the front of her belly, " +
      "slightly to her right of the navel, and she looks down at it with a small, focused smile. Dark trousers, the belt above the waistband. " +
      FILM + BODY + BELT +
      FOOT("Wellenpuls LWS", "30 Tage Geld-zurück-Garantie") + ONLY,
  },

  /* ---------- Produkt, Kampagne Eltern (Ziel lp3?fuer=eltern) ---------- */
  {
    name: "e-01-papa-rueckenuebungen",
    seed: 5201,
    attach: REFS_ALL,
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a tidy, slightly old-fashioned German living room in the afternoon, a dark wooden cabinet, net curtains, window light from the left, " +
      "the corner of the room a bit dark. A man of about 74 with thinning white hair and big worn hands sits in a brown leather armchair, " +
      "an open newspaper on his lap, looking up over his reading glasses with a dry, amused half smile, caught mid sentence. " +
      "His beige checked flannel shirt is unbuttoned at the bottom and pushed aside, his white vest tucked up, so the training belt is clearly " +
      "worn on his bare skin around his waist; the oval silver control unit with its red lights sits on the front of his belly, slightly to his right " +
      "of the navel. Grey trousers, the belt above the waistband. Camera at seated eye level from about two metres away, " +
      "he fills the lower two thirds of the frame. " +
      PHONE + BODY + BELT + MARKER(["Papa macht", "seine Rückenübungen", "nicht?"]) +
      FOOT("Rückentraining im Sessel", "Für Ihre Eltern. 30 Tage Geld-zurück-Garantie.") + ONLY,
  },
  {
    name: "e-02-vier-tasten",
    seed: 5202,
    attach: [REF_FRONT, REF_SIDE, REF_LOGO],
    prompt:
      "The first reference image shows the real Wellenpuls training belt with its control unit from the front, the second from the side; " +
      "the third is the Wellenpuls logo. " +
      POSTER + MARKER(["Vier Tasten.", "Kein Handy.", "Keine App."]) +
      "In the lower two thirds, a photographic close-up with soft rounded corners, composited onto the gradient: the front of the belly of a woman " +
      "of about 72. With her left hand she holds her soft lilac cardigan and white top up, so the training belt is clearly worn on her bare skin. " +
      "The oval silver control unit sits on the front of her belly, slightly to her right of the navel, exactly as in the first reference image, " +
      "and her right index finger, with visible age spots and a plain gold wedding ring, presses the plus button. " +
      "The four buttons and the small red lights are sharp. Mature skin with fine creases. Soft window daylight, slight softness at the edges. " +
      PHONE + BELT +
      FOOT("So einfach, dass Mama es allein schafft", "30 Tage Geld-zurück-Garantie") + ONLY,
  },
  {
    name: "e-03-fuer-mama",
    seed: 5203,
    attach: REFS_ALL,
    prompt:
      REFNOTE + PHOTO_AD +
      "Scene: a bright, cosy German living room in the morning, window light from the right. A woman of about 72 with short white hair sits in a blue armchair, " +
      "smiling warmly at her daughter. The daughter, about 45, brown ponytail, denim shirt, kneels beside the armchair and, with one hand, " +
      "presses a button on the oval silver control unit on the front of her mother's belly, looking up at her; a light, affectionate moment, " +
      "caught a second before both laugh. The mother's soft beige knitted top is rolled up above her waist, so the training belt is clearly worn " +
      "on her bare skin, the control unit slightly to her right of the navel. Camera at seated eye level from about two metres away. " +
      PHONE + BODY + BELT + MARKER(["Für Mama.", "Ganz ohne", "Rückenübungen."]) +
      FOOT("Lieferung direkt zu Ihren Eltern", "30 Tage Geld-zurück-Garantie") + ONLY,
  },

  /* ---------- Ohne Produkt: Problem-Aware und Unaware, Ziel Advertorial ---------- */
  {
    name: "p-r-01-stehen-kueche",
    seed: 5301,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: a small German kitchen in the early evening, a pot on the stove, chopped vegetables on the counter, ceiling light on. " +
      "A woman of about 60 in a beige cardigan stands at the counter, one hand flat on the counter, the other pressed into the middle of her lower back, " +
      "eyes briefly closed, a tired, pained look, caught in the moment she straightens up. Shot from the kitchen doorway, about three metres away. " +
      PHONE + BODY + MARKER(["Nach einer Stunde", "Stehen tut", "der Rücken weh?"]) +
      FOOT("Warum Übungen oft nicht helfen", "Ein Leser erzählt") + ONLY_NOPRODUCT,
  },
  {
    name: "p-r-02-autofahrt",
    seed: 5302,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: a residential street in Germany on an overcast afternoon. A man of about 62 in a navy windbreaker is getting out of the driver's seat " +
      "of a silver estate car, one foot on the pavement, one hand on the top of the door frame, the other hand pressed into his lower back, " +
      "face tense, caught halfway up. Shot from across the street, about four metres away, the frame slightly tilted. " +
      PHONE + BODY + MARKER(["Rückenschmerzen", "nach dem", "Autofahren?"]) +
      FOOT("Was mir jahrelang keiner gesagt hat", "Ein Leser erzählt") + ONLY_NOPRODUCT,
  },
  {
    name: "p-r-03-uebungen-schublade",
    seed: 5303,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: an open kitchen drawer seen from above at a slight angle, full of everyday clutter: batteries, rubber bands, a tape measure, takeaway menus, " +
      "a dog lead. On top lies a slightly crumpled printed sheet of back exercises from a physiotherapist, with simple black line drawings of a person doing " +
      "exercises on the floor and tiny, illegible lines of text, a coffee ring on one corner. Warm kitchen light from above, one corner of the frame darker. " +
      PHONE + MARKER(["Die Rückenübungen", "liegen in der", "Schublade?"]) +
      FOOT("Sie sind nicht faul", "Lesen Sie, woran es wirklich liegt") +
      "The only readable text in the image is the headline and the two lines at the bottom; everything on the sheet is illegible. " + ONLY_NOPRODUCT,
  },
  {
    name: "p-e-01-geht-schon",
    seed: 5401,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: a German living room on a winter Sunday afternoon, grey window light, a brown leather armchair. A man of about 74 with thinning white hair, " +
      "in a beige cardigan, pushes himself up out of the armchair with both hands on the armrests, leaning forward, jaw set, caught on his second attempt. " +
      "In the foreground, out of focus at the left edge of the frame, the shoulder and arm of his adult son standing in the doorway. " +
      "Shot from the doorway at standing height. " +
      PHONE + BODY + MARKER(["„Geht schon“,", "sagt Papa."]) +
      FOOT("Ein Sohn erzählt", "was am Ende wirklich geholfen hat") + ONLY_NOPRODUCT,
  },
  {
    name: "p-e-02-nur-noch-sessel",
    seed: 5402,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: a quiet German living room, late afternoon light through net curtains. A man of about 75 sits in an armchair by the window, " +
      "looking out at the garden, a walking stick leaning against the armchair, a cup of coffee going cold on the side table. " +
      "Through the window the garden is a bit overgrown, a rake leaning on the shed. Shot from behind and to the side, from the doorway, about four metres away, " +
      "the frame a bit too low. " +
      PHONE + BODY + MARKER(["Wenn Papa", "nur noch im", "Sessel sitzt"]) +
      FOOT("Was Sie als Sohn oder Tochter tun können", "Ein Erfahrungsbericht") + ONLY_NOPRODUCT,
  },
  {
    name: "p-e-03-uebungsblatt-kuehlschrank",
    seed: 5403,
    attach: [],
    prompt:
      PHOTO_AD +
      "Scene: the door of an older white fridge in a German kitchen, covered with magnets, a grandchild's drawing, a calendar from the pharmacy and photos. " +
      "In the middle, held by a round magnet, hangs a slightly yellowed printed sheet of back exercises with simple black line drawings of a person doing " +
      "exercises on the floor and tiny, illegible lines of text, one corner curling. Kitchen ceiling light, slight glare on the fridge door. " +
      "Shot straight on from about one metre. " +
      PHONE + MARKER(["Mamas Übungsblatt", "hängt seit Monaten", "am Kühlschrank?"]) +
      FOOT("Warum Eltern ihre Rückenübungen nicht machen", "Ein Sohn erzählt") +
      "The only readable text in the image is the headline and the two lines at the bottom; everything on the fridge is illegible. " + ONLY_NOPRODUCT,
  },
];

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });
await Promise.all(
  JOBS.filter((j) => !only.length || only.some((o) => j.name.startsWith(o))).map(async (j) => {
    try {
      const b64 = await generate(j.prompt, j.aspect || "4:5", j.attach, key, j.seed);
      const rel = `${OUTDIR}/${j.name}.jpg`;
      writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
      console.log("ok", rel);
    } catch (e) {
      console.log("FEHLER", j.name, e.message);
    }
  })
);
