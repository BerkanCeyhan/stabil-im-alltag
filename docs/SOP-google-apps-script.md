# Quiz-Daten und der Sheet-Endpoint

Werkzeug ist `gsuite`, liegt in `~/projects/gsuite-cli` und ist nach
`/usr/local/bin` verlinkt. Einrichtung und alle Befehle stehen dort in
`SETUP.md`. Diese Seite haelt nur fest, was fuer dieses Projekt gilt.

```sh
gsuite whoami          # angemeldet?
gsuite drive:sheets quiz
```

---

## Der Aufbau

Alle vier Quizzes posten an **dieselbe** Web-App:

- `rektusdiastase/quiz-menopause`
- `rektusdiastase/quiz-schwangerschaft`
- `rektusdiastase/quiz-schwangerschaft-2`
- `ruecken/quiz/2`

Die URL steht als `QUIZ_WEBHOOK` in jeder der vier `index.html`. Eine
Aenderung am Script trifft damit immer alle vier Funnels.

Ziel ist die Tabelle **Quiz_Submissions**,
`1y7GV8MQfrPBJO2tiVUayQzbvZWoHVmrbAl8JGgblhjs`.

Weitere Tabellen desselben Kontos:

| Tabelle | ID |
| --- | --- |
| BB:Quiz_Submissions | `1-ZNxUaRKTiq0z-XmRvssCIXN2zYFaDsKQOM5BVXzZlU` |
| BB Dashboard — Marketing & Revenue | `1N6bQQiFqgQoSG1DfXoz-ebMdUB2Ph4RKBj2qDw_ou1o` |

Das Script-Projekt ist an die Tabelle gebunden und taucht deshalb nicht in
`gsuite drive:scripts` auf. Die Script-ID steht im Editor unter Zahnrad →
Projekteinstellungen.

---

## Offener Drift

Stand 27.07.2026 weicht der bereitgestellte Code von `scripts/quiz-sheet.gs` ab:

- **Live**: alles in einer Tabelle, mit einer Spalte `Quiz`.
- **Repo**: ein Tabellenblatt pro Quiz, `quiz` nicht als Spalte.

Die Repo-Fassung wurde nie bereitgestellt, sie war immer nur eine Kopie zum
Einfuegen in den Editor. Vor der ersten Aenderung deshalb:

```sh
gsuite script:pull <scriptId> apps-script/quiz-sheet
```

Damit ist der echte Stand im Repo. Danach entscheiden, welche Struktur gelten
soll, und `scripts/quiz-sheet.gs` durch das gepullte Verzeichnis ersetzen.

Bereitstellen ohne die `/exec`-URL zu aendern:

```sh
gsuite script:deployments <scriptId>          # deploymentId ablesen
gsuite script:push   <scriptId> apps-script/quiz-sheet
gsuite script:deploy <scriptId> <deploymentId> "Beschreibung"
```

`push` allein reicht nicht, die Web-App laeuft bis zum `deploy` auf der alten
Version weiter.

---

## Datenschutz

Das Script schreibt nur gewaehlte Antworten und ein grobes Profil, keine IP,
kein Name, keine E-Mail. Der Versand haengt im Quiz an der
Marketing-Einwilligung. Beides bleibt so, auch bei Aenderungen am Aufbau.
