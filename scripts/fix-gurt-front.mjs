#!/usr/bin/env node
/**
 * Korrigiert den Gurt in Statics mit Frontansicht (Nano Banana 2 im Bearbeitungsmodus).
 *
 *   node scripts/fix-gurt-front.mjs assets/ads/2026-10/v2/roh/e-03-fuer-mama.jpg [weitere ...]
 *
 * Alles im Bild bleibt, nur die Vorderseite des Gurts wird an den echten Gurt angeglichen:
 * glatte schwarze Front, Bedienteil exakt wie im Foto, Schriftzug mit gebogenen Streifen
 * zur rechten Koerperseite, Verschlusslasche mit Naht und Metallring links, kein Klettfleck vorn.
 * Das Original wird als <name>.vorher.jpg daneben gesichert.
 * Modi: MODE=wortmarke (nur Schriftzug), MODE=ohne-schrift (Schriftzug weg), MODE=quer (Bedienteil quer statt hochkant),
 *       MODE=links (Bedienteil in die linke Bildhaelfte, also auf die rechte Koerperseite).
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "gemini-3.1-flash-image";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("GEMINI_API_KEY nicht in .env gefunden");
  return m[1].replace(/^["']|["']$/g, "").trim();
}
const part = (p) => {
  const ext = p.split(".").pop().toLowerCase();
  return { inlineData: { mimeType: ext === "png" ? "image/png" : "image/jpeg", data: readFileSync(resolve(ROOT, p)).toString("base64") } };
};

const PROMPT =
  "Edit the first image. Keep everything in it exactly as it is: the people, their faces, poses, hands, clothing, the room, the light, " +
  "the composition, and every piece of text and every highlight box, unchanged in wording, position, size and colour. " +
  "Change only the training belt the person is wearing, so that its front looks exactly like the real belt in the second reference image, " +
  "with the control unit exactly like the close-up in the third reference image: " +
  "the front of the belt is a smooth matte black panel without stripes, worn directly on bare skin. " +
  "On it, slightly to the wearer's right of the navel, sits the control unit: a horizontal oval with a polished silver rim and a dark glass face, " +
  "a power symbol at the top, a minus sign on the left, a plus sign on the right, three small wavy heat lines at the bottom, " +
  "and four short red light bars arranged in an X in the centre. It is not white, not vertical, and has no round buttons. " +
  "Directly beside the control unit, towards the wearer's right side, the belt shows fine curved light-grey stripes and the small white 'Wellenpuls' wordmark, " +
  "spelled exactly W-e-l-l-e-n-p-u-l-s. Towards the wearer's left side, the plain black closure flap with a vertical stitched seam and a small metal ring. " +
  "There is no round patch on the front of the belt. If a finger touches the control unit, it now rests on the plus sign. " +
  "Keep the belt's size and position on the body the same, above the trouser waistband.";

// Zweiter Durchgang nur fuer den Schriftzug:  MODE=wortmarke node scripts/fix-gurt-front.mjs <bild>
const PROMPT_WORTMARKE =
  "Edit the first image. Keep everything exactly as it is, including all people, the control unit, every piece of text and every highlight box. " +
  "Change only the small white wordmark printed on the belt next to the control unit. It must read exactly 'Wellenpuls' with the V symbol in front, " +
  "identical in letter shapes to the logo in the second reference image but in white, sharp and correctly spelled W-e-l-l-e-n-p-u-l-s. " +
  "It sits on the fine curved light-grey stripes between the control unit and the wearer's right hip, as in the third reference image. " +
  "When the wearer faces the camera, that is to the left of the control unit in the image. " +
  "If there is a wordmark on the other side of the control unit, replace it with plain fabric with the same curved stripes.";
// Dritter Weg, wenn der Schriftzug krumm bleibt:  MODE=ohne-schrift node scripts/fix-gurt-front.mjs <bild>
const PROMPT_OHNE =
  "Edit the first image. Keep everything exactly as it is, including all people, the control unit, every piece of text and every highlight box. " +
  "Change only one thing: remove the small lettering printed on the belt next to the control unit and replace it with plain fabric " +
  "with the same fine curved light-grey stripes, so the belt itself carries no text at all.";
// Vierter Weg, wenn das Bedienteil hochkant statt quer generiert wurde:  MODE=quer node scripts/fix-gurt-front.mjs <bild>
const PROMPT_QUER =
  "Edit the first image. Keep everything exactly as it is: the person, the hands and fingers, the clothing, the belt, the stripes, the wordmark, " +
  "the background, every piece of text and every highlight box. Change only the shape of the oval control unit on the belt: it must be a HORIZONTAL oval, " +
  "clearly wider than tall (about twice as wide as it is tall), lying flat along the belt, exactly like the control unit in the second and third reference images. " +
  "Polished silver rim, dark glass face, power symbol at the top centre, minus on the left, plus on the right, three small heat waves at the bottom centre, " +
  "four short red light bars forming an X in the middle. Keep its centre where it is now. If a fingertip touches it, the fingertip rests on the plus sign.";
// Fuenfter Weg, wenn das Bedienteil auf der falschen Koerperseite sitzt:  MODE=links node scripts/fix-gurt-front.mjs <bild>
// Richtungen bildbezogen, weil das Modell "rechte Koerperseite" oft spiegelt.
const PROMPT_LINKS =
  "Edit the first image. Keep the person, face, hair, clothing, pose, the room, the light, every piece of text and every highlight box exactly as they are. " +
  "Rearrange only the belt the person is wearing so it matches the second reference image: along the belt, from the LEFT of the image to the right: " +
  "fine curved light-grey stripes with the small white wordmark at the person's side, then the control unit (a HORIZONTAL oval, twice as wide as tall, " +
  "polished silver rim, dark glass face, power top, minus left, plus right, heat waves bottom, four red light bars as an X), " +
  "then the plain smooth black flap over the navel, ending at a thin vertical metal bar just right of the navel. " +
  "The control unit must be in the LEFT half of the person's belly as seen in the image, above the hip, not in the middle. " +
  "If a hand touches the control unit, move that hand with it so the index finger rests on the plus sign; otherwise leave the hands where they are.";
const MODE = process.env.MODE || "";

const key = loadKey();
for (const f of process.argv.slice(2)) {
  const backup = f.replace(/\.jpg$/, ".vorher.jpg");
  if (!existsSync(resolve(ROOT, backup))) copyFileSync(resolve(ROOT, f), resolve(ROOT, backup));
  const parts = MODE === "links"
    ? [part(f), part("assets/video/ref/getragen/vorn-rechts.jpg"), part("assets/video/ref/bedienteil.jpg"), { text: PROMPT_LINKS }]
    : MODE === "quer"
    ? [part(f), part("assets/video/ref/getragen/vorn-rechts.jpg"), part("assets/video/ref/bedienteil.jpg"), { text: PROMPT_QUER }]
    : MODE === "ohne-schrift"
    ? [part(f), { text: PROMPT_OHNE }]
    : MODE === "wortmarke"
    ? [part(f), part("assets/logo_wellenpuls.png"), part("assets/video/ref/gurt-front-nah.jpg"), { text: PROMPT_WORTMARKE }]
    : [part(backup), part("assets/video/ref/gurt-front-nah.jpg"), part("assets/video/ref/bedienteil.jpg"), { text: PROMPT }];
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.1, imageConfig: { aspectRatio: "4:5" } },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.log("FEHLER", f, res.status, (await res.text()).slice(0, 200)); continue; }
  const data = await res.json();
  const out = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!out) { console.log("FEHLER", f, "keine Bilddaten"); continue; }
  writeFileSync(resolve(ROOT, f), Buffer.from(out.inlineData.data, "base64"));
  console.log("ok", f);
}
