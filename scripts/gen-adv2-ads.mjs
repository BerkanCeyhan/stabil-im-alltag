#!/usr/bin/env node
/**
 * Ad-Motive fuer das zweite Advertorial (/ruecken/adv/2/) und die PDP lp2.
 * Nano Banana 2, gemini-3.1-flash-image.
 *
 *   node scripts/gen-adv2-ads.mjs             # alle Jobs
 *   node scripts/gen-adv2-ads.mjs a2-03       # nur einzelne Jobs
 *
 * Voraussetzung: GEMINI_API_KEY in .env (nicht im Repo).
 *
 * Zwei Gruppen, bewusst getrennte Bildwelten:
 *
 *   a2-02 .. a2-04  problem aware, Ziel ist das Advertorial.
 *                   Kein Produkt im Bild, kein Text im Bild. Das Bild soll nur
 *                   den Scroll stoppen und eine Frage aufmachen, die der
 *                   Primary Text beantwortet. a2-01 ist der Screenshot des
 *                   Advertorials und wird nicht generiert.
 *
 *   a2-05 .. a2-06  product aware, Ziel ist lp2. Geraet sichtbar, Referenz ist
 *                   das echte Produktfoto.
 *
 * Copy (Primary Text + Headline) steht in ruecken/adv/ADS-ADV2.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = "assets/ads/adv2";

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

// Native Ads leben davon, dass das Bild wie ein Post aussieht und nicht wie
// eine Anzeige. Kameramodell plus Brennweite plus Blende wirkt dafuer
// zuverlaessiger als jedes "make it look real".
const REAL =
  "Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8 lens, " +
  "available natural daylight from a window only, no flash, no studio strobes, no beauty retouching, " +
  "no skin smoothing. Slightly imperfect, candid framing as if taken quickly on a phone by a family " +
  "member. Subtle sensor grain, natural muted colour, gentle contrast, no HDR, no glossy commercial " +
  "polish, no lens flare, no bokeh balls, no plastic-looking skin. ";

// Die Zielgruppe muss sich wiedererkennen. Der Standardfehler ist das
// durchtrainierte Model: wenn sich ein 55-Jaehriger im Bild nicht wiederfindet,
// ist das Motiv wertlos, egal wie huebsch es ist.
const ECHTE_MENSCHEN =
  "Real, ordinary, non-athletic German body of that age, slightly heavy around the middle. Not a " +
  "fitness model, no visible muscle definition, no gym setting, no branded sportswear. Visible skin " +
  "texture with pores, deep fine lines, age spots and uneven skin tone. Greying hair, thinning at " +
  "the temples, worn wedding ring, everyday clothes that have been washed many times. ";

// Markenwelt: hell, redaktionell, warm. Kein Teleshopping, keine Klinik.
const MARKE =
  "Calm everyday colour world: warm off-white, light sand and worn wood tones, muted soft blue and " +
  "grey accents. No red, no yellow, no orange, no starbursts, no badges, no ribbons, no arrows, " +
  "no borders, no frames, no vignette. ";

const KEIN_TEXT =
  "No text, no letters, no numbers, no watermark, no logo, no captions, no UI elements and no " +
  "readable brand names anywhere in the image. ";

// Kein Produkt in den problem-aware Motiven. Sobald der Guertel zu sehen ist,
// ist der Curiosity Gap zu und die Anzeige wird als Werbung gelesen.
const KEIN_PRODUKT =
  "There is no medical device, no back brace, no support belt, no electrode pad, no TENS unit and " +
  "no fitness equipment of any kind anywhere in the image. ";

// Der Guertel muss in den Produktmotiven derselbe sein wie auf den echten
// Produktfotos. Die frei beschriebene Variante hat beim ersten Durchlauf das
// Bedienteil eckig gerendert und das Elektrodenfeld weggelassen. Deshalb hier
// eine Merkmalsliste statt einer Beschreibung: jedes Teil einzeln benannt,
// mit Lage und Groesse relativ zur Guertelhoehe.
const GERAET = `
Reproduce the lumbar EMS belt from the attached reference photographs with
absolute fidelity. Treat the references as the ground truth for the hardware and
copy it part by part. Device specification:
{
  "band":            "one continuous wide matte-black neoprene band, roughly 18 cm tall, no printed pattern, no stripes, no lettering, no logo anywhere on the fabric",
  "electrode_field": "on the UPPER half of the band, a raised panel of four separate dark grey rounded-rectangle electrode housings in a row, each about one third of the band height, slightly domed, matte, with a fine dotted texture, separated by narrow gaps",
  "control_module":  "on the LOWER half, right of centre, one raised black module about half the band height, its left half covered by a fan of thin curved parallel ribs radiating outwards",
  "control_unit":    "set into the right side of that module, one horizontally oriented OVAL control face framed by a polished brushed-silver bezel ring about 2 cm wide, the face itself flat matte black, carrying four small pale grey symbols: a power symbol upper right, a minus sign on the left, a plus sign on the right, one small icon at the bottom",
  "closure":         "a plain black velcro strap end on the left side of the band, plus one small brushed metal slider loop on the lower edge",
  "forbidden":       "no horizontal line pattern, no printed word marks, no brand names, no round coin-shaped button, no square button, no display screen, no cables, no LEDs, no additional controls"
}
Shape, proportions, part positions and finish must match the references exactly.
`;

/* ------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------ */

const REF_GERAET = "assets/PackShot_01.png";
const REF_ANWENDUNG = "assets/Anwendung-wellenpuls.jpg";
const REF_BUNDLE = "assets/product-image-1.png";

const JOBS = [
  {
    // Recognition. Die Hand am unteren Ruecken ist das eine Bild, das jeder aus
    // dieser Zielgruppe von sich selbst kennt. Bewusst zu Hause und beilaeufig,
    // nicht im Buero und nicht als Schmerzgrimasse: eine Grimasse liest sich als
    // Stockfoto, das kurze Innehalten liest sich als Alltag.
    name: "a2-02-ruecken-griff",
    aspect: "4:5",
    seed: 611002,
    attach: [],
    prompt:
      REAL +
      ECHTE_MENSCHEN +
      "A German man of about 55 stands in an ordinary lived-in kitchen in the late morning, seen from " +
      "behind and slightly to the side. He has just straightened up from the open lower drawer of the " +
      "dishwasher, which is still open in front of him. His right hand is pressed flat against his own " +
      "lower back, just above the waistband, fingers spread, the wrist bent. His shoulders are slightly " +
      "raised and his head is tilted down. He wears a washed-out dark blue polo shirt and grey trousers. " +
      "The kitchen is real and untidy: crumbs on the worktop, a tea towel over the oven handle, an open " +
      "packet of coffee, limescale marks around the tap, a wall calendar with handwriting too small to " +
      "read. " +
      MARKE +
      KEIN_PRODUKT +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at chest height about three metres away, his body sits slightly " +
      "left of centre and fills the middle two thirds of the frame, his hand on the lower back sits " +
      "almost exactly on the horizontal centre line.",
  },
  {
    // Failed-Solution-Reframe als Stillleben. Das Motiv erklaert sich erst durch
    // die Copy, genau das ist der Curiosity Gap. Ausserdem bricht es das
    // Menschen-Raster der uebrigen Motive und landet dadurch bei Meta nicht im
    // selben Delivery-Bucket.
    name: "a2-03-ecke-geraete",
    aspect: "4:5",
    seed: 611003,
    attach: [],
    prompt:
      REAL +
      "A still life of abandoned self-treatment equipment collected in the corner of an ordinary German " +
      "living room, next to a radiator under a window. Nobody is in the picture. Leaning and lying " +
      "against each other, dusty and clearly unused for months: a dark grey foam roller standing " +
      "upright, a small spiky blue massage ball on the floor, a black handheld massage gun lying on its " +
      "side with its round head detached beside it, a rolled-up dark green spiky acupressure mat, a " +
      "cherry stone heat cushion in faded fabric, a red rubber hot water bottle with a knitted cover, " +
      "and a rolled beige resistance band. Fine dust on the upper surfaces, one power cable coiled and " +
      "left on the floor, the skirting board and a worn parquet floor visible. " +
      "Soft overcast daylight falls from the window on the left, no direct sun, long soft shadows " +
      "across the floor towards the camera. " +
      MARKE +
      KEIN_PRODUKT +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at knee height about one and a half metres away and slightly " +
      "angled down, the pile of objects fills the lower two thirds of the frame, the empty wall above " +
      "it stays quiet.",
  },
  {
    // Der Hoch-Runter-Kreislauf als Alltagsszene. Der halb gemaehte Rasen ist
    // sofort lesbar und stellt eine Frage, die die erste Zeile beantwortet.
    // Wieder ohne Menschen, aber warm und draussen, damit es sich von a2-03
    // deutlich unterscheidet.
    name: "a2-04-rasen-halb",
    aspect: "4:5",
    seed: 611004,
    attach: [],
    prompt:
      REAL +
      "An ordinary German back garden on a warm afternoon. A dark green push lawn mower stands " +
      "abandoned exactly in the middle of the lawn, switched off, its cable trailing back towards the " +
      "house. The lawn is split into two unmistakably different halves that meet in a hard, perfectly " +
      "straight edge running from the lower left corner of the frame up to the mower and stopping dead " +
      "right at its front wheels. Left of that edge the grass is cut very short, smooth, pale " +
      "yellow-green and marked with clean parallel mower stripes. Right of that edge the grass is " +
      "roughly three times as tall, dark, shaggy and uneven, with dandelion stalks and seed heads " +
      "standing above it. The height difference between the two halves is obvious at a glance and " +
      "casts its own small shadow line along the edge. A pair of garden gloves lies dropped on the cut " +
      "grass beside the mower. " +
      "In the background, out of focus, a plain terrace with a plastic chair, a folded parasol and a " +
      "hedge. Warm low afternoon sunlight from the right, long soft shadows across the lawn. " +
      MARKE +
      KEIN_PRODUKT +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at hip height about four metres away, the mower sits slightly " +
      "right of centre on the horizontal centre line, the unmown half of the lawn fills the lower left " +
      "of the frame.",
  },
  {
    // Product aware, Ziel lp2. Das Geraet liegt da, wo es benutzt wird, nicht
    // im Studio. Ein Packshot auf weissem Grund haetten wir schon in der
    // Aktionskampagne; diese Anzeige soll zeigen, wie beilaeufig das Ding im
    // Alltag liegt.
    name: "a2-05-geraet-couch",
    aspect: "4:5",
    seed: 611005,
    attach: [REF_GERAET],
    prompt:
      REAL +
      "The black lumbar support belt lies loosely open on the worn grey fabric seat of an ordinary " +
      "German living room sofa, as if someone had just taken it off. " +
      GERAET +
      "Next to it on the same seat: a television remote control, a folded newspaper and a pair of " +
      "reading glasses. A crumpled cushion is pushed into the corner of the sofa behind them. " +
      "Warm low daylight falls from a window on the left across the seat, soft natural shadows, the " +
      "rest of the room out of focus in the background. " +
      MARKE +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at seat height about one metre away and angled slightly down, " +
      "the belt runs diagonally through the middle of the frame and occupies about half the image " +
      "width, the control unit sits close to the horizontal centre line and is clearly readable in shape.",
  },
  {
    // Product aware, Ziel lp2. Der Beweis, dass es im Sitzen nebenbei laeuft.
    // Er schaut nicht in die Kamera und macht kein Gesicht dazu: sobald jemand
    // in die Kamera laechelt, ist es ein Werbefoto.
    name: "a2-06-anwendung-mann",
    aspect: "4:5",
    seed: 611006,
    attach: [REF_GERAET],
    prompt:
      REAL +
      ECHTE_MENSCHEN +
      "A German man of about 57 sits back in the corner of a worn grey fabric sofa in an ordinary " +
      "German living room in the evening, seen from the side at a slight angle. He wears a soft " +
      "dark grey t-shirt pushed up at the back and comfortable dark trousers, so the wide black lumbar " +
      "belt is clearly visible fastened around his lower back and waist. " +
      GERAET +
      "He is not looking at the camera and is not smiling. He watches something off-frame to the left " +
      "with a mug in one hand, relaxed and unbothered, as if he had forgotten he is wearing the belt. " +
      "The room is lived in, not styled: a folded blanket over the armrest, a full laundry basket at " +
      "the edge of the frame, a warm lamp on a side table, curtains half drawn. " +
      MARKE +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at seated eye level about two and a half metres away, his torso " +
      "sits slightly right of centre, the belt around his lower back sits on the horizontal centre line " +
      "and occupies about one fifth of the image height.",
  },
  {
    // Zweiter Anlauf fuer das Produktmotiv. Referenz ist jetzt das echte
    // Anwendungsfoto plus das Bundle-Foto, nicht mehr der Packshot: nur diese
    // beiden zeigen das Elektrodenfeld und das ovale Bedienteil, die auf lp2
    // ebenfalls zu sehen sind. Message Match faengt beim Geraet an.
    name: "a2-05b-geraet-couch",
    aspect: "4:5",
    seed: 611015,
    attach: [REF_ANWENDUNG, REF_BUNDLE],
    prompt:
      REAL +
      "The lumbar EMS belt lies loosely open and slightly curved on the worn grey fabric seat of an " +
      "ordinary German living room sofa, electrode side facing up, as if someone had just taken it off. " +
      GERAET +
      "Next to it on the same seat: a television remote control, a folded newspaper and a pair of " +
      "reading glasses. A crumpled cushion is pushed into the corner of the sofa behind them. " +
      "Warm low daylight falls from a window on the left across the seat, soft natural shadows, the " +
      "rest of the room out of focus in the background. " +
      MARKE +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at seat height about one metre away and angled slightly down, " +
      "the belt runs diagonally through the middle of the frame and occupies about sixty percent of the " +
      "image width, the oval silver control unit sits close to the horizontal centre line and is fully " +
      "visible and in sharp focus.",
  },
  {
    // Anwendung am Mann. Der Guertel sitzt wie auf dem Referenzfoto: Oberkante
    // auf Hoehe der Taille, Elektrodenfeld auf dem unteren Ruecken, Bedienteil
    // seitlich rechts. Kleidung bewusst hochgeschoben statt darueber, sonst
    // sieht man nicht, worum es geht.
    name: "a2-06b-anwendung-mann",
    aspect: "4:5",
    seed: 611016,
    attach: [REF_ANWENDUNG, REF_BUNDLE],
    prompt:
      REAL +
      ECHTE_MENSCHEN +
      "A German man of about 57 stands at the kitchen counter of an ordinary lived-in German home in " +
      "the late morning, photographed from behind and slightly to his right, so that his lower back " +
      "faces the camera. He wears a soft heather-grey t-shirt that he has pushed up above the belt, and " +
      "dark comfortable trousers. The lumbar EMS belt is fastened firmly around his lower back and " +
      "waist, sitting horizontally, its upper edge level with the top of his hip bones, moulded snugly " +
      "against the curve of his back with the fabric slightly compressed where it meets his body. " +
      GERAET +
      "The electrode field sits centred on his lower back over the spine, the control module and its " +
      "oval silver control unit sit on the right side of his back, easily reachable by his right hand. " +
      "He holds a mug and looks out of the window to the left, calm and unbothered, not at the camera, " +
      "not smiling for the photograph. The kitchen is real and untidy: a coffee machine, a fruit bowl, " +
      "a tea towel over the oven handle. " +
      MARKE +
      KEIN_TEXT +
      "Vertical 4:5 composition, camera at chest height about two metres away, his torso fills the " +
      "middle of the frame, the belt sits on the horizontal centre line and spans about half the image " +
      "width, sharp and fully legible in every detail.",
  },
];

/* ------------------------------------------------------------------ */

const key = loadKey();
const only = process.argv.slice(2);
mkdirSync(resolve(ROOT, OUTDIR), { recursive: true });

for (const j of JOBS) {
  if (only.length && !only.some((o) => j.name.startsWith(o))) continue;
  // Fester Ausgabepfad mit fester Endung: sonst entsteht beim Nachgenerieren
  // eine .png neben der alten .jpg und die Anzeige zeigt weiter das alte Bild.
  const rel = `${OUTDIR}/${j.name}.jpg`;
  let ok = false;
  for (const model of MODELS) {
    try {
      const { b64 } = await generate(model, j.prompt, j.aspect, j.attach, key, j.seed);
      writeFileSync(resolve(ROOT, rel), Buffer.from(b64, "base64"));
      console.log(`ok   ${j.name}  ->  ${rel}`);
      ok = true;
      break;
    } catch (e) {
      console.error(`FEHL ${j.name}  ${model}: ${e.message}`);
    }
  }
  if (!ok) process.exitCode = 1;
}
