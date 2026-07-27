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

### Die Tools, die für einen Launch gebraucht werden

Stand 2026-07-27, alle mit Präfix `mcp__facebook-ads__`:

| Tool | Wofür |
|---|---|
| `ads_get_ad_accounts` | Account-ID finden, `is_ads_mcp_enabled` prüfen |
| `ads_get_user_pages` | Page-ID |
| `ads_get_ig_accounts` | Instagram-ID (braucht `ad_account_id`) |
| `ads_get_datasets` | Pixel-ID und ob Browser **und** Server feuern |
| `ads_get_ad_entities` | bestehende Kampagnen/Ad Sets als Vorlage lesen |
| `ads_get_creatives` | bestehende Creatives inkl. Text und Page-ID lesen |
| `ads_create_campaign` / `ads_create_ad_set` / `ads_create_creative` / `ads_create_ad` | anlegen |
| `ads_update_entity` | Budget, Name, Targeting nachträglich ändern |
| `ads_get_ad_preview` | Rendering prüfen, gibt eine `preview_url` zurück |
| `ads_get_errors` | auslieferungsblockierende Fehler |
| `ads_activate_entity` | erst nach dem Go auf aktiv setzen |

Zwei Eigenheiten, die Zeit kosten, wenn man sie nicht kennt:

- **`ads_get_ad_entities` hat pro Level eine eigene Feldliste.** `promoted_object`,
  `billing_event`, `destination_type` und `special_ad_categories` sind dort nicht
  lesbar. Die Fehlermeldung listet die erlaubten Felder auf, also einmal absichtlich
  falsch abfragen ist der schnellste Weg an die Liste.
- **`ads_get_errors` will die Ad-Account-ID**, nicht die Kampagnen-IDs. Mit
  Kampagnen-IDs kommt „Could not resolve an ad account from entity_ids".

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

### Welche Events unter welchem Ziel erlaubt sind

**`OUTCOME_SALES` akzeptiert `custom_event_type: "LEAD"` nicht.** Der Versuch
scheitert mit „Conversion-Event nicht verfügbar", Fehlercode 100, Subcode
**2446814**. Das ist eine harte Grenze, kein Rechteproblem. Wer auf Lead
optimieren will, braucht `OUTCOME_LEADS` als Kampagnenziel und muss die Kampagne
neu anlegen, denn das Objective ist nach dem Anlegen nicht mehr änderbar.

Deshalb: **vor dem Anlegen entscheiden, worauf optimiert wird.** Der Rückgabewert
von `ads_create_campaign` enthält `valid_optimization_goals` und
`recommended_optimization_goal` für das gewählte Ziel. Diese Liste lesen, bevor
das Ad Set gebaut wird.

Unter `OUTCOME_SALES` sind an Pixel-Events unter anderem PURCHASE, ADD_TO_CART
und INITIATE_CHECKOUT nutzbar, LEAD nicht.

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

**Der MCP nimmt kein lokales Bild entgegen. Beide Wege brauchen eine öffentlich
erreichbare URL.** Das ist die wichtigste Planungsentscheidung: die Creatives
müssen vor dem Kampagnenbau auf einer öffentlichen Domain liegen. In diesem Repo
heißt das: Bilder committen, pushen, GitHub Pages ausliefern lassen, dann mit
`curl -o /dev/null -w "%{http_code}"` prüfen, dass jede Datei 200 liefert.

Zwei Wege:

**A) Vorab ins Bildarchiv hochladen (wenn verfügbar).**
`ads_creative_upload_image` mit `image_url`, liefert einen `image_hash` zurück,
den man dann in beliebig vielen Creatives wiederverwendet.
Achtung: Das Tool ist **pro Ad-Account freigeschaltet**. Für Wellenpuls kam am
2026-07-27 „This tool is new and is being gradually rolled out across ad
accounts." Das ist kein Fehler in der Anfrage, es gibt nur noch keinen Zugang.

**B) URL direkt ins Creative (funktioniert immer).**
`ads_create_creative` akzeptiert `image_url` anstelle von `image_hash`. Meta holt
sich das Bild beim Anlegen selbst. Ein Roundtrip weniger pro Bild, und es
umgeht die Freischaltung komplett. Für einen Launch mit acht Motiven ist das der
schnellste Weg.

Weitere Punkte:

- Google Drive, Dropbox und ähnliche Share-Links funktionieren **nicht**. Meta
  bekommt dort eine HTML-Zwischenseite statt der Bildbytes. Es muss ein direkter
  Link auf die Datei sein.
- Format: JPG oder PNG, unter 30 MB. Für Feed und Reels ist **3:4 oder 4:5** die
  beste Wahl, 1:1 nur wenn es sein muss. Mindestens 1080 px auf der kurzen Kante.
- Textanteil im Bild spielt seit dem 20-Prozent-Aus keine formale Rolle mehr,
  wenig Text liefert aber weiterhin messbar bessere Auslieferung.
- **KI-generierte Motive:** `self_ai_disclosure: "OPT_IN"` am Creative setzen.
  Meta blendet je nach Auslieferungsregion ein „AI info"-Label ein.

### Creatives sind unveränderlich

`ads_update_entity` kann Namen, Budget und Targeting ändern, aber **keinen
Creative-Inhalt**. Wer Primary Text, Headline, Bild oder CTA ändern will, legt
ein neues Creative an und darauf eine neue Ad. Deshalb: Texte vorher final
abstimmen, nicht im Ads Manager nachbessern wollen.

---

## 6. UTM-Parameter

Im Ads Manager gehören UTMs ins Feld `url_tags`. **Der MCP bietet `url_tags`
nicht an** (`ads_create_creative` kennt das Feld nicht). Sie werden deshalb direkt
an `link_url` gehängt. Die dynamischen Platzhalter funktionieren dort genauso.

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

1. Checkliste aus Abschnitt 1 vollständig vorliegen, **inklusive der Entscheidung
   für das Optimierungs-Event** (siehe Abschnitt 3, danach nicht mehr änderbar).
2. Tools auflisten, Ad-Account verifizieren, bestehende Kampagne als Vorlage lesen.
3. Bilder pushen und öffentliche Erreichbarkeit mit `curl` prüfen.
4. `ads_create_campaign`: Objective, `buying_type: AUCTION`,
   `campaign_daily_budget` in Cent (bei CBO), `campaign_bid_strategy`,
   `special_ad_categories: "[]"`. Antwort enthält `valid_optimization_goals`.
5. `ads_create_ad_set`: `billing_event: IMPRESSIONS`,
   `optimization_goal: OFFSITE_CONVERSIONS`, `destination_type: WEBSITE`,
   `promoted_object` mit `pixel_id` und `custom_event_type`, Targeting mit
   `geo_locations` und `targeting_automation.advantage_audience: 1`.
6. Pro Ad: `ads_create_creative` (Page-ID, `image_url`, `message`, `headline`,
   `link_url` inklusive UTMs, `call_to_action_type`, `self_ai_disclosure`), dann
   `ads_create_ad` mit `creative_id` und `conversion_domain`.
7. `ads_get_ad_preview` pro Ad, mindestens `MOBILE_FEED_STANDARD`. Die
   zurückgegebene `preview_url` an den Auftraggeber weitergeben.
8. `ads_get_errors` mit der **Ad-Account-ID** laufen lassen, muss leer sein.
9. Erst nach explizitem Go `ads_activate_entity`, Kampagne zuerst, dann Ad Set,
   dann Ads.

### Was der MCP automatisch macht

- **Alles wird als `PAUSED` angelegt.** Auch `ads_update_entity` erzwingt PAUSED
  (`status_forced_to_paused: true`). Aktivieren geht nur über `ads_activate_entity`.
- **DSA-Felder** (`dsa_beneficiary`, `dsa_payor`) werden bei EU-Geo automatisch
  aus dem Business-Namen gefüllt. Nur explizit setzen, wenn ein anderer
  Auftraggeber genannt werden muss.
- **Attribution** wird auf `7d click + 1d view` gesetzt, wenn nichts angegeben ist.
- **Advantage+ Audience:** Mit `advantage_audience: 1` werden `age_min` und
  `age_max` zu `age_min_suggestion` / `age_max_suggestion` umgeschrieben, also zu
  Signalen statt harten Grenzen. Wer ein echtes Alterslimit braucht, muss
  `advantage_audience: 0` setzen und damit A+ abschalten.

**Special Ad Categories:** Gesundheitsprodukte fallen in Deutschland nicht
automatisch darunter. Kredit, Wohnen, Beschäftigung und Politik schon. Falsch
gesetzt kostet es Targeting-Optionen, gar nicht gesetzt kann zur Sperre führen.

**Budget in Cent:** 10 € = `1000`. Und die Frage „10 € pro Ad" oder „10 € pro
Funnel" vorher klären, das ist bei vier Ads der Unterschied zwischen 1000 und
4000.

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

## 12. Referenzsetup (real gebaut, zum Abgucken)

### Wellenpuls, Rektusdiastase-Quizfunnels (2026-07-27)

Ad-Account `1314232876440022` (Wellenpuls, EUR) · Business `439198905947427`
Page `1176219138898672` (Stabil im Alltag) · Pixel `576311248662294`
IG verfügbar: `17841470317450937` (`wellenpuls_gmbh`), hier nicht gesetzt,
damit die Page-eigene IG-Identität greift wie in der bestehenden Quiz-Kampagne.

| Einstellung | Wert |
|---|---|
| Ziel | `OUTCOME_SALES` |
| Budget | CBO **10 €/Tag pro Kampagne** (`campaign_daily_budget: 1000`) |
| Gebot | `LOWEST_COST_WITHOUT_CAP` |
| Optimierung | `OFFSITE_CONVERSIONS`, `custom_event_type: PURCHASE` |
| Abrechnung | `IMPRESSIONS` |
| Geo | DE, `location_types: home, recent` |
| Zielgruppe | Advantage+ Audience, Alter nur als Signal (25–45 bzw. 42–62) |
| Placements | automatisch |
| CTA | `LEARN_MORE` |
| `conversion_domain` | `stabil-im-alltag.de` |
| Struktur | 1 Kampagne → 1 Ad Set → 4 Ads |
| Status | alles `PAUSED` |

| | Postpartum | Wechseljahre |
|---|---|---|
| Kampagne | `120253988128180029` | `120253988128850029` |
| Ad Set | `120253988318020029` | `120253988318920029` |
| Ads | `120253988367300029`, `120253988370520029`, `120253988373810029`, `120253988377330029` | `120253988394940029`, `120253988399300029`, `120253988402240029`, `120253988404800029` |

Copy und Bildzuordnung: `rektusdiastase/ads/ADS-2026.md`.

### BrustBizeps-Quizfunnels

Dokumentiert in
`/root/projects/bb-projects/bb-aktion-landingpages/docs/quiz-ad-campaigns.md`.
Gleiche Struktur, aber Geo DACH und CBO 10 €/Tag bei ebenfalls vier Ads.
