# Quiz-Daten und der Sheet-Endpoint

Werkzeug ist `gsuite` aus `~/projects/gsuite-cli`, verlinkt nach
`/usr/local/bin`. Einrichtung steht dort in `SETUP.md`, das allgemeine
Vorgehen in `SOP.md`. Diese Seite haelt nur fest, was fuer dieses Projekt gilt.

```sh
gsuite whoami                  # angemeldet?
```

---

## Die IDs

| | |
| --- | --- |
| Tabelle | Quiz_Submissions, `1y7GV8MQfrPBJO2tiVUayQzbvZWoHVmrbAl8JGgblhjs` |
| Script | `1aJ84QqUWeeCOspi6bZlrPr4arkpvvoyP2U3mDi3wjPAGKPnfMGLfWlBl` |
| Projektname | „Quiz:Rücken Eintragung", an die Tabelle gebunden |
| Live-Bereitstellung | `AKfycbwraM9stECq1iIpcdo1V--YByP7p78MGb-gpcNxdabL1nzF25OT9pJmfjyxlhrvZlQb3A` |
| Zum Testen | `AKfycbxorjP1v3_ixZd2YfvfnWZSKjVbjiqKjngifrGZo1Lu` (haengt auf HEAD) |

Gebundene Script-Projekte tauchen in Drive nicht auf, `gsuite drive:scripts`
findet sie nicht. Deshalb stehen die IDs hier.

Die zweite Bereitstellung zeigt immer auf den HEAD-Stand. Nach einem `push`
laesst sich dort pruefen, bevor die Live-URL umgehaengt wird.

---

## Der Aufbau

Alle vier Quizzes posten an **dieselbe** Web-App. Eine Aenderung am Script
trifft damit immer alle vier Funnels.

| Seite | `quiz` im Payload | Eintraege (27.07.2026) |
| --- | --- | --- |
| `ruecken/quiz/2` | `ruecken-quiz-2` | 35 |
| `rektusdiastase/quiz-menopause` | `rektus-menopause` | 3 |
| `rektusdiastase/quiz-schwangerschaft-2` | `rektus-schwangerschaft-2` | 2 |
| `rektusdiastase/quiz-schwangerschaft` | `rektus-schwangerschaft` | 0 |

Die URL steht als `QUIZ_WEBHOOK` in jeder der vier `index.html`.
Dazu drei `TEST-verify`-Zeilen aus der Einrichtung, die noch in den
Produktivdaten stehen.

Der Payload aus `sendQuizData()`:

```js
{ ts, quiz, angle, antworten }
```

---

## Was der Live-Code nicht mitnimmt

Bereitgestellt laeuft die urspruengliche Rücken-Fassung, v1 vom 17.07.2026.
Der echte Stand liegt seit dem Pull unter `apps-script/quiz-sheet/`.

```js
var row = {
  'Zeitpunkt': new Date(),
  'Quiz': data.quiz || '',
  'Alter': data.alter || '',
  'Zone':  data.zone  || ''
};
```

Drei fest verdrahtete Felder. Folgen:

- **`angle` faellt weg.** Die drei Rektus-Quizzes schicken es, es landet nie in
  der Tabelle. Deshalb gibt es dort keine Angle-Spalte.
- **Keine Attribution.** Weder `utm_*` noch `fbclid`. Eine Eintragung laesst
  sich keiner Kampagne zuordnen. Die UTM-Werte liegen im Frontend bereits im
  `sia_attr`-Cookie und muessten nur in den Payload gehoben werden.
- **Kein Ergebnistyp, keine Session-ID.**

`scripts/quiz-sheet.gs` ist eine nie bereitgestellte Entwurfsfassung, die pro
Quiz ein eigenes Blatt angelegt haette. Sie ist kein Abbild des Live-Stands und
sollte nicht dafuer gehalten werden.

**Zum Vergleich:** der BrustBizeps-Endpunkt (`SOP.md` im gsuite-cli, Abschnitt
6) nimmt `utm_*`, `fbclid`, `referrer`, `page_url`, `session_id` und
`result_type` mit. Dort liegen die Antworten allerdings als `answers_json` in
einer Zelle statt als Spalten.

### Offene Entscheidung

Ein Blatt `Quiz` behalten oder auf ein Blatt je Quiz umstellen. Ein Blatt heisst
Historie am Stueck und eine Abfrage fuer alles, dafuer leere Zellen wo sich
Fragensaetze unterscheiden. Solange die Fragen sich stark ueberschneiden, ist
ein Blatt der Normalfall.

---

## Aendern und bereitstellen

```sh
gsuite script:pull   <scriptId> apps-script/quiz-sheet     # erst holen
# bearbeiten, committen
gsuite script:push   <scriptId> apps-script/quiz-sheet     # setzt HEAD
gsuite script:deploy <scriptId> <deploymentId> "Beschreibung"
```

`push` allein reicht nicht, die Web-App laeuft bis zum `deploy` auf der alten
Version weiter. `updateContent` ersetzt das komplette Projekt, also nie ohne
vorherigen `pull` arbeiten.

Frontend und Script gehoeren in denselben Zug: ein neues Feld im Payload, das
das Script nicht kennt, verschwindet stillschweigend. Danach eine echte
Eintragung pruefen, nicht nur den Code lesen.

---

## Datenschutz

Das Script schreibt nur gewaehlte Antworten und ein grobes Profil, keine IP,
kein Name, keine E-Mail. Der Versand haengt im Quiz an der
Marketing-Einwilligung. Beides bleibt so, auch wenn Attribution nachgeruestet
wird — UTM-Parameter und `fbclid` sind Kampagnendaten, keine Personendaten,
aber sie fallen trotzdem unter dieselbe Einwilligung.

Gesundheitsbezug nach Art. 9 DSGVO ist in der Datenschutzerklaerung erwaehnt.
