/**
 * Quiz -> Google Tabelle + Zoho Campaigns (ohne Make, nur Google Apps Script).
 *
 * Drei Nutzlasten, unterschieden über `typ`:
 *   quiz        Antworten des abgeschlossenen Quiz          -> Blatt "Quiz"
 *   schritt     ein Bildschirmwechsel im Quiz               -> Blatt "Schritte"
 *   identitaet  E-Mail + Attribution, getrennt vom Rest     -> Blatt "Identitaet" + Zoho
 *
 * WARUM GETRENNTE BLÄTTER
 * Quiz-Antworten sind Gesundheitsdaten (Art. 9 DSGVO). In derselben Zeile mit
 * einer E-Mail-Adresse wären es personenbezogene Gesundheitsdaten mit deutlich
 * höherer Hürde. Verknüpft wird nur über `sid`, eine zufällige Sitzungs-ID,
 * und nur dort, wo es gebraucht wird.
 *
 * GEHEIMNISSE
 * Dieses Repo ist öffentlich. Es steht kein Zugangsdatum im Code. Es gibt genau
 * eine Skripteigenschaft (Projekteinstellungen > Skripteigenschaften):
 *
 *   ZOHO_KONF   der komplette JSON-Block aus dem Google Secret Manager:
 *               gcloud secrets versions access latest \
 *                 --secret=ZOHO_CAMPAIGNS_WELLENPULS --project=gsuite-agent-access
 *
 * Er enthält dc, client_id, client_secret, refresh_token, listkey, topics,
 * quiz_map und quiz_default. Eine Eigenschaft statt sieben — beim Rotieren wird
 * nur dieser eine Wert ersetzt.
 *
 * Fehlt ZOHO_KONF, wird der Zoho-Aufruf stillschweigend übersprungen. Die
 * Tabelle wird trotzdem geschrieben — die Messung darf nie an Zoho hängen.
 *
 *   ZOHO_TESTMODUS   optional, kommagetrennte Adressliste. Solange gesetzt,
 *                    geht NUR an diese Adressen etwas an Zoho. Jeder Eintrag
 *                    löst eine echte Bestätigungsmail aus — ohne diese Sperre
 *                    bekämen echte Interessenten Testpost. Vor dem Livegang
 *                    löschen.
 *
 * Bereitstellen:
 *   gsuite script:push   <scriptId> ~/projects/stabil-im-alltag/apps-script/quiz-sheet
 *   gsuite script:deploy <scriptId> <deploymentId>
 * Die /exec-URL bleibt dabei gleich, die Seiten müssen nicht angefasst werden.
 *
 * Datenschutz: Schritt-Ereignisse tragen keinen Antwortinhalt und keine Kennung.
 * Antworten und E-Mail hängen je an ihrer eigenen Einwilligung.
 */

var BLATT_QUIZ = 'Quiz';
var BLATT_SCHRITTE = 'Schritte';
var BLATT_IDENTITAET = 'Identitaet';
var BLATT_FEHLER = 'Fehler';

/* ─────────────────────────── Eingang ─────────────────────────── */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // parallele Anfragen serialisieren -> keine Race-Conditions
  try {
    var data = {};
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }

    switch (data.typ || 'quiz') {
      case 'schritt':    schreibeSchritt_(data);    break;
      case 'identitaet': schreibeIdentitaet_(data); break;
      default:           schreibeQuiz_(data);       break;
    }
    return json_({ ok: true });
  } catch (err) {
    fehler_('doPost', err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var token = e && e.parameter && e.parameter.a;
  if (token) return auswertungsSeite_(token);
  return ContentService
    .createTextOutput('Quiz-Endpoint aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/* ─────────────────────────── Nutzlasten ─────────────────────────── */

/**
 * Abgeschlossenes Quiz. Antworten liegen als JSON in einer Zelle, nicht als
 * Spalte je Frage — dieselbe Form wie bei BrustBizeps.
 *
 * Grund: eine Spalte je Frage lässt das Blatt mit jeder neuen Frage und jedem
 * neuen Quiz wachsen. Vier Quizze hatten so 20 `q_*`-Spalten, von denen jede
 * Zeile nur einen Bruchteil füllte. Eine Frage umbenennen legte still eine
 * neue Spalte an, und die alten Antworten standen in der verwaisten. Als JSON
 * bleibt die Breite fest und die Zuordnung Frage->Antwort steht in der Zeile.
 */
function schreibeQuiz_(data) {
  var ans = data.antworten || {};
  var antworten = {};
  Object.keys(ans).forEach(function (k) {
    var v = ans[k];
    antworten[k] = Array.isArray(v) ? v.join(' | ') : v;
  });

  anhaengen_(BLATT_QUIZ, {
    'timestamp': data.ts || new Date().toISOString(),
    'quiz': data.quiz || '',
    'session_id': data.sid || '',
    'angle': data.angle || '',
    'alter': data.alter || '',
    'zone': data.zone || '',
    'answers_json': JSON.stringify(antworten),
    'utm_source': data.utm_source || '',
    'utm_medium': data.utm_medium || '',
    'utm_campaign': data.utm_campaign || '',
    'utm_content': data.utm_content || '',
    'fbclid': data.fbclid || '',
    'referrer': data.referrer || '',
    'user_agent': data.user_agent || '',
    'page_url': data.page_url || ''
  });
}

/**
 * Ein Bildschirmwechsel. Das dichteste Signal im Funnel: pro Besucher ~14
 * Ereignisse statt einem. Bewusst ohne Antwortinhalt, damit es nicht an der
 * Marketing-Einwilligung hängt und der Abbruch für den ganzen Verkehr sichtbar
 * wird — nicht nur für die, die bis zum Ende durchlaufen.
 */
function schreibeSchritt_(data) {
  anhaengen_(BLATT_SCHRITTE, {
    'Zeitpunkt': new Date(),
    'sid': data.sid || '',
    'Quiz': data.quiz || '',
    'Index': data.index !== undefined ? data.index : '',
    'Screen': data.screen || '',
    'Ereignis': data.ereignis || 'view',
    'Verweildauer_ms': data.dwell || ''
  });
}

/**
 * E-Mail plus Attribution. Zwei getrennte Einwilligungen, weil zwei Zwecke:
 *   consent_news  Werbeeinwilligung (§7 UWG) -> Eintrag in Zoho, DOI folgt
 *   consent_mess  Messung -> gehashte Adresse als Schlüssel für Meta CAPI
 * Ohne `consent_news` geht nichts an Zoho.
 */
function schreibeIdentitaet_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 0) return;

  anhaengen_(BLATT_IDENTITAET, {
    'Zeitpunkt': new Date(),
    'sid': data.sid || '',
    'E-Mail': email,
    'Vorname': data.vorname || '',
    'Quiz': data.quiz || '',
    'Angle': data.angle || '',
    'Altersband': data.age_band || '',
    'fbc': data.fbc || '',
    'fbp': data.fbp || '',
    'fbclid': data.fbclid || '',
    'utm_source': data.utm_source || '',
    'utm_medium': data.utm_medium || '',
    'utm_campaign': data.utm_campaign || '',
    'utm_content': data.utm_content || '',
    'referrer': data.referrer || '',
    'page_url': data.page_url || '',
    'consent_health': data.consent_health ? 'ja' : 'nein',
    'consent_news': data.consent_news ? 'ja' : 'nein',
    'zoho': '',  // wird gleich befüllt
    'mail': '',
    'token': ''
  });

  // Werbung nur mit der freiwilligen Einwilligung. Sie ist bewusst NICHT
  // Bedingung fuer die Auswertung — sonst waere der Zugang gekoppelt.
  if (data.consent_news) {
    var ergebnis = zohoEintragen_(email, data.quiz || '', data.vorname || '');
    setzeLetzte_(BLATT_IDENTITAET, 'zoho', ergebnis);
  } else {
    setzeLetzte_(BLATT_IDENTITAET, 'zoho', 'keine Werbeeinwilligung');
  }

  // Die Auswertung ist die zugesagte Leistung, nicht Werbung. Sie haengt an der
  // Gesundheitseinwilligung und geht unabhaengig von der DOI-Bestaetigung raus.
  if (data.consent_health) {
    sendeAuswertung_(email, data.sid || '', data.quiz || '', data.angle || '');
  } else {
    setzeLetzte_(BLATT_IDENTITAET, 'mail', 'keine Einwilligung');
  }
}

/* ─────────────────────────── Auswertungsmail ─────────────────────────── */

var ABSENDER_NAME = 'Stabil im Alltag';
var ANTWORT_AN = 'c.senfleben@wellenpuls.de';
var LP_BASIS = 'https://stabil-im-alltag.de/rektusdiastase/lp-schwangerschaft/';

/**
 * Einmal-Schluessel fuer die geschuetzte Auswertungsseite. Kein Geheimnis im
 * kryptografischen Sinn, aber lang genug, dass er nicht zu erraten ist, und
 * er steht in keiner URL, die jemand anders sieht.
 */
function tokenNeu_() {
  var zeichen = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var t = '';
  for (var i = 0; i < 32; i++) {
    t += zeichen.charAt(Math.floor(Math.random() * zeichen.length));
  }
  return t;
}

function auswertungsLink_(token) {
  var basis = ScriptApp.getService().getUrl();
  return token ? basis + '?a=' + encodeURIComponent(token) : LP_BASIS;
}

/** Sucht die Sitzung zu einem Token im Blatt Identitaet. */
function sitzungZuToken_(token) {
  if (!token) return null;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLATT_IDENTITAET);
  if (!sh || sh.getLastRow() < 2) return null;
  var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iTok = kopf.indexOf('token'), iSid = kopf.indexOf('sid'),
      iQuiz = kopf.indexOf('Quiz'), iAngle = kopf.indexOf('Angle');
  if (iTok < 0 || iSid < 0) return null;
  var werte = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = werte.length - 1; i >= 0; i--) {
    if (String(werte[i][iTok]) === String(token)) {
      return {
        sid: werte[i][iSid],
        quiz: iQuiz >= 0 ? werte[i][iQuiz] : '',
        angle: iAngle >= 0 ? werte[i][iAngle] : ''
      };
    }
  }
  return null;
}

/**
 * Ein Schalter fuer allen ausgehenden Versand — Zoho wie E-Mail.
 * Solange TESTMODUS (oder das aeltere ZOHO_TESTMODUS) gesetzt ist, geht nur an
 * die dort gelisteten Adressen etwas raus. Vor dem Livegang loeschen.
 */
function versandErlaubt_(email) {
  var p = PropertiesService.getScriptProperties();
  var liste = p.getProperty('TESTMODUS') || p.getProperty('ZOHO_TESTMODUS');
  if (!liste) return true;
  return liste.split(',').map(function (a) {
    return a.trim().toLowerCase();
  }).indexOf(String(email).toLowerCase()) >= 0;
}

/** Holt answers_json und angle zu einer Sitzung aus dem Blatt Quiz. */
function antwortenZurSitzung_(sid) {
  if (!sid) return {};
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLATT_QUIZ);
  if (!sh || sh.getLastRow() < 2) return {};
  var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iSid = kopf.indexOf('session_id'), iAns = kopf.indexOf('answers_json'),
      iAngle = kopf.indexOf('angle');
  if (iSid < 0 || iAns < 0) return {};
  var werte = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = werte.length - 1; i >= 0; i--) {          // rueckwaerts: juengste Zeile gewinnt
    if (String(werte[i][iSid]) === String(sid)) {
      var ans = {};
      try { ans = JSON.parse(werte[i][iAns] || '{}'); } catch (e) { ans = {}; }
      return { antworten: ans, angle: iAngle >= 0 ? werte[i][iAngle] : '' };
    }
  }
  return {};
}

function htmlEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Baut die persoenliche Auswertung. Nimmt die ausgeschriebenen Antworttexte,
 * wie sie im Quiz gesendet werden — keine Rohwerte, keine zweite Uebersetzungs-
 * tabelle, die auseinanderlaufen koennte.
 */
function auswertungTexte_(antworten, angle) {
  var a = antworten || {};
  var versucht = String(a.tried || '').split('|').map(function (s) { return s.trim(); })
    .filter(function (s) { return s && s.indexOf('Noch nichts') !== 0; });

  var einordnung;
  if (versucht.length >= 2) {
    einordnung = 'Du hast schon ' + versucht.slice(0, 2).join(' und ') +
      ' versucht. Und trotzdem ist die Lücke geblieben. Das liegt nicht an dir.';
  } else if (versucht.length === 1) {
    einordnung = 'Du hast ' + versucht[0] + ' versucht. Und trotzdem ist die Lücke ' +
      'geblieben. Das liegt nicht an dir.';
  } else {
    einordnung = 'Die natürliche Rückbildung schließt die Lücke nur teilweise. Ohne ' +
      'gezielten, regelmäßigen Reiz bleibt sie danach meist bestehen.';
  }

  var titel = angle === 'aesthetic' ? 'Dein Weg zu einer flacheren, festeren Mitte'
            : angle === 'stability' ? 'Dein Weg zu einer stabilen, tragfähigen Mitte'
            : 'Dein Weg zu einer festen, stabilen Mitte nach der Geburt';

  var schwerpunkt = angle === 'aesthetic'
    ? 'Dich beschäftigt vor allem die sichtbare Wölbung. Hält die tiefe Muskulatur die ' +
      'Mitte wieder von innen, wird die Kontur flacher.'
    : angle === 'stability'
    ? 'Dich beschäftigt vor allem die instabile Mitte. Genau dort setzt der tiefe ' +
      'Bauchmuskel an, der die Körpermitte stützt und den Rücken entlastet.'
    : '';

  return { einordnung: einordnung, titel: titel, schwerpunkt: schwerpunkt };
}

/**
 * E-Mail-HTML. Bewusst Tabellenlayout mit Inline-CSS: Outlook rendert kein
 * Flexbox und ignoriert externe Stylesheets. Feste Breite 600px, eine Spalte.
 */
function auswertungHtml_(antworten, angle, token) {
  var t = auswertungTexte_(antworten, angle);
  var ziel = auswertungsLink_(token);

  function schritt(nr, kopf, text) {
    return '<tr><td style="padding:0 0 18px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
      '<tr>' +
      '<td width="34" valign="top" style="font-size:15px;font-weight:800;color:#0f7d78;">' + nr + '.</td>' +
      '<td valign="top">' +
        '<div style="font-size:15px;font-weight:700;color:#12263a;margin-bottom:3px;">' + kopf + '</div>' +
        '<div style="font-size:14px;line-height:1.6;color:#5b6b7c;">' + text + '</div>' +
      '</td></tr></table></td></tr>';
  }

  return '' +
'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f7fa;margin:0;padding:0;">' +
'<tr><td align="center" style="padding:24px 12px;">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">' +

    '<tr><td style="padding:26px 30px 0 30px;">' +
      '<div style="font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0f7d78;">Stabil im Alltag</div>' +
    '</td></tr>' +

    '<tr><td style="padding:14px 30px 0 30px;">' +
      '<h1 style="margin:0;font-size:24px;line-height:1.25;color:#12263a;font-weight:800;">' + htmlEsc_(t.titel) + '</h1>' +
    '</td></tr>' +

    '<tr><td style="padding:16px 30px 0 30px;">' +
      '<p style="margin:0;font-size:15px;line-height:1.65;color:#5b6b7c;">Hier ist deine Auswertung aus dem Rektusdiastase-Check — in Ruhe nachlesbar, wann immer es gerade passt.</p>' +
    '</td></tr>' +

    // Bewusst KEINE Gesundheitsangaben im Mailtext. Eine E-Mail liegt im
    // Klartext auf fremden Servern; "Deine Luecke: 2 Fingerbreit" waere dort
    // eine Gesundheitsaussage. Die persoenliche Auswertung steht hinter dem
    // Link, erreichbar nur mit dem Einmal-Schluessel aus dieser Mail.
    '<tr><td style="padding:22px 30px 0 30px;">' +
      '<p style="margin:0;font-size:15px;line-height:1.7;color:#12263a;">Deine persönliche Auswertung liegt auf einer geschützten Seite bereit — erreichbar nur über den Link in dieser E-Mail. So stehen deine Angaben nicht im Klartext im Postfach.</p>' +
      '<p style="margin:12px 0 0 0;font-size:15px;line-height:1.7;color:#5b6b7c;"><strong style="color:#12263a;">Der Haken ist die Regelmäßigkeit</strong>, die Übungsprogramme und Kurse verlangen. Woche für Woche, in einem Alltag, der sich nach dem Kind richtet. Genau daran scheitern die meisten.</p>' +
    '</td></tr>' +

    '<tr><td style="padding:26px 30px 0 30px;">' +
      '<div style="font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8494a3;margin-bottom:14px;">Dein Plan für die nächsten 12 Wochen</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        schritt(1, 'Woche 1 bis 4 — die Tiefe wieder ansprechen',
          'Die tiefe Bauchmuskulatur arbeitet vor allem über die Atmung. Beim Ausatmen den Bauchnabel sanft nach innen ziehen, ohne die Luft anzuhalten, ohne zu pressen. Zweimal täglich zehn ruhige Atemzüge reichen in dieser Phase.') +
        schritt(2, 'Woche 5 bis 8 — Belastung dosiert dazunehmen',
          'Alltagsbewegungen bewusst mit gehaltener Mitte: aufstehen, das Kind hochnehmen, Treppen. Wölbt sich der Bauch dabei kegelförmig vor, war der Reiz zu groß — eine Stufe zurück, nicht durchbeißen.') +
        schritt(3, 'Woche 9 bis 12 — halten statt neu anfangen',
          'Jetzt entscheidet nicht die Intensität, sondern dass es überhaupt stattfindet. Zwei feste Termine pro Woche, verknüpft mit etwas, das ohnehin passiert.') +
      '</table>' +
      '<p style="margin:4px 0 0 0;font-size:13px;line-height:1.6;color:#8494a3;">Klassische Sit-ups, Crunches und Planks bleiben in dieser Zeit meist außen vor — sie belasten die Mittellinie genau dort, wo sie zusammenwachsen soll. Das ist eine allgemeine Orientierung und ersetzt keine physiotherapeutische Anleitung.</p>' +
    '</td></tr>' +

    '<tr><td style="padding:24px 30px 0 30px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef7f6;border-radius:12px;">' +
        '<tr><td style="padding:18px 20px;">' +
          '<div style="font-size:15px;font-weight:700;color:#12263a;margin-bottom:6px;">Der Selbsttest, falls du die Lücke noch nicht gemessen hast</div>' +
          '<div style="font-size:14px;line-height:1.65;color:#5b6b7c;">Flach auf den Rücken, Beine angewinkelt. Zwei Finger längs oberhalb des Bauchnabels auflegen. Kopf und Schultern leicht anheben. Wie viele Finger passen quer in die Lücke? Miss auch auf Nabelhöhe und darunter — die Breite ist selten überall gleich.</div>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    '<tr><td align="center" style="padding:28px 30px 0 30px;">' +
      '<a href="' + htmlEsc_(ziel) + '" style="display:inline-block;background:#0f7d78;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 30px;border-radius:11px;">Auswertung ansehen</a>' +
      '<div style="margin-top:10px;font-size:12px;color:#9aa8b5;">Der Link ist persönlich. Gib ihn nicht weiter.</div>' +
    '</td></tr>' +

    '<tr><td style="padding:22px 30px 0 30px;">' +
      '<p style="margin:0;font-size:15px;line-height:1.7;color:#5b6b7c;">Wenn du Fragen hast, antworte einfach auf diese Mail.</p>' +
      '<p style="margin:14px 0 0 0;font-size:15px;line-height:1.7;color:#5b6b7c;">Herzliche Grüße<br><strong style="color:#12263a;">Christian Senfleben</strong><br>Wellenpuls</p>' +
    '</td></tr>' +

    '<tr><td style="padding:24px 30px 0 30px;">' +
      '<p style="margin:0;font-size:12px;line-height:1.6;color:#9aa8b5;border-top:1px solid #e7ecf1;padding-top:16px;">Der Wellenpuls LWS ist ein Trainingsgerät, kein Medizinprodukt, und ersetzt keine ärztliche Beratung. Dieser Check dient der Einordnung und stellt keine Diagnose. Nicht in der Schwangerschaft anwenden; beginne frühestens 6 Wochen nach der Geburt und kläre die Anwendung bei Beschwerden ärztlich ab. Individuelle Ergebnisse können variieren.</p>' +
    '</td></tr>' +

    '<tr><td style="padding:14px 30px 28px 30px;">' +
      '<p style="margin:0;font-size:12px;line-height:1.6;color:#9aa8b5;">Du bekommst diese E-Mail, weil du den Rektusdiastase-Check auf stabil-im-alltag.de gemacht und um deine Auswertung gebeten hast.<br>' +
      'Wellenpuls GmbH · <a href="https://stabil-im-alltag.de/impressum/" style="color:#9aa8b5;">Impressum</a> · <a href="https://stabil-im-alltag.de/datenschutz/" style="color:#9aa8b5;">Datenschutz</a></p>' +
    '</td></tr>' +

  '</table>' +
'</td></tr></table>';
}

/** Nur-Text-Fassung. Fehlt sie, stufen viele Filter die Mail herab. */
function auswertungText_(antworten, angle, token) {
  var t = auswertungTexte_(antworten, angle);
  var z = [];
  z.push(t.titel.toUpperCase());
  z.push('');
  z.push('Hier ist deine Auswertung aus dem Rektusdiastase-Check.');
  z.push('');
  z.push('Deine persoenliche Auswertung liegt auf einer geschuetzten Seite bereit,');
  z.push('erreichbar nur ueber den Link unten. So stehen deine Angaben nicht im');
  z.push('Klartext im Postfach. Der Link ist persoenlich, gib ihn nicht weiter.');
  z.push('');
  z.push('DEIN PLAN FUER DIE NAECHSTEN 12 WOCHEN');
  z.push('1. Woche 1-4: Die tiefe Bauchmuskulatur ueber die Atmung ansprechen.');
  z.push('   Beim Ausatmen den Bauchnabel sanft nach innen ziehen, ohne zu pressen.');
  z.push('2. Woche 5-8: Alltagsbewegungen mit gehaltener Mitte. Woelbt sich der');
  z.push('   Bauch kegelfoermig vor, eine Stufe zurueck.');
  z.push('3. Woche 9-12: Zwei feste Termine pro Woche. Dranbleiben schlaegt Intensitaet.');
  z.push('   Sit-ups, Crunches und Planks bleiben in dieser Zeit meist aussen vor.');
  z.push('   Allgemeine Orientierung, ersetzt keine physiotherapeutische Anleitung.');
  z.push('');
  z.push('Auswertung ansehen: ' + auswertungsLink_(token));
  z.push('');
  z.push('Antworte einfach auf diese Mail, wenn du Fragen hast.');
  z.push('Herzliche Gruesse, Christian Senfleben / Wellenpuls');
  z.push('');
  z.push('Der Wellenpuls LWS ist ein Trainingsgeraet, kein Medizinprodukt, und');
  z.push('ersetzt keine aerztliche Beratung. Nicht in der Schwangerschaft anwenden;');
  z.push('beginne fruehestens 6 Wochen nach der Geburt.');
  z.push('Wellenpuls GmbH - https://stabil-im-alltag.de/impressum/');
  return z.join('\n');
}

/**
 * Die geschuetzte Auswertungsseite. Hier — und nur hier — stehen die konkreten
 * Angaben. Erreichbar ausschliesslich mit dem Schluessel aus der E-Mail.
 * `noindex` und `noarchive`, damit die Seite nirgends auftaucht.
 */
function auswertungsSeite_(token) {
  var s = sitzungZuToken_(token);
  if (!s) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,noarchive">' +
      '<title>Auswertung</title>' +
      '<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
      'max-width:34rem;margin:12vh auto;padding:0 20px;color:#12263a;">' +
      '<h1 style="font-size:1.3rem;">Dieser Link ist nicht mehr gültig.</h1>' +
      '<p style="color:#5b6b7c;">Vielleicht wurde er unvollständig kopiert. Antworte ' +
      'einfach auf die E-Mail, dann schicken wir dir einen neuen.</p></div>'
    ).setTitle('Auswertung').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }

  var gefunden = antwortenZurSitzung_(s.sid);
  var a = gefunden.antworten || {};
  var winkel = s.angle || gefunden.angle || '';
  var t = auswertungTexte_(a, winkel);

  function zeile(label, wert) {
    if (!wert) return '';
    return '<tr><td style="padding:11px 0;border-bottom:1px solid #e7ecf1;color:#5b6b7c;">' +
      htmlEsc_(label) + '</td><td style="padding:11px 0;border-bottom:1px solid #e7ecf1;' +
      'color:#12263a;font-weight:700;text-align:right;">' + htmlEsc_(wert) + '</td></tr>';
  }

  var html =
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,noarchive,nofollow">' +
    '<meta name="referrer" content="no-referrer">' +
    '<title>Deine Auswertung</title>' +
    '<div style="font:16px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
      'background:#f4f7fa;margin:0;padding:28px 16px;color:#12263a;">' +
    '<div style="max-width:38rem;margin:0 auto;background:#fff;border-radius:14px;padding:30px;">' +
      '<div style="font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;' +
        'color:#0f7d78;">Stabil im Alltag</div>' +
      '<h1 style="margin:12px 0 0;font-size:1.55rem;line-height:1.25;">' + htmlEsc_(t.titel) + '</h1>' +
      '<div style="margin-top:22px;font-size:12px;font-weight:800;letter-spacing:.05em;' +
        'text-transform:uppercase;color:#8494a3;">Deine Angaben</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:6px;">' +
        zeile('Zeit seit der Geburt', a.time) +
        zeile('Deine Lücke', a.gap) +
        zeile('Wölbung im Tagesverlauf', a.bulge) +
        zeile('Belastung im Alltag', a.burden) +
        zeile('Was am meisten stört', a.bother) +
        zeile('Schon versucht', a.tried) +
      '</table>' +
      '<p style="margin-top:22px;">' + htmlEsc_(t.einordnung) + '</p>' +
      (t.schwerpunkt ? '<p style="color:#5b6b7c;">' + htmlEsc_(t.schwerpunkt) + '</p>' : '') +
      '<p style="color:#5b6b7c;"><strong style="color:#12263a;">Der Haken ist die ' +
        'Regelmäßigkeit</strong>, die Übungsprogramme und Kurse verlangen. Woche für Woche, ' +
        'in einem Alltag, der sich nach dem Kind richtet. Genau daran scheitern die meisten.</p>' +
      '<div style="margin-top:26px;text-align:center;">' +
        '<a href="' + htmlEsc_(LP_BASIS + (winkel ? '?angle=' + encodeURIComponent(winkel) : '')) + '" ' +
        'style="display:inline-block;background:#0f7d78;color:#fff;text-decoration:none;' +
        'font-weight:700;padding:15px 28px;border-radius:11px;">Plan und Angebot ansehen</a>' +
      '</div>' +
      '<p style="margin-top:26px;font-size:12px;color:#9aa8b5;border-top:1px solid #e7ecf1;' +
        'padding-top:16px;">Der Wellenpuls LWS ist ein Trainingsgerät, kein Medizinprodukt, ' +
        'und ersetzt keine ärztliche Beratung. Dieser Check dient der Einordnung und stellt ' +
        'keine Diagnose. Nicht in der Schwangerschaft anwenden; beginne frühestens 6 Wochen ' +
        'nach der Geburt.<br>Wellenpuls GmbH · ' +
        '<a href="https://stabil-im-alltag.de/impressum/" style="color:#9aa8b5;">Impressum</a></p>' +
    '</div></div>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Deine Auswertung')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Transaktionaler Versand ueber die Zoho Mail API — nicht ueber Campaigns.
 *
 * Campaigns ist ein Massenversender: dort haengt jede Mail an der
 * DOI-Bestaetigung und an der Listenmitgliedschaft. Die Auswertung ist aber die
 * zugesagte Leistung. Wer die Werbeeinwilligung nicht gibt oder die Bestaetigung
 * nicht anklickt, muss sie trotzdem bekommen.
 *
 * Braucht in ZOHO_KONF zusaetzlich:
 *   mail_account_id   aus  GET https://mail.zoho.<dc>/api/accounts
 *   mail_from         verifizierte Absenderadresse des Kontos
 * und im Token die Scopes ZohoMail.accounts.READ und ZohoMail.messages.CREATE.
 *
 * Gibt einen Statustext zurueck oder null, wenn nicht konfiguriert.
 */
function zohoMailSenden_(an, betreff, html, text) {
  var k = zohoKonf_();
  if (!k || !k.mail_account_id || !k.mail_from) return null;

  var nutzlast = {
    fromAddress: k.mail_from,
    toAddress: an,
    subject: betreff,
    content: html,
    mailFormat: 'html'
  };
  if (text) nutzlast.plainText = text;

  var res = UrlFetchApp.fetch(
    'https://mail.zoho.' + k.dc + '/api/accounts/' + k.mail_account_id + '/messages',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Zoho-oauthtoken ' + zohoToken_(k) },
      payload: JSON.stringify(nutzlast),
      muteHttpExceptions: true
    }
  );
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) return 'gesendet (Zoho Mail)';
  fehler_('zohoMailSenden', res.getContentText());
  return 'fehler (Zoho Mail ' + code + ')';
}

/**
 * Verschickt die Auswertung. Holt die Antworten ueber die Sitzungs-ID aus dem
 * Blatt Quiz — die Quiz-Nutzlast trifft vor der Identitaet ein, weil sie beim
 * Betreten des Tors gesendet wird.
 */
function sendeAuswertung_(email, sid, quiz, angle) {
  try {
    if (!versandErlaubt_(email)) {
      setzeLetzte_(BLATT_IDENTITAET, 'mail', 'übersprungen (Testmodus)');
      return;
    }
    var gefunden = antwortenZurSitzung_(sid);
    var antworten = gefunden.antworten || {};
    var winkel = angle || gefunden.angle || '';

    // Schluessel fuer die geschuetzte Seite, in derselben Zeile abgelegt.
    var token = tokenNeu_();
    setzeLetzte_(BLATT_IDENTITAET, 'token', token);

    var betreff = 'Deine Auswertung aus dem Rektusdiastase-Check';
    var html = auswertungHtml_(antworten, winkel, token);
    var text = auswertungText_(antworten, winkel, token);

    // Regelweg: Zoho Mail, Absender auf der eigenen Domain.
    var status = zohoMailSenden_(email, betreff, html, text);

    // Rueckfall nur, solange Zoho Mail nicht konfiguriert ist. MailApp sendet
    // vom Google-Konto des Bereitstellers — als Dauerloesung fuer Kundenpost
    // ungeeignet, deshalb wird es in der Tabelle deutlich vermerkt.
    if (status === null) {
      MailApp.sendEmail({
        to: email,
        name: ABSENDER_NAME,
        replyTo: ANTWORT_AN,
        subject: betreff,
        body: text,
        htmlBody: html
      });
      status = 'gesendet (MailApp, Rückfall)';
    }
    if (!Object.keys(antworten).length) status += ' — ohne Antworten';
    setzeLetzte_(BLATT_IDENTITAET, 'mail', status);
  } catch (err) {
    fehler_('sendeAuswertung', err);
    setzeLetzte_(BLATT_IDENTITAET, 'mail', 'fehler: ' + String(err));
  }
}

/**
 * Testlauf ueber den echten Weg: erst die Quiz-Zeile, dann die Identitaet.
 * Damit wird auch der Link auf die geschuetzte Seite wirklich aufloesbar.
 * Danach `testzeilenLoeschen()` ausfuehren.
 */
function testAuswertungMail() {
  var email = 'berkanceyhan@gmail.com';
  var sid = 'TEST-mail-' + Date.now();

  schreibeQuiz_({
    ts: new Date().toISOString(), sid: sid, quiz: 'rektus-schwangerschaft-2',
    angle: 'stability',
    antworten: {
      time: 'Mehr als 2 Jahre',
      gap: 'Etwa 2 Fingerbreit',
      knowledge: 'Ja',
      bulge: 'Ja, abends ist es deutlich mehr',
      burden: 'Deutlich',
      bother: 'Die instabile Mitte',
      goal: 'Festere, flachere Mitte | Sicher beim Heben und Tragen',
      tried: 'Rückbildungskurs | Physiotherapie',
      obstacle: 'Motivation nach langen Tagen',
      timebudget: 'Unter 1 Stunde'
    }
  });

  schreibeIdentitaet_({
    sid: sid, email: email, quiz: 'rektus-schwangerschaft-2', angle: 'stability',
    consent_health: true, consent_news: false
  });

  Logger.log('Gesendet an ' + email + '. Verbleibendes Tageskontingent: ' +
             MailApp.getRemainingDailyQuota());
  Logger.log('Link auf die geschuetzte Seite steht in Spalte "token" des Blatts Identitaet.');
}

/* ─────────────────────────── Zoho Campaigns ─────────────────────────── */

function zohoKonf_() {
  var roh = PropertiesService.getScriptProperties().getProperty('ZOHO_KONF');
  if (!roh) return null;
  var k = JSON.parse(roh);
  k.dc = k.dc || 'eu';
  return k;
}

/**
 * Zugriffstoken, eine Stunde gültig. Wird 50 Minuten zwischengespeichert,
 * damit nicht jeder Eintrag einen Refresh auslöst.
 */
function zohoToken_(k) {
  var cache = CacheService.getScriptCache();
  var vorhanden = cache.get('zoho_at');
  if (vorhanden) return vorhanden;

  var url = 'https://accounts.zoho.' + k.dc + '/oauth/v2/token'
    + '?refresh_token=' + encodeURIComponent(k.refresh_token)
    + '&client_id=' + encodeURIComponent(k.client_id)
    + '&client_secret=' + encodeURIComponent(k.client_secret)
    + '&grant_type=refresh_token';

  var res = UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  var body = JSON.parse(res.getContentText() || '{}');
  if (!body.access_token) throw new Error('Zoho-Token: ' + res.getContentText());

  cache.put('zoho_at', body.access_token, 3000);
  return body.access_token;
}

/**
 * Kontakt in die Liste eintragen. Weil auf der Liste die Signup Form aktiv ist,
 * löst Zoho selbst die Double-Opt-in-Bestätigung aus — wir versenden nichts.
 * Gibt einen kurzen Statustext zurück, der in der Tabelle landet.
 */
function zohoEintragen_(email, quiz, vorname) {
  var k = zohoKonf_();
  if (!k || !k.refresh_token || !k.listkey) return 'übersprungen (nicht konfiguriert)';

  // TESTMODUS — Schutz vor Mails an echte Interessenten.
  // Solange die Skripteigenschaft ZOHO_TESTMODUS gesetzt ist, geht nur an die
  // dort gelisteten Adressen etwas an Zoho. Alle anderen landen ausschliesslich
  // in der Tabelle. `listsubscribe` loest eine echte Bestaetigungsmail aus —
  // ein Testlauf mit Produktivdaten waere Post an fremde Leute.
  // Vor dem Livegang: Eigenschaft loeschen.
  var testmodus = PropertiesService.getScriptProperties().getProperty('ZOHO_TESTMODUS');
  if (testmodus) {
    var erlaubt = testmodus.split(',').map(function (a) { return a.trim().toLowerCase(); });
    if (erlaubt.indexOf(email) < 0) return 'übersprungen (Testmodus)';
  }

  try {
    // Zoho erwartet die Anzeigenamen der Felder als Schlüssel.
    // Die Picklisten nehmen nur exakt hinterlegte Werte an, deshalb kommen sie
    // aus der Zuordnung im Secret und werden nie aus Nutzereingaben gebaut.
    // Bewusst NICHT befüllt: das Feld "Diagnose" — Antwortinhalte sind
    // Gesundheitsdaten und bleiben in der Tabelle.
    var zuordnung = (k.quiz_map && k.quiz_map[quiz]) || k.quiz_default || {};

    var kontakt = { 'Contact Email': email };
    if (vorname) kontakt['First Name'] = vorname;
    ['Hauptinteresse', 'Rektusdiastase-Zielgruppe', 'Lead Quelle'].forEach(function (feld) {
      if (zuordnung[feld]) kontakt[feld] = zuordnung[feld];
    });

    var nutzlast = {
      resfmt: 'JSON',
      listkey: k.listkey,
      contactinfo: JSON.stringify(kontakt)
    };
    // Parametername für Topics auf listsubscribe ist nicht dokumentiert —
    // beim ersten Testlauf gegen die Antwort prüfen.
    var topicId = k.topics && k.topics[zuordnung.topic];
    if (topicId) nutzlast.topic_id = topicId;

    var res = UrlFetchApp.fetch(
      'https://campaigns.zoho.' + k.dc + '/api/v1.1/json/listsubscribe',
      {
        method: 'post',
        headers: { Authorization: 'Zoho-oauthtoken ' + zohoToken_(k) },
        payload: nutzlast,
        muteHttpExceptions: true
      }
    );

    var body = JSON.parse(res.getContentText() || '{}');
    if (body.status === 'success') return 'ok';
    fehler_('zohoEintragen', res.getContentText());
    return 'fehler: ' + (body.message || res.getResponseCode());
  } catch (err) {
    fehler_('zohoEintragen', err);
    return 'fehler: ' + String(err);
  }
}

/**
 * Einmal von Hand im Editor ausführen, sobald ZOHO_KONF gesetzt ist.
 * Gibt keine Geheimnisse aus, nur ob sie da sind.
 */
function zohoPruefen() {
  var k = zohoKonf_();
  if (!k) { Logger.log('ZOHO_KONF fehlt.'); return; }
  Logger.log('Rechenzentrum: ' + k.dc);
  Logger.log('Liste: ' + (k.listkey ? (k.listname || 'gesetzt') : 'FEHLT'));
  Logger.log('Topics: ' + Object.keys(k.topics || {}).join(', '));
  Logger.log('Quizze: ' + Object.keys(k.quiz_map || {}).join(', '));
  try {
    Logger.log('Token: ' + (zohoToken_(k) ? 'erhalten' : 'fehlt'));
  } catch (err) {
    Logger.log('Token: FEHLER — ' + err);
  }
}

/**
 * Testeintrag mit einer echten Adresse. Danach muss ankommen:
 * eine DOI-Bestätigungsmail, eine Zeile im Blatt Identitaet, ein Kontakt in
 * Zoho mit gefüllten Feldern.
 * Greift die Sperre ZOHO_TESTMODUS, kommt 'übersprungen (Testmodus)' zurück.
 */
function zohoTesteintrag() {
  var email = 'HIER_ECHTE_ADRESSE_EINTRAGEN';
  Logger.log(zohoEintragen_(email, 'ruecken-quiz-2', 'Test'));
}

/**
 * Prüft das Routing von doPost, ohne die Live-URL anzufassen. Schreibt je eine
 * Zeile mit sid "TEST-routing" in Quiz, Schritte und Identitaet.
 * Kein Mailversand: consent_news ist false.
 * Danach `testzeilenLoeschen()` ausführen.
 */
function testeNutzlasten() {
  function ruf(obj) {
    var antwort = doPost({ postData: { contents: JSON.stringify(obj) } });
    Logger.log(obj.typ + ' -> ' + antwort.getContent());
  }
  ruf({ typ: 'schritt', sid: 'TEST-routing', quiz: 'ruecken-quiz-2',
        index: 3, screen: 'zone', ereignis: 'view', dwell: 4200 });
  ruf({ typ: 'quiz', sid: 'TEST-routing', quiz: 'ruecken-quiz-2',
        alter: '45 bis 54', zone: 'Mittig', antworten: { age: '45 bis 54', tried: 'Physiotherapie' } });
  ruf({ typ: 'identitaet', sid: 'TEST-routing', email: 'routing@test.invalid',
        vorname: 'Routing', quiz: 'ruecken-quiz-2', fbclid: 'abc123',
        utm_source: 'fb', consent_news: false, consent_mess: true });
  Logger.log('Fertig. Blätter prüfen, dann testzeilenLoeschen() ausführen.');
}

/**
 * Entfernt die alten Testzeilen aus der Zeit vor der sid-Spalte: Zeilen im
 * Blatt Quiz, deren Quiz-Feld mit "TEST-" beginnt (die drei TEST-verify vom
 * 17.07.). Getrennt von testzeilenLoeschen, weil es Produktivdaten anfasst —
 * bewusst ausführen, nicht nebenbei.
 */
function altTestzeilenLoeschen() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLATT_QUIZ);
  if (!sh || sh.getLastRow() < 2) return;
  var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var spalte = kopf.indexOf('quiz');
  if (spalte < 0) return;
  var werte = sh.getRange(2, spalte + 1, sh.getLastRow() - 1, 1).getValues();
  var entfernt = 0;
  for (var i = werte.length - 1; i >= 0; i--) {
    if (String(werte[i][0]).indexOf('TEST-') === 0) { sh.deleteRow(i + 2); entfernt++; }
  }
  Logger.log('Quiz: ' + entfernt + ' alte Testzeilen entfernt');
}

/** Entfernt alle Zeilen mit sid "TEST-routing" aus allen Blättern. */
function testzeilenLoeschen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [BLATT_QUIZ, BLATT_SCHRITTE, BLATT_IDENTITAET].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    // Blatt Quiz nennt die Spalte session_id, die anderen sid.
    var spalte = kopf.indexOf('sid');
    if (spalte < 0) spalte = kopf.indexOf('session_id');
    if (spalte < 0) return;
    var werte = sh.getRange(2, spalte + 1, sh.getLastRow() - 1, 1).getValues();
    var entfernt = 0;
    for (var i = werte.length - 1; i >= 0; i--) {          // rückwärts, sonst verrutschen die Indizes
      if (String(werte[i][0]).indexOf('TEST-') === 0) { sh.deleteRow(i + 2); entfernt++; }
    }
    Logger.log(name + ': ' + entfernt + ' Zeilen entfernt');
  });
}

/* ─────────────────────────── Tabellenhilfen ─────────────────────────── */

/** Hängt eine Zeile an und erweitert die Kopfzeile um neue Schlüssel. */
function anhaengen_(blattName, zeile) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(blattName) || ss.insertSheet(blattName);

  var kopf = sh.getLastRow() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    : [];
  var geaendert = false;
  Object.keys(zeile).forEach(function (h) {
    if (kopf.indexOf(h) < 0) { kopf.push(h); geaendert = true; }
  });
  if (sh.getLastRow() === 0) {
    sh.appendRow(kopf);
  } else if (geaendert) {
    sh.getRange(1, 1, 1, kopf.length).setValues([kopf]);
  }

  sh.appendRow(kopf.map(function (h) {
    return zeile[h] !== undefined ? zeile[h] : '';
  }));
}

/** Setzt eine Zelle in der zuletzt angehängten Zeile. */
function setzeLetzte_(blattName, spalte, wert) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(blattName);
  if (!sh || sh.getLastRow() < 2) return;
  var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var i = kopf.indexOf(spalte);
  if (i < 0) return;
  sh.getRange(sh.getLastRow(), i + 1).setValue(wert);
}

function fehler_(wo, err) {
  try {
    anhaengen_(BLATT_FEHLER, {
      'Zeitpunkt': new Date(),
      'Wo': wo,
      'Fehler': String(err && err.stack ? err.stack : err)
    });
  } catch (e) { /* Fehlerprotokoll darf nie den Eingang blockieren */ }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
