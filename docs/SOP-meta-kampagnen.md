# SOP: Meta-Kampagnen über MCP launchen

Stand 2026-07-27. Gilt für alle Funnelarten, nicht nur Quizfunnels.
Schwesterdokument: [SOP-nano-banana.md](SOP-nano-banana.md) (Bildproduktion).

---

## 0. Zugang herstellen (einmalig je Projekt)

Der offizielle Meta-Ads-MCP hängt **pro Projektverzeichnis** in der Claude-Config.
Er ist nicht global. In einem neuen Repo ist er deshalb erst mal nicht da, auch
wenn er in einem anderen Projekt funktioniert hat.

`.mcp.json` im Projekt-Root:

```json
{
  "mcpServers": {
    "facebook-ads": { "type": "http", "url": "https://mcp.facebook.com/ads" }
  }
}
```

Danach **Session neu starten**. MCP-Server werden nur beim Sessionstart geladen,
eine laufende Session bekommt den Server nicht mehr mit. Beim ersten Aufruf
läuft ein OAuth-Flow im Browser, der interaktiv bestätigt werden muss.

Alternativ ohne Datei: `claude mcp add --transport http facebook-ads https://mcp.facebook.com/ads`.

### Schritt 0 in jeder neuen Session

Bevor irgendetwas gebaut wird, die tatsächlich vorhandenen Tools auflisten
(`ToolSearch` mit `meta ads` / `+ad account` / `campaign`). Der Toolschnitt von
`mcp.facebook.com/ads` ändert sich, Toolnamen aus einem alten Chat nicht blind
übernehmen. Dann einmal die Ad-Accounts auflisten lassen und die Account-ID
gegen die erwartete prüfen, bevor geschrieben wird.

---

## 1. Informations-Checkliste vor dem Launch

Ohne diese Angaben gar nicht erst anfangen. Fehlt eine, vorher klären.

| # | Angabe | Beispiel / Quelle |
|---|---|---|
| 1 | Ad-Account-ID + Währung | `act_519019233368220`, EUR |
| 2 | Facebook-Page-ID | `110036545072376` |
| 3 | Instagram-Account-ID | `17841408120911561` (optional, sonst Page-Backed) |
| 4 | Pixel-ID | `576311248662294` |
| 5 | Verifizierte Domain | `stabil-im-alltag.de` (Business Manager → Brand Safety) |
| 6 | Kampagnenziel | Sales / Leads / Traffic / Awareness |
| 7 | Optimierungs-Event | Purchase, Lead, InitiateCheckout … |
| 8 | Budget + Verteilung | 10 €/Tag pro Ad, CBO oder ABO |
| 9 | Geo + Sprache | DE, oder DACH (DE/AT/CH) |
| 10 | Ziel-URLs je Ad | vollständig, inkl. Trailing Slash |
| 11 | Creatives | Bilddateien lokal + Primary Text + Headlines je Ad |
| 12 | CTA-Button | `LEARN_MORE`, `SHOP_NOW`, `SIGN_UP` … |
| 13 | Conversion-Domain | die Domain, auf der das Optimierungs-Event feuert |
| 14 | Startstatus | in aller Regel `PAUSED` |

Punkt 13 ist der, der am häufigsten Ärger macht: `conversion_domain` muss die
Domain sein, auf der das **optimierte** Event feuert, nicht die, auf die die Ad
klickt. Wenn die Ad auf `try.example.com` klickt und der Kauf auf `example.com`
passiert, gehört `example.com` hinein.

---

## 2. Objekthierarchie

```
Kampagne (Ziel, Budget bei CBO, Kaufart)
  └── Ad Set (Budget bei ABO, Zielgruppe, Placements, Optimierungs-Event, Zeitplan)
        └── Ad (verweist auf ein Ad Creative)
              └── Ad Creative (Bild/Video + Primary Text + Headline + Link + CTA)
```

Zwei sinnvolle Strukturen:

**A) 1 Kampagne → 1 Ad Set → N Ads** (Standard für Kaltstart, CBO)
Alle Creatives teilen sich ein Ad Set, damit Advantage+ zwischen ihnen
optimieren kann. Weniger Fragmentierung, schnelleres Lernen. Genau so sind die
BrustBizeps-Quizkampagnen aufgesetzt.

**B) 1 Kampagne → N Ad Sets → je 1 Ad** (ABO, für erzwungene Verteilung)
Nur nehmen, wenn du jedem Creative garantiert Budget geben willst, etwa im
strukturierten Creative-Test. Kostet Effizienz.

### CBO vs. ABO

| | CBO (`Advantage Campaign Budget`) | ABO |
|---|---|---|
| Budget sitzt auf | Kampagne (`daily_budget` an der Kampagne) | Ad Set (`daily_budget` am Ad Set) |
| Meta verteilt | automatisch zwischen Ad Sets | gar nicht, du bestimmst |
| Gut für | Skalierung, breite Zielgruppen, Standardfall | saubere A/B-Tests, Nischen-Audiences |

**Budgetrechnung bei „10 € pro Ad":** Bei Struktur A und CBO liegt das Budget auf
der Kampagne. Vier Ads mit je 10 € heißt: **Kampagnenbudget 40 €/Tag**, nicht 10.
Beträge werden in Cent angegeben: 40 € = `daily_budget: 4000`.

---

## 3. Ziel und Optimierungs-Event nach Funnelart

Das Ziel bestimmt, welche Optimierungs-Events überhaupt wählbar sind.

| Funnelart | Objective | Optimierung | Anmerkung |
|---|---|---|---|
| Ad → Produktseite → Checkout | `OUTCOME_SALES` | Purchase | Standard, sobald genug Volumen da ist |
| Ad → Quiz → LP → Checkout | `OUTCOME_SALES` | Purchase, sonst Lead | Kauf liegt drei Schritte hinter der Ad |
| Ad → Advertorial → LP → Checkout | `OUTCOME_SALES` | Purchase oder AddToCart | |
| Ad → Lead-Formular (on-site) | `OUTCOME_LEADS` | Lead | |
| Ad → Instant Form (on-Meta) | `OUTCOME_LEADS` | Lead-Formular | kein Pixel nötig, dafür schlechtere Leadqualität |
| Ad → App | `OUTCOME_APP_PROMOTION` | App-Event | |
| Retargeting Warm | `OUTCOME_SALES` | Purchase | eigene Kampagne, nicht ins Kaltstart-CBO mischen |

**Faustregel Optimierungstiefe:** Meta braucht rund **50 Conversions pro Ad Set
und Woche**, um aus der Lernphase zu kommen. Rechne vor dem Launch:

```
Tagesbudget × 7 ÷ erwarteter CPA ≥ 50 ?
```

Bei 40 €/Tag und einem 489-€-Produkt mit CPA 120 € sind das 2,3 Käufe pro
Woche. Das reicht nicht. Dann eine Ebene früher optimieren (Lead = Quizabschluss
oder AddToCart), Volumen sammeln und erst später auf Purchase hochziehen.

---

## 4. Creative: Texte, Limits, Formatierung

### Wie viele Felder gehen?

| Feld | Standard-Creative (`object_story_spec.link_data`) | Advantage+ / Flexible Creative (`asset_feed_spec`) |
|---|---|---|
| Primary Text (`message` / `bodies`) | 1 | bis 5 |
| Headline (`name` / `titles`) | 1 | bis 5 |
| Description (`description`) | 1 | bis 5 |
| Bilder | 1 pro Creative | bis 10 im Asset-Feed |

Wenn zwei Headline-Varianten getestet werden sollen, gibt es zwei Wege:
entweder **zwei Ads** mit identischem Bild und unterschiedlicher Headline (saubere
Auswertung, mehr Fragmentierung), oder **eine Ad mit Asset-Feed** und beiden
Headlines (Meta rotiert selbst, Auswertung nur noch aggregiert). Für den ersten
Launch: pro Ad die stärkere Headline setzen, die zweite als dokumentierte
Reserve für die Iteration.

### Zeichenzahl

- Primary Text: mobil wird nach rund **125 Zeichen** mit „Mehr ansehen" gekürzt.
  Der Hook muss vollständig davor stehen. Danach darf ausführlich weitergehen.
- Headline: **27 bis 40 Zeichen** werden ohne Umbruch angezeigt, technisch sind
  bis 255 möglich. Über 40 wird abgeschnitten dargestellt.
- Description: rund 27 Zeichen sichtbar, wird in vielen Placements gar nicht
  ausgespielt. Nicht darauf verlassen.

### Zeilenumbrüche und Absätze

Der Primary Text wird als JSON-String übergeben. Absätze sind **echte
Zeilenumbrüche** im String, also `\n`. Ein Leerzeile zwischen Absätzen ist `\n\n`.
Beim MCP-Call den Text mit echten Umbrüchen setzen, nicht mit `<br>` und nicht
mit einem Platzhalter. Bewährter Aufbau:

```
Zeile 1: Hook, allein stehend, unter 125 Zeichen.
(Leerzeile)
Absatz 2: Problem plus Mechanismus, zwei bis vier Sätze.
(Leerzeile)
Absatz 3: Call to Action mit Aufwand und Hürde ("2 Minuten, ohne E-Mail").
```

### Emojis

Sparsam und funktional. Maximal ein bis zwei pro Ad, am Ende der Hookzeile oder
direkt vor dem CTA, um den Blick zu führen. Keine Emoji-Bulletlisten
(`✅ … 📊 … 💡 …`), die lesen sich sofort nach Vorlage. Keine Emojis in
Headlines, dort kosten sie Zeichen und wirken billig.

### Textmuster, die vermieden werden

Keine erfundenen Chat-Screenshots, keine fiktiven Testimonials, keine
Vorher-Nachher-Körperbilder (im Health-Bereich regelmäßiger Ablehnungsgrund),
keine Gedankenstriche, keine Pfeilketten als Bullets, keine gleichlangen Sätze
in Serie. Gesundheitsversprechen immer als Einordnung formulieren, nie als
garantiertes Ergebnis, und niemals in der zweiten Person unterstellen, dass eine
Person eine Erkrankung hat („Du hast eine Rektusdiastase" ist ein Verstoß gegen
Metas Personal-Attributes-Policy, „Bleibt der Bauch trotz Rückbildung?" nicht).

---

## 5. Bilder: schnellster Weg in die Ad

Meta nimmt in einem Creative kein Bild als Datei entgegen. Der Ablauf ist immer:

1. **Upload ins Ad-Account-Bildarchiv.** Endpoint `POST /act_<ID>/adimages`, Body
   als Base64 oder Multipart. Über den MCP heißt das Tool je nach Version
   sinngemäß „upload ad image". Rückgabe ist ein **`image_hash`**.
2. **Creative bauen** und dort `image_hash` referenzieren, nicht die Datei.
3. **Ad** auf das Creative zeigen lassen.

Praktische Punkte:

- Der schnellste Weg ist, **alle Bilder einer Kampagne in einem Rutsch** hochzuladen
  und die Hashes einzusammeln, bevor die Creatives gebaut werden. Ein Roundtrip
  pro Bild plus ein Roundtrip pro Creative, sonst wird es unnötig langsam.
- Wenn der MCP nur Dateipfade akzeptiert, müssen die Bilder lokal liegen. URLs
  von der eigenen Domain gehen bei manchen Toolversionen auch, das ist aber
  nicht verlässlich. Lokale Datei ist der sichere Weg.
- Format: JPG oder PNG, unter 30 MB. Für Feed und Reels ist **3:4 oder 4:5** die
  beste Wahl, 1:1 nur wenn es sein muss. Mindestens 1080 px auf der kurzen Kante.
- Textanteil im Bild spielt seit dem 20-Prozent-Aus keine formale Rolle mehr,
  wenig Text liefert aber weiterhin messbar bessere Auslieferung.
- Bildhashes sind pro Ad-Account gültig und bleiben erhalten. Wiederverwendung
  über mehrere Creatives ist explizit erwünscht.

---

## 6. UTM-Parameter

UTMs gehören **nicht** in die `link`-URL, sondern in das Feld `url_tags` am
Creative. Meta hängt sie dann an jeden Klick an und du kannst die Ziel-URL sauber
halten. Wenn der MCP `url_tags` nicht anbietet, hilfsweise direkt an die URL
hängen, dann aber bei jeder Ad einzeln.

Bewährtes Schema:

```
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&utm_id={{campaign.id}}
```

Verfügbare dynamische Platzhalter:

| Platzhalter | Ergibt |
|---|---|
| `{{campaign.name}}` / `{{campaign.id}}` | Kampagnenname / -ID |
| `{{adset.name}}` / `{{adset.id}}` | Ad-Set-Name / -ID |
| `{{ad.name}}` / `{{ad.id}}` | Ad-Name / -ID |
| `{{site_source_name}}` | `fb`, `ig`, `an`, `msg` |
| `{{placement}}` | konkretes Placement |

Wichtig: In den Namen dürfen keine Leerzeichen und keine Sonderzeichen stehen,
sonst kommen kaputte UTM-Werte an. Deshalb die Namenskonvention unten.

**Auf der Landingpage muss die Attribution überleben.** Bei mehrstufigen Funnels
gehen die UTMs beim internen Weiterklicken verloren, wenn nichts dagegen getan
wird. In diesem Repo übernimmt das `assets/consent.js`: es schreibt `utm_*` und
`fbclid` beim ersten Seitenaufruf in ein Cookie (`sia_attr`, Pfad `/`), hängt sie
an alle internen Links wieder an und legt sie in jedes CAPI-Payload.

---

## 7. Namenskonvention

Konsequent, klein, keine Leerzeichen, weil die Namen in den UTMs landen.

```
Kampagne:  <marke>_<funnel>_<ziel>_<datum>        wp_quiz-menopause_sales_2026-07
Ad Set:    <geo>_<audience>_<optimierung>          de_broad_lead
Ad:        <nr>-<konzept>-<hook>                   01-selbsttest-makro-2finger
```

Der Ad-Name ist gleichzeitig `utm_content`. Er sollte deshalb das Creative so
beschreiben, dass du im Analytics-Report ohne Nachschlagen weißt, welches Bild
gemeint war.

---

## 8. Ablauf eines Launches

1. Checkliste aus Abschnitt 1 vollständig vorliegen.
2. Tools auflisten, Ad-Account verifizieren.
3. Bilder hochladen, Hashes sammeln.
4. Kampagne anlegen: Objective, Kaufart `AUCTION`, Budget (bei CBO),
   `status: PAUSED`, `special_ad_categories: []` (bzw. die zutreffende Kategorie,
   siehe unten).
5. Ad Set anlegen: Geo, Advantage+ Audience ohne Alters-/Demoeinschränkung,
   Placements automatisch, Optimierungsziel + Pixel + `custom_event_type`,
   `bid_strategy: LOWEST_COST_WITHOUT_CAP`, `conversion_domain`, `status: PAUSED`.
6. Pro Ad: Creative anlegen (Page-ID, IG-ID, `image_hash`, `message`, `name`,
   `link`, `call_to_action`, `url_tags`), dann Ad anlegen, `status: PAUSED`.
7. Alles im Ads Manager visuell gegenlesen. Der MCP zeigt keine Vorschau.
8. Erst nach explizitem Go auf `ACTIVE` setzen, Kampagne zuerst, dann Ad Set,
   dann Ads.

**Special Ad Categories:** Gesundheitsprodukte fallen in Deutschland nicht
automatisch darunter. Kredit, Wohnen, Beschäftigung und Politik schon. Falsch
gesetzt kostet es Targeting-Optionen, gar nicht gesetzt kann zur Sperre führen.

---

## 9. Tracking-Voraussetzungen prüfen

Vor jedem Launch einmal durchgehen:

- [ ] Pixel liegt auf **allen** Seiten des Funnels, auch auf Zwischenseiten.
- [ ] Consent-Gate: Pixel und CAPI feuern erst nach Einwilligung, und Events, die
      vor der Einwilligung ausgelöst werden, werden nachgefeuert.
- [ ] Jedes Event geht über Pixel **und** Conversions-API mit **derselben**
      `event_id`, sonst zählt Meta doppelt.
- [ ] CAPI-Payload enthält `fbp`, `fbc`, `client_user_agent`, `client_ip_address`
      und `event_source_url`. Ohne die ist die Match Quality schlecht.
- [ ] `fbclid` wird beim ersten Aufruf in `_fbc` überführt und überlebt die
      Navigation durch den Funnel.
- [ ] Optimierungs-Event feuert tatsächlich, im Events Manager unter
      „Testereignisse" mit echtem Klick prüfen, nicht nur im Code lesen.
- [ ] Domain im Business Manager verifiziert, `conversion_domain` passt dazu.
- [ ] Kein doppeltes Pixel-Init durch zwei eingebundene Skripte.

---

## 10. Nach dem Launch

- **Erste 48 Stunden nicht anfassen.** Jede Budget- oder Zielgruppenänderung
  setzt die Lernphase zurück.
- Nach 3 bis 4 Tagen: hängt ein Ad Set in „Learning Limited", ist entweder das
  Budget zu klein oder das Optimierungs-Event zu tief im Funnel. Erst das Event
  eine Stufe nach vorn ziehen, dann erst Budget erhöhen.
- Budgeterhöhungen in Schritten von maximal 20 Prozent alle zwei Tage.
- Creative-Rotation, nicht Copy-Rotation: neue Bilder bringen deutlich mehr als
  neue Textvarianten beim gleichen Bild.

---

## 11. Typische Fehler

| Symptom | Ursache |
|---|---|
| Ads laufen nicht an | Kampagne aktiv, Ad Set oder Ad noch pausiert |
| „Learning Limited" bleibt | Optimierungs-Event zu tief, Budget zu klein |
| Conversions doppelt gezählt | Pixel und CAPI ohne gemeinsame `event_id` |
| Attribution fehlt in Analytics | UTMs gehen beim internen Weiterklicken verloren |
| Ad abgelehnt (Health) | Vorher-Nachher-Bild oder persönliche Unterstellung im Text |
| Alle Ads erreichen dieselben Leute | Creatives visuell zu ähnlich, siehe Bild-SOP |
| Kaputte UTM-Werte | Leerzeichen oder Sonderzeichen in Kampagnen-/Ad-Namen |

---

## 12. Referenzsetup (funktioniert, zum Abgucken)

BrustBizeps-Quizfunnels, dokumentiert in
`/root/projects/bb-projects/bb-aktion-landingpages/docs/quiz-ad-campaigns.md`:

Ziel `OUTCOME_SALES`, CBO 10 €/Tag pro Kampagne, Optimierung Purchase, Lowest
Cost, Geo DACH, Advantage+ Audience broad ohne Demoeinschränkung, Placements
automatisch, CTA `LEARN_MORE`, Struktur 1 Kampagne → 1 Ad Set → 4 Ads, alles im
Status `PAUSED` zum Review.
