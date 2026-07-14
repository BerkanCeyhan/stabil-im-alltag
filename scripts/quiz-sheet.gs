/**
 * Rücken-Check Quiz -> Google Tabelle (ohne Make, nur Google Apps Script).
 *
 * EINRICHTUNG
 * 1. Neue Google Tabelle anlegen (oder bestehende öffnen).
 * 2. Erweiterungen > Apps Script. Den gesamten Code hier hineinkopieren, speichern.
 * 3. Bereitstellen > Neue Bereitstellung > Typ: Web-App.
 *      - Ausführen als: Ich
 *      - Zugriff: "Jeder" (nötig, damit der Browser anonym posten darf)
 *    Bereitstellen, Zugriff autorisieren, die /exec-URL kopieren.
 * 4. In ruecken/quiz/2/index.html:  var QUIZ_WEBHOOK = "…/exec";  eintragen.
 *
 * Datenschutz: Es kommen nur die gewählten Antworten + grobes Profil (Alter/Zone)
 * an. Keine IP, kein Name, keine E-Mail. Sende-Vorgang ist im Quiz an die
 * Marketing-Einwilligung gekoppelt. Gesundheitsbezug (Art. 9 DSGVO) in der
 * Datenschutzerklärung erwähnen.
 *
 * Test: Nach dem Deploy im Quiz einmal durchklicken (mit Cookie-Zustimmung),
 * dann erscheint eine neue Zeile im Blatt "Quiz".
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // parallele Anfragen serialisieren -> keine Race-Conditions
  try {
    var data = {};
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Quiz') || ss.insertSheet('Quiz');

    var ans = data.antworten || {};
    var row = {
      'Zeitpunkt': new Date(),
      'Quiz': data.quiz || '',
      'Alter': data.alter || '',
      'Zone': data.zone || ''
    };
    // Jede Antwort als eigene Spalte (Mehrfachauswahl kommagetrennt).
    Object.keys(ans).forEach(function (k) {
      var v = ans[k];
      row['q_' + k] = Array.isArray(v) ? v.join(', ') : v;
    });

    // Kopfzeile ermitteln / bei neuen Fragen erweitern.
    var headers = sh.getLastRow() > 0
      ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      : [];
    var changed = false;
    Object.keys(row).forEach(function (h) {
      if (headers.indexOf(h) < 0) { headers.push(h); changed = true; }
    });
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers);
    } else if (changed) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    sh.appendRow(headers.map(function (h) {
      return row[h] !== undefined ? row[h] : '';
    }));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Optionaler Health-Check im Browser (GET auf die /exec-URL).
function doGet() {
  return ContentService
    .createTextOutput('Rücken-Check Sheet-Endpoint aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}
