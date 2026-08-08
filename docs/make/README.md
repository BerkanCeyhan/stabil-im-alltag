# Make-Blaupausen

Import: Make → Szenario öffnen → drei Punkte oben rechts → **Import Blueprint**.

| Datei | Szenario | Webhook |
| --- | --- | --- |
| `1-capi-relay.json` | Integration Webhooks, HTTP | `hook.eu2.make.com/7omhyj9v…` |
| `2-woocommerce-mollie.json` | Integration WooCommerce, Mollie | `hook.eu2.make.com/wk4v2q91…` |

## Vor dem Import

**Das Meta-Zugriffstoken steht als `PLATZHALTER_NEUES_TOKEN` in Datei 1.**
Das alte Token lag im Klartext in der URL und ist damit verbrannt. Neues Token
im Events Manager erzeugen, altes löschen, neues im Modul „HTTP → Make a
request" ins Feld **Headers** unter `Authorization` eintragen. Nicht in die URL:
was in der URL steht, landet in jedem exportierten Blueprint und in jedem Log.

## Was sich geändert hat

### 1 — CAPI-Relay

- Token wandert von der URL in den `Authorization`-Header.
- `em` (SHA-256 der E-Mail) wird mitgeschickt, sobald der Aufrufer eine
  Adresse liefert. Ohne sie kann Meta einen späteren Kauf auf einem anderen
  Gerät niemandem zuordnen — Cookies überleben das nicht.
- `fbc`, `fbp`, `client_ip_address` werden nur gesetzt, wenn sie gefüllt sind.
  Ein leerer String gilt bei Meta als ungültiger Wert und senkt die Event
  Match Quality.
- `action_source` und `currency` haben Rückfallwerte.

### 2 — WooCommerce und Mollie

**Neuer Zweig für die Aktion.** Der Router hat jetzt drei Routen statt zwei:

1. Checkout regulär — Filter: `first_name` existiert **und** `aktion` fehlt
2. Checkout Aktion — Filter: `aktion = sommer100`, mit
   `couponLines: [{ code: "SOMMER100" }]` und Rückleitung auf `/aktion/danke/`
3. Mollie-Webhook — unverändert im Aufbau, plus Kauf-Meldung am Ende

Ohne den Gutschein zieht Mollie 389,00 € ein, während die WooCommerce-Bestellung
aus den fest verdrahteten Produkten 489,00 € bildet. Der Gutschein bringt beide
Seiten auf denselben Betrag.

**Attribution reist in der Mollie-Metadata mit.** Statt nur der Bestellnummer:

    {"order_id":"…","email":"…","fbc":"…","fbp":"…",
     "event_id":"…","ua":"…","ip":"…","src":"ruecken|aktion"}

Das ist der einzige Träger, der die Weiterleitung über Mollie überlebt.
`woocommerce:UpdateOrder` liest die Bestellnummer daraus als
`{{13.metadata.order_id}}`.

**Purchase kommt jetzt vom Server.** Neues HTTP-Modul am Ende von Route 3,
gefiltert auf `{{13.status}} = paid`. Betrag aus `{{13.amount.value}}`, also
echtes Geld statt einer fest verdrahteten Zahl.

Vorher feuerte `ruecken/danke/index.html` beim bloßen Seitenaufruf ein Purchase
über 489 €. Mollie leitet aber auch bei Abbruch und Fehlschlag dorthin — jeder
abgebrochene Bezahlvorgang wurde als Kauf gezählt. Die Seiten feuern deshalb
kein Purchase mehr.

## Nach dem Import unbedingt prüfen

Eine echte Testzahlung durchspielen und im Log von Route 3 nachsehen, ob
`{{13.metadata.order_id}}` gefüllt ankommt. Falls Make die Metadata als reinen
Text zurückgibt statt als Struktur, kommt zwischen `mollie:getPayment` und
`woocommerce:UpdateOrder` ein Modul **JSON → Parse JSON**, und die Bezüge
zeigen dann auf dessen Ausgabe.

Ebenfalls prüfen: Mollie zieht 389,00 € ein **und** WooCommerce führt die
Bestellung mit 389,00 €.
