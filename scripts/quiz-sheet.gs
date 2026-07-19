/**
 * Quiz-Antworten -> Google Tabelle (ohne Make, nur Google Apps Script).
 * Ein Endpoint für alle Funnels. Jedes Quiz schreibt in ein eigenes Tabellenblatt,
 * dessen Name aus dem Feld "quiz" im Payload kommt (z. B. "ruecken-quiz-2",
 * "rektus-schwangerschaft", "rektus-menopause").
 *
 * EINRICHTUNG
 * 1. Google Tabelle öffnen. Erweiterungen > Apps Script. Diesen Code einfügen, speichern.
 * 2. Bereitstellen > Bereitstellung verwalten (bestehende Web-App) > Bearbeiten >
 *    Version: Neu > Bereitstellen. So bleibt die /exec-URL gleich.
 *    (Neue Web-App nur, falls noch keine existiert: Ausführen als Ich, Zugriff Jeder.)
 *
 * Datenschutz: nur gewählte Antworten + grobes Profil, keine IP, kein Name, keine E-Mail.
 * Der Sende-Vorgang ist im Quiz an die Marketing-Einwilligung gekoppelt.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = {};
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var name = String(data.quiz || 'Quiz').replace(/[^\w\- ]/g, '').slice(0, 80) || 'Quiz';
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);

    // Zeile aufbauen: Zeitpunkt, dann alle einfachen Top-Level-Felder (angle, alter, zone …),
    // danach jede Antwort als eigene Spalte (Mehrfachauswahl kommagetrennt).
    var row = { 'Zeitpunkt': new Date() };
    Object.keys(data).forEach(function (k) {
      if (k === 'antworten' || k === 'ts' || k === 'quiz') return;
      var v = data[k];
      if (v !== null && typeof v === 'object') return;
      row[k.charAt(0).toUpperCase() + k.slice(1)] = v;
    });
    var ans = data.antworten || {};
    Object.keys(ans).forEach(function (k) {
      var v = ans[k];
      row['q_' + k] = Array.isArray(v) ? v.join(', ') : v;
    });

    // Kopfzeile ermitteln, bei neuen Feldern erweitern.
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
      .createTextOutput(JSON.stringify({ ok: true, sheet: name }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Quiz Sheet-Endpoint aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}
