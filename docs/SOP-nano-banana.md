# SOP: Bilder mit Nano Banana 2 (Gemini) erzeugen

Stand 2026-07-27. Schwesterdokument: [SOP-meta-kampagnen.md](SOP-meta-kampagnen.md).

Deckt ab: Ad-Motive, Quiz- und Landingpage-Illustrationen, Produkt-Bundle-Bilder
und das saubere Freistellen danach.

---

## 1. Zugang und Modell

Der Key steht in `.env` im Projekt-Root als `GEMINI_API_KEY`. `.env` ist
gitignored und wird **nie** ausgegeben, nicht ins Log, nicht in eine URL, nicht
in eine Fehlermeldung. Der Key gehört in den Header, nicht in den Query-String.

**Modell: immer `gemini-3.1-flash-image`.** Kein Fallback auf
`gemini-3-pro-image`, `gemini-3-pro-image-preview` oder `gemini-2.5-flash-image`.
Alle Skripte unter `scripts/gen-*.mjs` sind darauf festgenagelt:

```js
// Immer gemini-3.1-flash-image (Nano Banana 2). Kein Fallback auf andere Modelle.
const MODELS = ["gemini-3.1-flash-image"];
```

Endpoint:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent
Header: x-goog-api-key: <KEY>
```

---

## 2. Request-Aufbau

```js
{
  contents: [{ parts: [ ...referenzbilder, { text: prompt } ] }],
  generationConfig: {
    responseModalities: ["IMAGE"],
    temperature: 0.15,          // niedrig = deterministischer
    seed: 411001,               // fester Seed pro Job
    imageConfig: { aspectRatio: "3:4" }
  }
}
```

- Referenzbilder kommen **vor** dem Text in `parts`, als
  `{ inlineData: { mimeType, data: <base64> } }`.
- Unterstützte `aspectRatio`-Werte, die wir nutzen: `1:1`, `3:4`, `4:5`, `4:3`,
  `16:9`, `9:16`.
- Antwort: `candidates[0].content.parts[]`, der Teil mit `inlineData.data` ist
  das Bild (Base64). MIME kann JPEG oder PNG sein, im Zweifel am `mimeType`
  ablesen und die Endung danach setzen.
- `seed` und `temperature` werden nicht von jedem Modellstand akzeptiert. Das
  Skript fängt einen HTTP 400 ab und wiederholt den Call ohne die beiden Felder.

### Determinismus, realistisch betrachtet

Gleicher Seed plus gleicher Prompt plus gleiche Referenzen ergibt sehr ähnliche,
aber nicht bitgleiche Bilder. Der Seed reicht, um eine Bildserie stabil zu
halten und gezielt einzelne Motive nachzugenerieren, ohne dass die anderen
kippen. Deshalb: **ein fester Seed pro Job, im Skript hinterlegt**, nicht
zufällig erzeugt.

---

## 3. Skript-Grundgerüst

Nie einzelne Calls aus der Hand feuern, immer ein Skript mit einer Job-Liste.
Vorlage: `scripts/gen-rektus-ads-v2.mjs`. Die drei Dinge, die es können muss:

```js
// 1) Einzelne Jobs nachgenerieren, ohne die ganze Serie neu zu bauen
const only = process.argv.slice(2);          // node scripts/gen-x.mjs s2-01 m-04
if (only.length && !only.some(o => j.name.startsWith(o))) continue;

// 2) Referenz aus einem vorherigen Job ODER aus der Datei auf Platte
if (typeof j.attachIdx === "number") {
  if (results[j.attachIdx]) attach.push(results[j.attachIdx]);
  else attach.push(`assets/${JOBS[j.attachIdx].name}.jpg`);
}

// 3) Fester Ausgabepfad, damit die HTML-Referenzen nicht brechen
const rel = `${OUTDIR}/${j.name}.jpg`;
```

Punkt 3 ist wichtiger als er aussieht: wenn die Endung aus dem MIME-Typ der
Antwort abgeleitet wird, entsteht beim Nachgenerieren plötzlich eine `.png`
neben der alten `.jpg` und die Seite zeigt weiter das alte Bild.

---

## 4. Prompting

### Grundregeln

1. **Immer Englisch.** Auch wenn deutscher Text im Bild stehen soll.
2. **Beschreiben, nicht anweisen.** Nicht „make it look natural", sondern was
   konkret zu sehen ist.
3. **Räumlich exakt.** Kameraposition, Blickwinkel, wo im Frame welches Objekt
   sitzt, wie viel Prozent der Höhe es einnimmt, wo Licht herkommt.
4. **Negative Vorgaben ausschreiben.** „no text, no letters, no numbers, no
   watermark, no logo, no arrows" ist wirksamer als es klingt.
5. **Ein Prompt, ein Motiv.** Zwei Bildideen in einem Prompt geben Matsch.
6. Wiederkehrende Stilblöcke als Konstanten im Skript, nicht kopiert in jeden
   Job. Sonst driften die Motive einer Serie auseinander.

### Prompt-Skelett

```
[Stilblock: Medium, Kamera/Technik, Licht, Farbwelt]
[Subjekt: wer/was, Alter, Körper, Kleidung, in welcher Situation]
[Komposition: Kameraposition, Bildausschnitt, was im Frame wo sitzt]
[Detail, auf das es ankommt: die eine Sache, die der Betrachter erkennen muss]
[Negativliste]
[Format: "Vertical 3:4 composition, <Objekt> sits on the lower third line."]
```

### Menschen glaubwürdig treffen

Der Standardfehler ist das durchtrainierte Model. Wenn die Zielgruppe sich nicht
wiedererkennt, ist das Bild wertlos, egal wie hübsch es ist. Deshalb explizit:

```
Real, ordinary, non-athletic body. Not a fitness model, no visible abdominal
muscle definition, no toned six-pack, no gym setting. Visible skin texture with
pores, fine lines, faint blemishes and uneven skin tone.
```

Und je nach Zielgruppe konkret: lockere Haut nach der Geburt, blasse
Dehnungsstreifen, Linea nigra, reifere Haut mit feiner Textur und Altersflecken,
abgetragener Ehering.

### Gegen den AI-Look

```
Photorealistic documentary photograph, shot on a Canon EOS R6 with a 35mm f/1.8
lens, available natural daylight only, no flash, no studio lighting, no beauty
retouching, no skin smoothing. Slightly imperfect, candid framing as if taken
quickly by a friend. Subtle sensor grain, natural colour, gentle contrast, no
HDR, no glossy commercial polish, no lens flare, no bokeh balls, no
plastic-looking skin.
```

Ein Kameramodell plus Brennweite plus Blende wirkt zuverlässig stärker als jedes
„make it look real". Und: Unordnung im Raum hilft. Ungemachtes Bett,
Wäschekorb, Kalkflecken am Wasserhahn.

---

## 5. Text im Bild

Nano Banana setzt Text inzwischen zuverlässig, auch mit Umlauten, wenn man es
präzise sagt. Alles vier Angaben machen:

```
In the lower third, on the left, one short line of German text in a bold
geometric sans-serif, dark charcoal, approximately one twelfth of the image
height, reading exactly: Die Lücke.
Directly under it, one thinner smaller line in the same typeface, medium grey,
approximately half that size, reading exactly: kein Fett.
No other text, no numbers, no logo, no captions and no watermark anywhere.
```

- **Wortlaut** hinter `reading exactly:` und danach den Satz sauber abschließen.
- **Position** in Bilddritteln oder Ecken, nicht in Pixeln.
- **Größe** als Anteil der Bildhöhe („one twelfth of the image height").
- **Schriftcharakter** beschreiben (bold geometric sans-serif, condensed
  sans-serif, humanist serif). Konkrete Schriftnamen funktionieren nur
  unzuverlässig, der Charakter fast immer.
- Immer die Negativliste dahinter, sonst erfindet das Modell Zusatztext.

Je weniger Text, desto zuverlässiger. Zwei kurze Zeilen sind sicher, ein
Fließtextblock wird fehlerhaft. Bei kleinem Text (Fußnoten in einem
UI-Mockup) muss man mit Buchstabendrehern rechnen. Im Feed fällt das nicht auf,
in einer Landingpage-Grafik schon.

---

## 6. Referenzbilder anhängen

Drei Anwendungsfälle, alle mit `inlineData` **vor** dem Prompt:

### a) Produkttreue

Echtes Produktfoto anhängen, im Prompt darauf verweisen:

```
Reproduce the black abdominal EMS belt from the attached reference image
EXACTLY: same shape, same electrode pads, same silver control unit, same strap.
```

### b) Stilkette über eine Serie

Bild 1 frei generieren, Bild 2 mit Bild 1 als Referenz, Bild 3 mit Bild 2 und so
weiter (`attachIdx` im Skript). Dazu im Prompt:

```
Keep the exact same woman, clothing, mat and style consistent with the
reference image.
```

So bleiben die vier Selbsttest-Schritte dieselbe Person im selben Raum.

### c) Echte UI in ein Mockup setzen

Screenshot der eigenen Seite anhängen. Das ist der Trick, der die
„das ist ein Quiz"-Ads glaubwürdig macht. Der Prompt muss die Reproduktion sehr
hart einfordern, sonst erfindet das Modell eine eigene App:

```
The attached image is a screenshot of a mobile web page. Place this screenshot
unchanged onto the screen of a smartphone. Do not redesign it, do not invent a
different app, do not replace the illustrations, do not change any word. Keep
the exact same layout, the exact same colours, the exact same German wording,
the exact same progress bar, the exact same question headline and the exact
same four picture answer cards. Only adapt it to the perspective of the phone
screen.
```

Wenn dieser Block **zu spät** im Prompt steht, wird er ignoriert. Er gehört an
den **Anfang**, vor die Foto-Beschreibung. Das war der Unterschied zwischen
einem brauchbaren Mockup und einem erfundenen Quiz mit Fantasiedeutsch.

#### Screenshot der eigenen Seite ziehen (headless)

```bash
python3 -m http.server 8765 &                  # Repo-Root ausliefern
chromium-browser --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir=/root/shots/prof --virtual-time-budget=12000 \
  --window-size=430,932 --screenshot=/root/shots/screen.png \
  "http://localhost:8765/pfad/zur/seite/"
```

Chromium aus dem Snap darf nicht überall hin schreiben. Ziel im Home-Verzeichnis
wählen, nicht in ein Temp-Verzeichnis mit ungewöhnlichen Rechten.

Für Seiten hinter einem Cookie-Banner oder mehreren Klicks: eine kleine
Treiberseite bauen, die die Seite in einen `iframe` gleicher Origin lädt, das
Consent-Cookie setzt und sich per JS durchklickt. Dann die Treiberseite
screenshotten. `--user-data-dir` sorgt dafür, dass das Cookie über mehrere
Aufrufe erhalten bleibt.

---

## 7. Anwendungsfall: Quiz- und Landingpage-Illustrationen

Beispiel: die vier Selbsttest-Schritte im WikiHow-Stil
(`scripts/gen-selbsttest.mjs`).

- **Ein gemeinsamer `STYLE`-Block** für alle Schritte, inklusive vollständiger
  Personenbeschreibung. Der Block enthält auch die Zielgruppenvorgabe
  (durchschnittlicher Körper, keine Sportlerin).
- **Verkettung** über `attachIdx`, damit Figur, Kleidung, Matte und Raum
  identisch bleiben.
- **1:1**, weil die Karten quadratisch angezeigt werden.
- **Kein Text im Bild.** Die Beschriftung macht das HTML, sonst ist sie nicht
  editierbar und nicht barrierefrei.
- Wenn ein Schritt eine Geste zeigt, die der Nutzer nachmachen soll, muss die
  Geste eindeutig sein. Formulierung, die funktioniert hat:

```
Index finger and middle finger are held tightly together, pointing straight
down along the body's midline, pressed flat side by side into the vertical
midline groove two to three centimetres above the navel, which stays clearly
visible just below the fingertips. Ring finger and little finger are curled
away and do not touch the belly.
```

Der Zusatz zu Ringfinger und kleinem Finger ist kein Detailwahn: ohne ihn liegt
regelmäßig die ganze Hand auf.

---

## 8. Anwendungsfall: Ads

Grundformat **3:4**. Pro Kampagne vier Motive, und die müssen sich **stark**
unterscheiden. Meta sortiert visuell ähnliche Creatives in dieselben
Delivery-Buckets, dann laufen alle vier Ads bei derselben Teilzielgruppe und du
zahlst für Überschneidung statt für Reichweite.

Bewährtes Set aus vier Archetypen:

| Nr. | Archetyp | Was es leistet |
|---|---|---|
| 01 | Makro-Foto vom Problem oder vom Selbsttest | körperlich, sofort erkennbar |
| 02 | Echte UI auf einem Gerät (Handheld oder Flatlay) | signalisiert „das ist ein Test" |
| 03 | Alltags-Schnappschuss in einer echten Situation | Wiedererkennung |
| 04 | Flache Erklär-Illustration | bricht das Foto-Raster, wirkt redaktionell |

Zusätzlich zwischen zwei Kampagnen die Umgebung trennen: eine Serie warm und im
Schlafzimmer, die andere kühler in Bad und Küche. Sonst kollidieren die
Kampagnen untereinander.

Weitere Punkte:

- **Wenig bis kein Text im Bild.** In der Praxis: zwei von vier Motiven ganz
  ohne Text, das Illustrationsmotiv mit maximal zwei kurzen Zeilen.
- **Nackte Haut vorsichtig.** Anatomische Illustrationen bekommen ein
  Sport-BH-Element, sonst Ablehnungsrisiko:
  `The chest is fully covered by a simple flat sports bra shape drawn as one plain rounded band, no cleavage.`
- **Keine Vorher-Nachher-Körperbilder.** Im Health-Bereich regelmäßiger
  Ablehnungsgrund.
- Motiv immer gegen die Zielgruppe prüfen, bevor es in die Kampagne geht: Würde
  sich diese Person selbst darin erkennen?

---

## 9. Anwendungsfall: Direct-Response-Bundle-Bild

Das Angebotsbild auf der Produktseite, das Hauptprodukt plus Boni zeigt. Referenz
im Repo: `assets/bundle_image.png`.

Aufbau, der funktioniert:

```
Direct-response offer bundle image for an e-commerce landing page.
Reproduce the <Produkt> from the attached reference image EXACTLY: <Merkmale>.
Place it large and centred, standing upright on a plain white cylindrical
pedestal, three-quarter view, soft studio light, crisp product photography.
Around it, three smaller floating white rounded cards with soft edges:
bottom left a tablet showing a video course thumbnail, bottom right a stack of
two printed guides with a checklist page, top centre a small pill-shaped badge.
On the top badge, one line of German text in a bold geometric sans-serif, dark
charcoal, reading exactly: inkl. Bonus-Paket.
Under the tablet card, two centred lines in the same typeface reading exactly:
Videokurs / (3 x 20 Min.).
Landscape 4:3 composition.
```

Reihenfolge im Prompt: Produkt zuerst und groß, dann die Boni als kleinere
Karten drumherum, dann die Beschriftungen, dann Hintergrund und Format.

Wenn mehrere echte Produktfotos beteiligt sind, alle als Referenz anhängen und
im Prompt jeweils benennen („the belt from the first reference image, the box
from the second reference image").

---

## 10. Freisteller: Hintergrund sauber entfernen

Nano Banana kann **keine** Transparenz erzeugen. Der Hintergrund muss deshalb so
generiert werden, dass er sich hinterher verlustfrei entfernen lässt.

### Getestet, mit Ergebnis

**Weiß als Hintergrund funktioniert nicht,** sobald das Motiv selbst weiße
Flächen hat. Beim Bundle-Bild sind genau die weißen Bonus-Karten mit
weggeflutet, weil sie farblich nicht vom Hintergrund zu trennen sind.

**Chroma-Key funktioniert.** Derselbe Prompt mit reinem Grün als Hintergrund
lieferte einen sauberen Freisteller: Karten vollständig erhalten, Kanten sauber,
keine Löcher.

Also im Prompt:

```
CRITICAL: the entire image sits on a pure, perfectly uniform chroma-key green
background, exact RGB 0,255,0. No gradient, no vignette, no texture, no floor
line, no reflection and no drop shadow that touches any edge of the frame.
Nothing in the artwork itself is green.
Every object keeps a clear margin of at least eight percent of the image width
to all four edges; nothing is cropped by the frame.
```

Die Farbe so wählen, dass sie im Motiv nirgends vorkommt. Grün bei einem
schwarzen Gerät mit weißen Karten, Magenta bei einem grünen Produkt.

Der Randabstand ist die zweite Fehlerquelle: das Modell hält ihn nicht immer
ein. Nach der Generierung prüfen, ob unten etwas angeschnitten ist, und bei
Bedarf mit gleichem Seed und verschärfter Formulierung nachziehen
(`the pedestal is fully visible including its base, well above the bottom edge`).

### Freistellen

```bash
python3 scripts/remove-bg.py in.png out.png --tol 60
```

Das Skript flutet von allen vier Bildrändern aus über zusammenhängende
Hintergrundpixel. Ein globaler Farb-Key würde auch Flächen **innerhalb** des
Motivs löschen, Flood-Fill kann das nicht. Zusätzlich:

- weicher Alphaübergang an der Kante statt harter Kante,
- optionaler Erhalt eines weichen Schlagschattens (`--keep-shadow`),
- Zuschnitt auf den sichtbaren Inhalt mit einem Prozent Sicherheitsrand.

Toleranz: bei Chroma-Key `--tol 60`, bei Weiß `--tol 20`. Das Skript warnt, wenn
es fast keinen Hintergrund findet, das heißt in der Regel: der Hintergrund war
nicht einfartig genug, Bild neu generieren statt an der Toleranz drehen.

### Ergebnis prüfen, bevor es in die Seite kommt

```python
from PIL import Image
im = Image.open('out.png').convert('RGBA')
bg = Image.new('RGBA', im.size, (255, 0, 255, 255))   # Magenta zeigt Löcher
bg.alpha_composite(im)
bg.convert('RGB').save('check.png')
```

Auf Magenta sieht man sofort, ob innen etwas weggefressen wurde oder Kanten
ausgefranst sind. Erst danach als PNG mit Alpha in `assets/` legen und in die
Landingpage einbinden.

---

## 11. QA vor dem Einbau

- [ ] Jedes Bild einmal wirklich angesehen, nicht nur der Exitcode geprüft.
- [ ] Gefragte Geste oder Kernaussage tatsächlich erkennbar?
- [ ] Deutscher Text buchstabengenau, Umlaute korrekt?
- [ ] Kein ungewollter Zusatztext, kein erfundenes Logo?
- [ ] Hände und Finger plausibel (klassischer Schwachpunkt)?
- [ ] Körperbild trifft die Zielgruppe, kein Fitnessmodel?
- [ ] Seitenverhältnis passt zum Einsatzort, nichts wird beschnitten?
- [ ] Dateiname und Endung stimmen mit der HTML-Referenz überein?
- [ ] Bei Ads: sehen die vier Motive wirklich unterschiedlich aus?

---

## 12. Vorhandene Skripte

| Skript | Zweck |
|---|---|
| `scripts/gen-rektus-ads-v2.mjs` | 8 Ad-Motive 3:4, aktuelle Vorlage für alles |
| `scripts/gen-selbsttest.mjs` | Selbsttest-Schritte im WikiHow-Stil, verkettet |
| `scripts/gen-rektus-images.mjs` | Funnel-Bilder, Lückenbreiten, Anwendungsszenen |
| `scripts/remove-bg.py` | Freisteller per Flood-Fill vom Bildrand |

Alle laufen mit `node scripts/<name>.mjs [jobname ...]` und generieren ohne
Argument die komplette Serie.
