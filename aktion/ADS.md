# Rabattaktion – Retargeting, August 2026

Kampagne: `wp_aktion-rabatt_retarget_2026-08`
Ziel: Menschen, die die Wellenpuls-Anzeigen schon gesehen haben, direkt auf das
Angebot. Kein Quiz, kein Advertorial davor — die Zielgruppe ist product aware.

Landingpage: `https://stabil-im-alltag.de/aktion/`
Checkout: `https://stabil-im-alltag.de/aktion/checkout/`

Angebot: **389 € statt 489 €**, Komplettpaket unverändert, bis Sonntag,
16. August 2026. Gesamtwert des Pakets 732,80 €.

Rabattcode: **offen** — Berkan reicht ihn nach. Die Seite arbeitet aktuell ohne
Code, der Aktionspreis ist direkt eingepreist.

---

## akt-01 · Packshot mit Rabattzeile

Motiv: `assets/ads/aktion/akt-01-packshot-rabatt.jpg` (4:5) — echter Packshot

**Primary Text**

> Du hast dir den Wellenpuls LWS schon angesehen. Vielleicht war der Preis der Grund, warum du es dabei belassen hast.
>
> Bis Sonntag kostet das komplette Paket 389 € statt 489 €. Das Gerät, das 1:1 Gespräch mit Christian, der Videokurs, das E-Book, der Versand. Alles wie sonst, nur 100 € günstiger.
>
> 20 Minuten, zweimal die Woche, im Sitzen. Wenn du nach 30 Tagen keinen Unterschied merkst, bekommst du den Kaufpreis zurück.

**Headline:** 100 € günstiger, nur bis Sonntag
**CTA:** SHOP_NOW

---

## akt-02 · Anwendung am unteren Rücken

Motiv: `assets/ads/aktion/akt-02-anwendung-ruecken.jpg` (4:5) — echtes Foto

**Primary Text**

> Der Grund, warum die meisten mit ihren Rückenübungen aufhören, ist selten fehlende Disziplin. Es ist der Kalender.
>
> Der Wellenpuls LWS braucht keinen Termin. Gurt anlegen, Intensität hochregeln, 20 Minuten sitzen bleiben. Die tiefe Rückenmuskulatur arbeitet, du nicht.
>
> Bis Sonntag, dem 16. August, kostet das Komplettpaket 389 € statt 489 €.

**Headline:** 20 Minuten auf dem Sofa, 100 € günstiger
**CTA:** SHOP_NOW

---

## akt-03 · Komplettpaket

Motiv: `assets/ads/aktion/akt-03-paket-komplett.jpg` (4:5) — echtes Bundle-Rendering

**Primary Text**

> Was im Paket steckt, wenn du bis Sonntag bestellst:
>
> Den Wellenpuls LWS mit Reiseetui. Ein 1:1 Gespräch mit Christian, der das Gerät entwickelt hat. Den Videokurs. Das E-Book mit Checkliste. Versand in zwei Werktagen.
>
> Gesamtwert 732,80 €. Regulär 489 €. Bis zum 16. August 389 €. Einmalig, kein Abo, keine Folgekosten.

**Headline:** Das komplette Paket für 389 €
**CTA:** SHOP_NOW

---

## akt-04 · Preis, editorial

Motiv: `assets/ads/aktion/akt-04-preis-editorial.jpg` (4:5) — echter Packshot

**Primary Text**

> 489 € war der Preis, bei dem du gezögert hast. Bis Sonntag sind es 389 €.
>
> Am Gerät ändert das nichts: entwickelt an der Deutschen Sporthochschule Köln, patentangemeldet, gebaut für die tiefe Muskulatur im Lendenwirbelbereich. 30 Tage testen, sonst Geld zurück.
>
> Ab dem 17. August gilt wieder der reguläre Preis.

**Headline:** 389 € statt 489 €, bis 16. August
**CTA:** SHOP_NOW

---

## Warum die Motive nicht mehr generiert werden

Die erste Runde lief über `gemini-3.1-flash-image`. Der Gürtel kam dabei nur
annähernd richtig heraus, und in einem Motiv trug die Frau ihn über der
Bluse — eine Anwendung, die es so nicht gibt. Bei einem Publikum, das das
Produkt aus früheren Anzeigen kennt, kostet eine falsche Darstellung mehr
Glaubwürdigkeit, als ein überraschendes Bild an Aufmerksamkeit bringt.

Die Motive entstehen jetzt in `scripts/bau-aktion-ads.py` aus echten Aufnahmen:
freigestellter Packshot, Bundle-Rendering und das Anwendungsfoto vom unteren
Rücken. Typografie kommt aus Libre Franklin, Farben aus denselben
oklch-Token wie die Landingpage.

**Nicht verwenden: `assets/Anwendung-wellenpuls.jpg`.** Das Bild zeigt ein
anderes Gerät — Elektrodenpads außen, abweichende Bedieneinheit.

## Warum vier verschiedene Bildsprachen

Meta clustert visuell ähnliche Creatives in dieselben Delivery-Buckets. Vier
Motive im gleichen Stil konkurrieren dann gegeneinander statt die Auslieferung zu
verbreitern. Deshalb bewusst: Packshot mit Typo, Reportage mit Mensch, Flatlay
von oben, reine Preistypografie.

## Warum kein Countdown

Die Marke verbietet Teleshopping-Optik ausdrücklich (`kb show wellenpuls`, Tabu:
„Countdown und nur noch heute"). Die Frist ist deshalb ein echtes Datum, das auf
Landingpage, Checkout und in allen vier Anzeigen dasselbe sagt. Auf der
Checkout-Seite ist der 15-Minuten-Warenkorb-Countdown aus der regulären Seite
entfernt: es wird nichts reserviert, die Aussage wäre erfunden.
