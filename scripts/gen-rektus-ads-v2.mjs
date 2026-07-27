#!/usr/bin/env node
/**
 * Ad-Motive fuer die zwei neuen Rektusdiastase-Quiz-Funnels (Nano Banana 2, gemini-3.1-flash-image).
 *
 *   node scripts/gen-rektus-ads-v2.mjs                 # alle Jobs
 *   node scripts/gen-rektus-ads-v2.mjs s2-01 m-04      # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * 8 Motive, alle 3:4, je 4 pro Zielgruppe:
 *   s2-01..04  Postpartum  -> /rektusdiastase/quiz-schwangerschaft-2/
 *   m-01..04   Menopause   -> /rektusdiastase/quiz-menopause/
 *
 * Bewusst vier komplett verschiedene Bildsprachen pro Zielgruppe (Makro-Foto,
 * Geraete-Mockup, Alltags-Schnappschuss, flache Illustration). Meta clustert
 * aehnliche Creatives in dieselben Delivery-Buckets; visuelle Diversitaet
 * sorgt fuer breitere Ausspielung.
 *
 * Copy (Primary Text + Headlines) steht in rektusdiastase/ads/ADS-2026.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "rektusdiastase/ads/2026-07";

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

// temperature niedrig + fester seed => moeglichst reproduzierbarer Output.
async function generate(model, prompt, aspect, attach, key, seed) {
  const parts = [];
  (attach || []).forEach((p) => parts.push(fileToPart(p)));
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: 0.15,
      seed,
      imageConfig: { aspectRatio: aspect },
    },
  };
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    // Manche Modelle akzeptieren seed/temperature nicht -> ohne erneut versuchen.
    delete body.generationConfig.seed;
    delete body.generationConfig.temperature;
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) throw new Error(`${model} keine Bilddaten`);
  return { b64: out.inlineData.data, mime: out.inlineData.mimeType || "image/png" };
}

/* ------------------------------------------------------------------ *
 * Gemeinsame Stil-Bausteine
 * ------------------------------------------------------------------ */

// Gegen den typischen "AI-Stock"-Look: echte Haut, echtes Licht, echte Raeume.
const REAL =
  "Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8 lens, " +
  "available natural daylight only, no flash, no studio lighting, no beauty retouching, no skin smoothing. " +
  "Visible skin texture with pores, fine lines, faint blemishes and uneven skin tone. Slightly imperfect, " +
  "candid framing as if taken quickly by a friend. Subtle sensor grain, natural colour, gentle contrast, " +
  "no HDR, no glossy commercial polish, no lens flare, no bokeh balls, no plastic-looking skin. " +
  "Real, ordinary, non-athletic body. Not a fitness model, no visible abdominal muscle definition, " +
  "no toned six-pack, no gym setting. ";

const NOTEXT =
  "There is absolutely no text, no letters, no numbers, no watermark, no logo and no graphic overlay " +
  "anywhere in the image. ";

const FLAT =
  "Clean editorial explainer illustration, flat vector shapes, soft subtle shading, gentle rounded line work, " +
  "generous negative space, magazine infographic quality, printed-poster feel, no photographic elements, " +
  "no 3D rendering, no gradients meshes, no drop shadows. ";

/* ------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------ */

const JOBS = [
  /* ---------- Postpartum / quiz-schwangerschaft-2 ---------- */
  {
    name: "s2-01-selbsttest-makro",
    aspect: "3:4",
    seed: 411001,
    prompt:
      REAL +
      "Extreme close-up, camera positioned directly overhead looking straight down at the bare midsection of a " +
      "woman in her early thirties who is lying on her back on a light grey exercise mat on a wooden floor. " +
      "Her body's long axis runs vertically through the frame: her lower ribs are at the top edge, her hip bones at the bottom edge, " +
      "the navel exactly on the vertical centre line. Her face is completely out of frame. " +
      "She wears a light heather-grey cotton top rolled up just below the chest and soft charcoal leggings pulled down to the hip bones. " +
      "Her belly is soft and relaxed with loose postpartum skin, a small amount of extra tissue around the navel, " +
      "a few pale silvery stretch marks below the navel and a faint vertical brownish linea nigra line. " +
      "Her right hand reaches in from the upper right corner of the frame. Index finger and middle finger are held tightly together, " +
      "pointing straight down along the body's midline, and are pressed flat side by side into the vertical midline groove " +
      "two to three centimetres above the navel, which stays clearly visible just below the fingertips. " +
      "The fingertips sink into the soft tissue so that the shallow gap between the two vertical abdominal muscle bands is unmistakable, " +
      "with a soft raised ridge of muscle on each side of the two fingers. Ring finger and little finger are curled away and do not touch the belly. " +
      "Short unpainted natural fingernails. Soft directional window light coming from the upper left, gentle shadow on the right side of the belly. " +
      "Warm neutral colour grade, cream and dusty rose tones in the surrounding floor and mat. " +
      NOTEXT +
      "Vertical 3:4 composition, the hand and navel sit slightly below the centre of the frame.",
  },
  {
    name: "s2-02-quiz-handy",
    aspect: "3:4",
    seed: 411002,
    attachFile: "rektusdiastase/ads/ref/quiz-schwangerschaft-2-frage.png",
    prompt:
      "Photorealistic vertical product-in-hand photograph, 3:4. " +
      "A woman's hand with short natural fingernails holds a modern black smartphone upright in portrait orientation, " +
      "slightly tilted about eight degrees to the left, filling roughly seventy percent of the frame height and centred. " +
      "The phone screen must reproduce the attached reference screenshot EXACTLY and completely: same layout, same colours, " +
      "same German words, same progress bar at the top, same question headline, same four picture answer cards below it. " +
      "Reproduce the German text on the screen letter for letter as it appears in the reference. The screen is bright, sharp and perfectly legible, " +
      "in focus across its whole surface, with no glare, no reflections and no fingerprints. " +
      "The background is a softly out-of-focus bright living room: a pale linen sofa, a folded white muslin baby cloth over the armrest, " +
      "a wooden play arch out of focus in the far background, warm afternoon window light from the left. " +
      "The background is clearly blurred so the phone screen is the only sharp element. " +
      "Shot on a 50mm lens at f/2.8, natural light only, no studio lighting, mild sensor grain, no HDR, no glossy commercial polish. " +
      "No additional text, no letters, no numbers, no logo and no graphic overlay anywhere outside the phone screen.",
  },
  {
    name: "s2-03-jeans-schnappschuss",
    aspect: "3:4",
    seed: 411003,
    prompt:
      REAL +
      "Candid vertical snapshot taken in a bright, slightly untidy bedroom in the late morning. " +
      "A woman in her early thirties stands next to an unmade bed with rumpled white bedding and a baby swaddle blanket on it. " +
      "She is seen from her left side, framed from the middle of her thighs to just above her shoulders; her head is turned down " +
      "toward her hands and her face is largely hidden behind loose light brown hair, only the chin and cheek are visible. " +
      "She wears a plain white cotton tank top pushed up above the waist and is using both hands to try to close the button of a pair " +
      "of dark blue high waisted jeans over a soft, rounded lower belly. The waistband does not close; there is a clear gap of about " +
      "four centimetres between the button and the buttonhole, and the denim presses a visible fold into the skin. " +
      "Her posture is a little slumped, the mood is quiet and slightly resigned rather than dramatic or sad. " +
      "A white laundry basket with folded baby clothes stands on the floor at the edge of the frame. " +
      "The whole room is filled with bright, soft, even morning daylight; the exposure is bright and airy with open shadows, " +
      "no dark or moody areas, the skin of her belly and hands is clearly and evenly lit. " +
      NOTEXT +
      "Vertical 3:4 composition, the waistband and hands sit on the lower third line of the frame.",
  },
  {
    name: "s2-04-illustration-luecke",
    aspect: "3:4",
    seed: 411004,
    prompt:
      FLAT +
      "A vertical 3:4 editorial poster on a plain warm cream background (#F7F1EA). " +
      "Centred in the upper two thirds: a simple, friendly, stylised front view of a female torso from the collarbones to the hips, " +
      "drawn in a soft dusty rose skin tone with a thin darker rose outline, no face, no arms below the elbow. " +
      "The chest is fully covered by a simple flat muted sage-green sports bra shape drawn as one plain rounded band, no cleavage, no skin showing above the abdomen. " +
      "Inside the torso, the two vertical rectus abdominis muscle bands are shown as two long rounded shapes in a deeper terracotta rose, " +
      "one on each side of the midline, each divided by three thin horizontal lines. " +
      "Between the two muscle bands there is a clearly visible vertical gap of even width running from just below the ribcage to just below the navel; " +
      "the gap is filled with a flat sage-green shape so it stands out immediately against the rose tones. The navel is a small simple oval. " +
      "In the lower third, on the left, one short line of German text in a bold geometric sans-serif, dark charcoal, " +
      "approximately one twelfth of the image height, reading exactly: Die Lücke. " +
      "Directly under it, one thinner smaller line in the same typeface, medium grey, approximately half that size, reading exactly: kein Fett. " +
      "No other text, no numbers, no logo, no arrows, no captions and no watermark anywhere in the image. " +
      "Ample empty cream space around all elements.",
  },

  /* ---------- Menopause / quiz-menopause ---------- */
  {
    name: "m-01-selbsttest-makro",
    aspect: "3:4",
    seed: 422001,
    prompt:
      REAL +
      "Close-up photograph taken from a low three-quarter angle, roughly forty degrees to the side and slightly above, " +
      "of the bare midsection of a woman aged about fifty-five who is lying on her back on a made bed with a rumpled " +
      "oatmeal-coloured linen bedspread. Only her torso from the lower ribs to the hips is in frame; her face is out of frame. " +
      "She wears a plain deep plum sleeveless top pulled up under the bust. Her belly is soft, rounded and relaxed, with mature skin: " +
      "fine crepey texture, a few visible veins, sun spots, and slightly slack tissue around the navel. No muscle definition at all. " +
      "Her left hand rests on the belly with index finger and middle finger held tightly together, pointing along the body's midline " +
      "toward the navel, pressed flat side by side into the soft vertical midline groove two to three centimetres above the navel, " +
      "so that a clear shallow dip between the two abdominal muscle bands is visible with a soft raised ridge on each side of the fingers. " +
      "Ring finger and little finger are curled away and do not touch the belly. " +
      "Short natural nails, a thin worn gold wedding ring, slightly wrinkled skin on the back of the hand. " +
      "Cool late-afternoon side light from a window on the right, long soft shadows across the bedspread, muted desaturated palette " +
      "of plum, warm grey and dusty beige. " +
      NOTEXT +
      "Vertical 3:4 composition, the hand sits slightly right of centre.",
  },
  {
    name: "m-02-quiz-tisch",
    aspect: "3:4",
    seed: 422002,
    attachFile: "rektusdiastase/ads/ref/quiz-menopause-frage.png",
    prompt:
      "The attached image is a screenshot of a mobile web page. Place this screenshot unchanged onto the screen of a smartphone. " +
      "Do not redesign it, do not invent a different app, do not replace the illustrations, do not change any word. " +
      "Keep the exact same layout, the exact same colours, the exact same German wording, the exact same progress bar at the top, " +
      "the exact same question headline and the exact same four picture answer cards. Only adapt it to the perspective of the phone screen. " +
      "Photorealistic vertical flat-lay photograph, 3:4, camera directly overhead looking straight down, no perspective distortion. " +
      "The smartphone lies flat, screen up, in portrait orientation on an oiled oak kitchen table, centred and perfectly aligned with the frame, " +
      "filling roughly sixty-five percent of the frame height. The screen is bright, sharp and perfectly legible edge to edge, " +
      "with no glare, no reflections and no fingerprints. " +
      "Around the phone, arranged casually and asymmetrically: a pair of tortoiseshell reading glasses folded in the upper right corner, " +
      "a half-full stoneware mug of black tea in the lower right, a small stack of unopened post at the top edge partly cropped, " +
      "and a woman's hand aged about fifty-five entering from the bottom left of the frame, index finger about to tap the screen. " +
      "Soft diffuse morning light from the upper left, gentle natural shadows, warm wood tones, muted natural colours, mild sensor grain, " +
      "no studio lighting, no HDR, no glossy commercial polish. " +
      "No additional text, no letters, no numbers, no logo and no graphic overlay anywhere outside the phone screen.",
  },
  {
    name: "m-03-spiegel-schnappschuss",
    aspect: "3:4",
    seed: 422003,
    prompt:
      REAL +
      "Candid vertical photograph in a plain, slightly dated bathroom with white tiles and a simple wall mirror above a basin. " +
      "A woman aged about fifty-five with shoulder-length grey-blonde hair stands in front of the mirror, seen from behind and slightly to the side, " +
      "so that her reflection is visible in the mirror while her real back fills the left half of the frame. " +
      "She wears a plain navy jersey blouse and is smoothing the fabric down over her midsection with both hands, looking down at her waist rather than at her own face. " +
      "The blouse sits visibly wider and rounder around the middle than at the ribs and hips. Her expression in the mirror is thoughtful and matter-of-fact, not sad. " +
      "Everyday details: a toothbrush cup, a folded hand towel, a bottle of hand soap, slight limescale marks on the tap. " +
      "Flat, slightly greenish overhead bathroom light mixed with weak daylight from a small frosted window, realistic mixed white balance, muted colours. " +
      NOTEXT +
      "Vertical 3:4 composition, the mirror reflection sits in the upper right, the hands on the waist near the centre.",
  },
  {
    name: "m-04-illustration-bindegewebe",
    aspect: "3:4",
    seed: 422004,
    prompt:
      FLAT +
      "A vertical 3:4 editorial poster on a plain very light warm grey background (#F4F1F3). " +
      "The image is a simple two-panel comparison, one panel above the other, separated by a thin horizontal hairline in light grey. " +
      "Each panel shows the same abstract, stylised close-up of connective tissue as a flat lattice of interwoven fibres, drawn as clean thin lines. " +
      "In the upper panel the lattice is dense, evenly spaced and drawn in a saturated plum tone, and the two abdominal muscle bands it holds together " +
      "sit close to each other with only a hairline between them. " +
      "In the lower panel the same lattice is visibly looser and sparser with wider mesh openings, drawn in a faded, desaturated plum, " +
      "and the two muscle bands have drifted apart leaving a clear, even vertical gap between them, filled with a flat muted teal shape. " +
      "In the top left corner of the upper panel, one short line of German text in a bold geometric sans-serif, dark charcoal, " +
      "approximately one sixteenth of the image height, reading exactly: mit 30. " +
      "In the top left corner of the lower panel, in the identical typeface and size, reading exactly: ab 45. " +
      "No other text, no numbers, no logo, no arrows, no captions and no watermark anywhere in the image. " +
      "Generous empty space, calm and clinical but warm, poster-like balance.",
  },
];

async function main() {
  const key = loadKey();
  const only = process.argv.slice(2);
  mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });
  for (const j of JOBS) {
    if (only.length && !only.some((o) => j.name.startsWith(o))) continue;
    const attach = j.attachFile ? [j.attachFile] : [];
    let done = false;
    for (const model of MODELS) {
      try {
        process.stdout.write(`${j.name} (${j.aspect}${attach.length ? ", +ref" : ""}) via ${model} ... `);
        const { b64 } = await generate(model, j.prompt, j.aspect, attach, key, j.seed);
        const rel = `${OUTDIR}/${j.name}.jpg`;
        writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
        console.log(`ok -> ${rel}`);
        done = true;
        break;
      } catch (e) {
        console.log(`fehlgeschlagen: ${e.message}`);
      }
    }
    if (!done) console.error(`!! ${j.name} nicht erzeugt`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
