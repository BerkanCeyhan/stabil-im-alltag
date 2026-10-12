# Livegang 15.10.2026: Rücken- und Eltern-Kampagne

Die Quizzes laufen nicht mehr, Rektusdiastase ist vorerst raus. Ab Donnerstag, 15.10.2026, laufen zwei Kampagnen über Advertorials und Direktanzeigen auf die Landingpage: eine für Betroffene mit Rückenbeschwerden und eine für Menschen zwischen 40 und 55, die den Wellenpuls für ihre Mutter oder ihren Vater kaufen.

Kampagnenaufbau, Skripte, Statics und Sprachleitfaden: [../KAMPAGNEN-2026-10.md](../KAMPAGNEN-2026-10.md)

Stand 12.10.2026.

## Zielgruppe Eltern

**Wer kauft:** 40 bis 55 Jahre, kaufkräftig, Eltern über 70.

**Wer nutzt:** die Eltern, mit Beschwerden im unteren Rücken und nachlassender Kraft.

**Warum Blue Ocean:** Der Rückenmarkt für Betroffene ist umkämpft. Kinder, die für ihre Eltern kaufen, spricht im Markt niemand an. Keine der 52 aktiven Bodify-Anzeigen zielt auf Ältere oder Angehörige.

**Was sie antreibt:**

- Angst, dass die Eltern bald nicht mehr allein zurechtkommen
- Die Beobachtung, dass die Eltern zu wenig für sich tun
- Frust, der daraus bei einem selbst entsteht
- Angst, die Eltern bald zu sehr unterstützen zu müssen

## Erledigt am 12.10.

- [x] Physiotherapeuten-Empfehlung (Arno van Vonderen) von allen Seiten entfernt: `ruecken/lp`, `ruecken/lp2`, `ruecken/adv/1`, `aktion`, `rektusdiastase/lp-schwangerschaft`, `rektusdiastase/lp-menopause`
- [x] Bodify-Anzeigen gezogen, alle Videos transkribiert und ausgewertet: [research/BODIFY-ADS.md](research/BODIFY-ADS.md)
- [x] Geprüft: Quiz- und Rektus-Kampagnen sind pausiert. Aktiv sind nur noch "Advertorial Ads" (adv/1) und das Retargeting auf `/aktion/`.
- [x] Neue Landingpage `ruecken/lp3/` in der Sie-Form, mit Eltern-Variante über `?fuer=eltern`:
  - Paket mit Preis und Button ganz oben, darunter "So funktioniert der Wellenpuls" mit dem Kontraktions-Clip am Rücken
  - Garantie im Kopf, unter jedem Button und als eigener Block; Trust und Entstehungsgeschichte direkt danach
  - Funktionen vom Nutzen her erklärt
  - Countdown und erfundene Kaufmeldungen sind raus
- [x] Rücken-Advertorial `ruecken/adv/2/` mit den Advertorial-Erkenntnissen überarbeitet:
  - Hook mit Stehen, Gehen und Sitzen; Schmerz breit wie ein Gürtel; Schlaf, Jahre, Wut
  - neuer Abschnitt zu TENS, EMS und NMES
  - jetzt in der Sie-Form, der Button führt auf lp3
- [x] Eltern-Advertorial `ruecken/eltern/adv/`: Erfahrungsbericht eines Sohnes über seinen Vater, verlinkt auf `lp3/?fuer=eltern`. Name und Details an die echte Person anpassen, bevor Anzeigen darauf laufen.
- [x] Christians Anleitungsvideo geschnitten: der Teil ab dem Anlegen, mit Untertiteln (`assets/video/wellenpuls-anlegen.mp4`). Auf lp3 eingebunden.
- [x] "Wellenpuls in Action": Kontraktions-Clip am Rücken als MP4 und GIF (`assets/video/wellenpuls-kontraktion-ruecken.*`).
  - Higgsfield hatte 0 Credits, deshalb mit Nano Banana 2 und Google Veo erzeugt (`scripts/gen-kontraktion-ruecken.mjs`).
  - Auf den Seiten als "Animierte Darstellung" gekennzeichnet.
- [x] Kicker-Zeilen über den Überschriften in adv/1, adv/2 und im Eltern-Advertorial entfernt
- [x] Founder-Ad-Skripte (Rücken als Schnitt aus dem Gründerfilm, Eltern neu), B-Roll-Skripte und Statics-Konzept in [../KAMPAGNEN-2026-10.md](../KAMPAGNEN-2026-10.md)

## Bis zum Livegang (Do 15.10.)

- [ ] **Kaufmessung prüfen:** In 90 Tagen hat Meta keinen einzigen InitiateCheckout und keinen Kauf gemessen. Eine Testbestellung über lp3 machen und im Events Manager prüfen.
- [x] Committet und gepusht (GitHub Pages), Stand 12.10. abends
- [ ] **Eltern-Advertorial an die echte Person anpassen** (Name, Alter, Beruf, Szenen), bevor Anzeigen darauf laufen
- [ ] **Bestätigen (Christian):** Das 1:1-Gespräch kann auch direkt mit den Eltern stattfinden. lp3, das Eltern-Advertorial und das Eltern-Skript sagen das so.
- [ ] **Nutzungsrechte Ilona und Lorina klären,** bevor ihre Clips in bezahlte Anzeigen gehen. Bei Shabnam ist es geklärt.
- [ ] **Creatives produzieren:** R1 (Schnitt aus dem Gründerfilm), R2, R3, E2, E3 und die Statics S1 bis S6
- [ ] **Christian nimmt E1 auf** (Founder Ad Eltern)
- [ ] **Zwei Kampagnen anlegen** (Rücken, Eltern), je ein Ad Set für Advertorial und eins für die Direktanzeige. "Advertorial Ads" pausieren, sobald die neuen laufen.

## Danach

- [ ] Kontraktions-Clip durch echtes Material ersetzen (Drehliste in KAMPAGNEN-2026-10.md)
- [ ] A/B-Test 489 € gegen 299 € (braucht eine Preisvariante auf lp3 und einen Checkout, der den Betrag übernimmt)
- [ ] A/B-Tests für Aussagen (Hooks, Überschriften)
- [ ] Checkout und Cookie-Banner auf "Sie" umstellen, damit der ganze Funnel einheitlich ist
- [ ] Idee: 40 bis 50 Minuten VSL direkt bei Meta hochladen, als PowerPoint mit Sprechertext

## Research

- [ ] Leute aus dem eigenen Umfeld finden, die das Problem mit ihren Eltern haben, und befragen
- [ ] Im Netz suchen, wo Menschen darüber schreiben. Ideen: Amazon-Rezensionen von Rückentrainern und TENS-Geräten ("für meine Mutter gekauft"), gutefrage.net, Reddit, Facebook-Gruppen für pflegende Angehörige
- [ ] KI-Recherche zur Zielgruppe: Sprache, Ängste, Kaufauslöser

## Kundenbefragung (Christian)

Christian schreibt den Fragenkatalog und führt die Anrufe.

Einstieg:

> Hey, hier ist Christian, der Gründer von Wellenpuls, dem Trainingsgerät für den unteren Rücken. Ich rufe aktuell Kunden an und frage, wie zufrieden sie mit dem Gerät sind. Haben Sie eine Minute Zeit, oder ist es gerade ungünstig?

Fragen:

- Was waren die Beschwerden? Was haben Sie sich vom Gerät versprochen?
- Hat das Gerät Ihr Problem gelöst? Wenn ja, wie kam es dazu? Wenn nein, woran lag es?
- Vorschlag: Haben Sie das Gerät für sich gekauft oder für jemand anderen? Damit lässt sich die Eltern-These direkt prüfen.

Abschluss: um eine Bewertung bitten, im Austausch gibt es ein E-Book.

- [ ] Fragenkatalog fertigstellen (Christian)
- [ ] Anrufe führen und Antworten sammeln (Christian)
- [ ] Bewertungen einsammeln, E-Book als Dank verschicken

## Fulfilment

- [ ] FFN Connect und Rheinland Fulfilment: klären, was genau zu tun ist

## Offene Fragen

- **FFN Connect > Rheinland Fulfilment:** Ist ein Wechsel gemeint, oder soll FFN Connect an Rheinland Fulfilment angebunden werden?
- **Preistest 299 €:** Trägt die Marge das? Nur im Eltern-Funnel oder überall?
- **wellenpuls.de** liegt nicht in diesem Repo. Dort prüfen, ob die Physio-Empfehlung noch steht.
- **"Unabhängiges Gesundheitsmagazin":** So beschreiben sich adv/1 und adv/2 im Kasten "Über Stabil im Alltag". Die Seite gehört aber der Wellenpuls GmbH. Das Eltern-Advertorial nennt deshalb die Wellenpuls GmbH als Betreiber. Für adv/1 und adv/2 rechtlich prüfen lassen.
