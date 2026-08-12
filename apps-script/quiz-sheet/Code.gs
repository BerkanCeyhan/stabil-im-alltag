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
 * E-Mail-HTML. Tabellenlayout mit Inline-CSS: Outlook rendert kein Flexbox und
 * ignoriert externe Stylesheets. Feste Breite 600px, eine Spalte.
 *
 * Die Farben sind die Tokens der Seite, aus oklch nach sRGB uebersetzt —
 * Mailclients kennen oklch nicht. Die Dunkelfassung steht im style-Block;
 * Clients, die ihn verwerfen, sehen die helle Fassung. Hell ist die Referenz.
 *
 * Bilder liegen unter assets/mail/ in doppelter Anzeigebreite und werden per
 * width-Attribut halbiert. In keinem Bild steckt Text, der Knopf ist HTML:
 * bei blockierten Bildern bleibt die Mail vollstaendig lesbar.
 */
function auswertungHtml_(antworten, angle, token) {
  var a = antworten || {};
  var t = auswertungTexte_(a, angle);
  var ziel = auswertungsLink_(token);
  var lpZiel = LP_BASIS + (angle ? '?angle=' + encodeURIComponent(angle) : '');
  var bild = 'https://stabil-im-alltag.de/assets/mail/';
  var schrift = '\'Libre Franklin\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif';

  // Eine Zeile der Angaben-Tabelle. Leere Antworten fallen weg.
  function zeile(label, wert) {
    if (!wert) return '';
    return '<tr>' +
      '<td class="rule soft" style="padding:10px 0;border-bottom:1px solid #efe5e3;font-size:14px;' +
        'line-height:1.5;color:#5b4e55;" width="52%">' + htmlEsc_(label) + '</td>' +
      '<td class="rule ink" style="padding:10px 0;border-bottom:1px solid #efe5e3;font-size:14px;' +
        'line-height:1.5;color:#30252b;font-weight:700;text-align:right;">' +
        htmlEsc_(String(wert).split('|').map(function (s) { return s.trim(); }).join(' · ')) +
      '</td></tr>';
  }

  var angaben =
    zeile('Zeit seit der Geburt', a.time) +
    zeile('Deine Lücke', a.gap) +
    zeile('Wölbung im Tagesverlauf', a.bulge) +
    zeile('Belastung im Alltag', a.burden) +
    zeile('Was am meisten stört', a.bother) +
    zeile('Schon versucht', a.tried);

  // Ein Schritt des Plans.
  function schritt(nr, kopf, text) {
    return '<tr><td style="padding:0 0 16px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
      '<tr>' +
      '<td width="30" valign="top" class="akzent" style="font-family:' + schrift + ';font-size:15px;' +
        'font-weight:800;color:#73455b;">' + nr + '.</td>' +
      '<td valign="top" style="font-family:' + schrift + ';">' +
        '<div class="ink" style="font-size:15px;font-weight:700;color:#30252b;">' + kopf + '</div>' +
        '<div class="soft" style="font-size:14px;line-height:1.6;color:#5b4e55;margin-top:2px;">' + text + '</div>' +
      '</td></tr></table></td></tr>';
  }

  return '' +
'<!doctype html><html lang="de"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<meta name="color-scheme" content="light dark">' +
'<meta name="supported-color-schemes" content="light dark">' +
'<title>Deine Auswertung</title>' +
'<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;700;800&display=swap" rel="stylesheet"><!--<![endif]-->' +
'<style>' +
  'body{margin:0;padding:0;width:100%!important;}' +
  'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}' +
  'a{color:#73455b;}' +
  '@media (max-width:620px){' +
    '.huelle{padding:12px 8px!important;}' +
    '.innen{padding-left:20px!important;padding-right:20px!important;}' +
    '.h1{font-size:22px!important;}' +
  '}' +
  '@media (prefers-color-scheme:dark){' +
    '.canvas{background:#1a1417!important;}' +
    '.karte{background:#282024!important;border-color:#3e353a!important;}' +
    '.ink{color:#f3ecf0!important;}' +
    '.soft{color:#cac1c6!important;}' +
    '.mut{color:#9e959a!important;}' +
    '.akzent{color:#ce8fac!important;}' +
    '.rule{border-color:#3e353a!important;}' +
    '.pale{background:#412331!important;}' +
    '.paleTxt{color:#f3ecf0!important;}' +
    '.knopf{background:#b36c8f!important;}' +
    '.knopfTxt{color:#1a1417!important;}' +
    'a{color:#ce8fac!important;}' +
  '}' +
'</style></head>' +
'<body class="canvas" style="margin:0;padding:0;background:#fdf4f1;">' +

// Vorschauzeile im Posteingang. Die Fuellzeichen verhindern, dass der Client
// stattdessen den Beginn des Fliesstextes anreisst.
'<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' +
  'Deine Angaben, die Einordnung dazu und dein Plan für die nächsten zwölf Wochen.' +
  '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;' +
'</div>' +

'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="canvas" style="background:#fdf4f1;">' +
'<tr><td align="center" class="huelle" style="padding:24px 12px;">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="karte" style="width:600px;max-width:100%;background:#fffdfb;border:1px solid #efe5e3;border-radius:14px;overflow:hidden;font-family:' + schrift + ';">' +

    // Farbkante. Outlook zeigt den Verlauf nicht und faellt auf die Grundfarbe zurueck.
    '<tr><td height="3" bgcolor="#73455b" style="height:3px;line-height:3px;font-size:3px;background:#73455b;background-image:linear-gradient(90deg,#73455b,#487552);">&nbsp;</td></tr>' +

    // Kopf. Das Feld bleibt auch im Dunkelmodus hell: das Logo ist eine
    // transparente Datei auf heller Flaeche und verschwaende im Dunkeln.
    '<tr><td align="center" bgcolor="#fffdfb" style="background:#fffdfb;padding:20px 30px;border-bottom:1px solid #efe5e3;">' +
      '<img src="' + bild + 'logo-264.png" width="132" alt="Stabil im Alltag" style="display:block;width:132px;height:auto;">' +
    '</td></tr>' +

    '<tr><td style="font-size:0;line-height:0;">' +
      '<img src="' + bild + 'hero-1200.jpg" width="600" alt="Junge Mutter mit Kind auf dem Arm, trägt den Wellenpuls LWS um die Körpermitte" style="display:block;width:100%;max-width:600px;height:auto;">' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:26px 30px 0 30px;">' +
      '<div class="akzent" style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#73455b;">Deine Auswertung</div>' +
      '<h1 class="h1 ink" style="margin:10px 0 0;font-size:25px;line-height:1.22;color:#30252b;font-weight:800;letter-spacing:-.01em;">' + htmlEsc_(t.titel) + '</h1>' +
      '<p class="soft" style="margin:10px 0 0;font-size:15px;line-height:1.65;color:#5b4e55;">Deine Angaben, die Einordnung dazu und dein Plan für die nächsten zwölf Wochen.</p>' +
    '</td></tr>' +

    (angaben ?
    '<tr><td class="innen" style="padding:24px 30px 0 30px;">' +
      '<div class="mut" style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c7177;">Deine Angaben</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;border-collapse:collapse;font-family:' + schrift + ';">' +
        angaben +
      '</table>' +
    '</td></tr>' : '') +

    '<tr><td class="innen" style="padding:20px 30px 0 30px;">' +
      '<p class="ink" style="margin:0;font-size:15px;line-height:1.7;color:#30252b;">' + htmlEsc_(t.einordnung) + '</p>' +
      (t.schwerpunkt ? '<p class="soft" style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#5b4e55;">' + htmlEsc_(t.schwerpunkt) + '</p>' : '') +
      '<p class="soft" style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#5b4e55;"><strong class="ink" style="color:#30252b;">Der Haken ist die Regelmäßigkeit.</strong> Woche für Woche, in einem Alltag, der sich nach dem Kind richtet. Daran scheitern die meisten.</p>' +
    '</td></tr>' +

    '<tr><td align="center" class="innen" style="padding:24px 30px 0 30px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">' +
        '<tr><td class="knopf" bgcolor="#73455b" align="center" style="background:#73455b;border-radius:11px;">' +
          '<a href="' + htmlEsc_(lpZiel) + '" class="knopfTxt" style="display:inline-block;padding:16px 30px;font-family:' + schrift + ';font-size:16px;font-weight:700;color:#fffdfb;text-decoration:none;border-radius:11px;">Plan und Angebot ansehen</a>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:28px 30px 0 30px;">' +
      '<div class="mut" style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c7177;margin-bottom:12px;">Dein Plan für die nächsten 12 Wochen</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        schritt(1, 'Woche 1 bis 4 — die Tiefe wieder ansprechen',
          'Beim Ausatmen den Bauchnabel sanft nach innen ziehen, ohne zu pressen. Zweimal täglich zehn ruhige Atemzüge.') +
        schritt(2, 'Woche 5 bis 8 — Belastung dosiert dazunehmen',
          'Aufstehen, das Kind hochnehmen, Treppen — bewusst mit gehaltener Mitte. Wölbt sich der Bauch kegelförmig vor, eine Stufe zurück.') +
        schritt(3, 'Woche 9 bis 12 — halten statt neu anfangen',
          'Nicht die Intensität entscheidet, sondern dass es stattfindet. Zwei feste Termine pro Woche, verknüpft mit etwas, das ohnehin passiert.') +
      '</table>' +
      '<p class="mut" style="margin:0;font-size:13px;line-height:1.6;color:#7c7177;">Sit-ups, Crunches und Planks bleiben vorerst außen vor — sie belasten die Mittellinie dort, wo sie zusammenwachsen soll. Das ist eine allgemeine Orientierung und ersetzt keine physiotherapeutische Anleitung.</p>' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:22px 30px 0 30px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="pale" style="background:#fbebf2;border-radius:12px;">' +
        '<tr><td style="padding:14px 14px 0 14px;font-size:0;line-height:0;">' +
          '<img src="' + bild + 'anatomie-1024.jpg" width="512" alt="Schematische Darstellung der Rektusdiastase: die Bauchmuskeln weichen entlang der Mittellinie auseinander" style="display:block;width:100%;max-width:512px;height:auto;border-radius:8px;">' +
        '</td></tr>' +
        '<tr><td style="padding:12px 16px 16px 16px;font-family:' + schrift + ';">' +
          '<div class="ink" style="font-size:15px;font-weight:700;color:#30252b;">Der Selbsttest, falls du die Lücke noch nicht gemessen hast</div>' +
          '<div class="soft" style="font-size:14px;line-height:1.6;color:#5b4e55;margin-top:5px;">Flach auf den Rücken, Beine angewinkelt. Zwei Finger längs über dem Nabel, Kopf und Schultern leicht anheben. Wie viele Finger passen quer in die Lücke? Miss auch auf Nabelhöhe und darunter — die Breite ist selten überall gleich.</div>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    '<tr><td align="center" class="innen" style="padding:18px 30px 0 30px;">' +
      '<a href="' + htmlEsc_(ziel) + '" class="mut" style="font-size:13px;line-height:1.6;color:#7c7177;">Diese Auswertung im Browser ansehen</a>' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:24px 30px 0 30px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #efe5e3;" class="rule">' +
        '<tr><td width="56" valign="top" style="padding:18px 12px 0 0;">' +
          '<img src="' + bild + 'portrait-112.jpg" width="56" alt="" style="display:block;width:56px;height:56px;border-radius:28px;">' +
        '</td>' +
        '<td valign="top" style="padding:18px 0 0 0;font-family:' + schrift + ';">' +
          '<p class="soft" style="margin:0;font-size:15px;line-height:1.6;color:#5b4e55;">Fragen? Antworte einfach auf diese Mail.</p>' +
          '<p class="soft" style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#5b4e55;">Herzliche Grüße<br><strong class="ink" style="color:#30252b;">Christian Senfleben</strong> · Wellenpuls</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:22px 30px 0 30px;">' +
      '<p class="mut rule" style="margin:0;font-size:12px;line-height:1.6;color:#7c7177;border-top:1px solid #efe5e3;padding-top:16px;">Der Wellenpuls LWS ist ein Trainingsgerät, kein Medizinprodukt, und ersetzt keine ärztliche Beratung. Dieser Check dient der Einordnung und stellt keine Diagnose. Nicht in der Schwangerschaft anwenden; beginne frühestens 6 Wochen nach der Geburt und kläre die Anwendung bei Beschwerden ärztlich ab. Individuelle Ergebnisse können variieren.</p>' +
    '</td></tr>' +

    '<tr><td class="innen" style="padding:14px 30px 28px 30px;">' +
      '<p class="mut" style="margin:0;font-size:12px;line-height:1.6;color:#7c7177;">Du bekommst diese E-Mail, weil du den Rektusdiastase-Check auf stabil-im-alltag.de gemacht und um deine Auswertung gebeten hast.<br>' +
      'Wellenpuls GmbH · <a href="https://stabil-im-alltag.de/impressum/" class="mut" style="color:#7c7177;">Impressum</a> · <a href="https://stabil-im-alltag.de/datenschutz/" class="mut" style="color:#7c7177;">Datenschutz</a></p>' +
    '</td></tr>' +

  '</table>' +
'</td></tr></table></body></html>';
}

/**
 * Nur-Text-Fassung. Zoho Mail nimmt ueber die Messages-API keine Textalternative
 * entgegen, dort geht die Mail als reines HTML raus. Diese Fassung traegt den
 * MailApp-Rueckfall und bleibt die Grundlage, falls der Versandweg wechselt.
 */
function auswertungText_(antworten, angle, token) {
  var a = antworten || {};
  var t = auswertungTexte_(a, angle);
  var z = [];

  function zeile(label, wert) {
    if (!wert) return;
    z.push('- ' + label + ': ' +
      String(wert).split('|').map(function (s) { return s.trim(); }).join(', '));
  }

  z.push(t.titel.toUpperCase());
  z.push('');
  z.push('Deine Angaben, die Einordnung dazu und dein Plan fuer die naechsten');
  z.push('zwoelf Wochen.');
  z.push('');
  z.push('DEINE ANGABEN');
  zeile('Zeit seit der Geburt', a.time);
  zeile('Deine Luecke', a.gap);
  zeile('Woelbung im Tagesverlauf', a.bulge);
  zeile('Belastung im Alltag', a.burden);
  zeile('Was am meisten stoert', a.bother);
  zeile('Schon versucht', a.tried);
  z.push('');
  z.push(t.einordnung);
  if (t.schwerpunkt) { z.push(''); z.push(t.schwerpunkt); }
  z.push('');
  z.push('Der Haken ist die Regelmaessigkeit. Woche fuer Woche, in einem Alltag,');
  z.push('der sich nach dem Kind richtet. Daran scheitern die meisten.');
  z.push('');
  z.push('Plan und Angebot ansehen: ' + LP_BASIS +
         (angle ? '?angle=' + encodeURIComponent(angle) : ''));
  z.push('');
  z.push('DEIN PLAN FUER DIE NAECHSTEN 12 WOCHEN');
  z.push('1. Woche 1-4: Beim Ausatmen den Bauchnabel sanft nach innen ziehen,');
  z.push('   ohne zu pressen. Zweimal taeglich zehn ruhige Atemzuege.');
  z.push('2. Woche 5-8: Aufstehen, das Kind hochnehmen, Treppen - bewusst mit');
  z.push('   gehaltener Mitte. Woelbt sich der Bauch kegelfoermig vor, eine Stufe zurueck.');
  z.push('3. Woche 9-12: Nicht die Intensitaet entscheidet, sondern dass es');
  z.push('   stattfindet. Zwei feste Termine pro Woche.');
  z.push('Sit-ups, Crunches und Planks bleiben vorerst aussen vor. Allgemeine');
  z.push('Orientierung, ersetzt keine physiotherapeutische Anleitung.');
  z.push('');
  z.push('DER SELBSTTEST, FALLS DU DIE LUECKE NOCH NICHT GEMESSEN HAST');
  z.push('Flach auf den Ruecken, Beine angewinkelt. Zwei Finger laengs ueber dem');
  z.push('Nabel, Kopf und Schultern leicht anheben. Wie viele Finger passen quer');
  z.push('in die Luecke? Miss auch auf Nabelhoehe und darunter.');
  z.push('');
  z.push('Diese Auswertung im Browser ansehen: ' + auswertungsLink_(token));
  z.push('');
  z.push('Fragen? Antworte einfach auf diese Mail.');
  z.push('Herzliche Gruesse, Christian Senfleben / Wellenpuls');
  z.push('');
  z.push('Der Wellenpuls LWS ist ein Trainingsgeraet, kein Medizinprodukt, und');
  z.push('ersetzt keine aerztliche Beratung. Nicht in der Schwangerschaft anwenden;');
  z.push('beginne fruehestens 6 Wochen nach der Geburt.');
  z.push('Wellenpuls GmbH - https://stabil-im-alltag.de/impressum/');
  return z.join('\n');
}

/**
 * Die geschuetzte Auswertungsseite. Erreichbar ausschliesslich mit dem
 * Schluessel aus der E-Mail, `noindex` und `noarchive`.
 *
 * Seit 2026-08-10 stehen dieselben Angaben auch in der E-Mail selbst — auf
 * ausdrueckliche Entscheidung. Die Seite ist damit nicht mehr der einzige Ort
 * der Gesundheitsangaben, sondern der Zweitweg fuer Postfaecher, die HTML
 * schlecht darstellen.
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
function zohoMailSenden_(an, betreff, html) {
  var k = zohoKonf_();
  if (!k || !k.mail_account_id || !k.mail_from) return null;

  // Nur die dokumentierten Schluessel. Zoho antwortet auf jeden unbekannten
  // Schluessel mit 404 EXTRA_KEY_FOUND_IN_JSON — eine Nur-Text-Fassung nimmt
  // dieser Endpunkt nicht entgegen, die Mail geht als reines HTML raus.
  var nutzlast = {
    fromAddress: k.mail_from,
    toAddress: an,
    subject: betreff,
    content: html,
    mailFormat: 'html'
  };

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
  var e = auswertungAufbauenUndSenden_(email, sid, angle);
  if (e.token) setzeLetzte_(BLATT_IDENTITAET, 'token', e.token);
  setzeLetzte_(BLATT_IDENTITAET, 'mail', e.status);
}

/**
 * Baut die Auswertung und schickt sie ab. Schreibt bewusst NICHT in die
 * Tabelle — der Aufrufer weiss, welche Zeile gemeint ist. Beim regulaeren
 * Eingang ist das die letzte, beim Nachsenden eine beliebige weiter oben.
 *
 * Rueckgabe: { status: <Text fuer die Spalte 'mail'>, token: <oder ''> }
 */
function auswertungAufbauenUndSenden_(email, sid, angle) {
  try {
    if (!versandErlaubt_(email)) return { status: 'übersprungen (Testmodus)', token: '' };

    var gefunden = antwortenZurSitzung_(sid);
    var antworten = gefunden.antworten || {};
    var winkel = angle || gefunden.angle || '';

    var token = tokenNeu_();
    var betreff = 'Deine Auswertung aus dem Rektusdiastase-Check';
    var html = auswertungHtml_(antworten, winkel, token);
    var text = auswertungText_(antworten, winkel, token);

    // Regelweg: Zoho Mail, Absender auf der eigenen Domain.
    var status = zohoMailSenden_(email, betreff, html);

    // Rueckfall nur, solange Zoho Mail nicht konfiguriert ist. MailApp sendet
    // vom Google-Konto des Bereitstellers — als Dauerloesung fuer Kundenpost
    // ungeeignet, deshalb wird es in der Tabelle deutlich vermerkt.
    if (status === null) {
      MailApp.sendEmail({
        to: email, name: ABSENDER_NAME, replyTo: ANTWORT_AN,
        subject: betreff, body: text, htmlBody: html
      });
      status = 'gesendet (MailApp, Rückfall)';
    }
    if (!Object.keys(antworten).length) status += ' — ohne Antworten';
    return { status: status, token: token };
  } catch (err) {
    fehler_('sendeAuswertung', err);
    return { status: 'fehler: ' + String(err), token: '' };
  }
}

/* ───────────────────── Nachsenden liegengebliebener Mails ───────────────────
 *
 * Waehrend `TESTMODUS` gesetzt war, sind Eintragungen mit gueltiger
 * Gesundheitseinwilligung ohne ihre zugesagte Auswertung geblieben. Die Zusage
 * steht am Tor, also wird sie eingeloest, sobald der Versand offen ist.
 *
 *   1. `nachsendenPruefen()`  — zeigt im Protokoll, wer drankaeme. Sendet nichts.
 *   2. `nachsendenOffene()`   — sendet und traegt das Ergebnis je Zeile ein.
 *
 * Beide ueberspringen Zeilen, deren `sid` mit TEST beginnt, und alles, was
 * bereits 'gesendet' traegt. Mehrfaches Ausfuehren schickt deshalb nichts
 * doppelt.
 */

/** Sammelt die Zeilen, die eine Auswertung schulden. */
function offeneAuswertungen_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLATT_IDENTITAET);
  if (!sh || sh.getLastRow() < 2) return { kopf: [], zeilen: [], blatt: sh };
  var kopf = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iMail = kopf.indexOf('mail'), iEmail = kopf.indexOf('E-Mail'),
      iSid = kopf.indexOf('sid'), iHealth = kopf.indexOf('consent_health'),
      iAngle = kopf.indexOf('Angle'), iZeit = kopf.indexOf('Zeitpunkt');
  var werte = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var offen = [];
  for (var i = 0; i < werte.length; i++) {
    var r = werte[i];
    var email = String(r[iEmail] || '').trim();
    var sid = String(r[iSid] || '');
    var mail = String(r[iMail] || '');
    if (!email || email.indexOf('@') < 0) continue;
    if (String(r[iHealth]).toLowerCase() !== 'ja') continue;   // ohne Einwilligung nie
    if (mail.indexOf('gesendet') === 0) continue;              // schon raus
    if (sid.indexOf('TEST') === 0) continue;                   // eigene Testzeilen
    offen.push({
      zeile: i + 2, email: email, sid: sid, angle: String(r[iAngle] || ''),
      zeitpunkt: r[iZeit], bisher: mail
    });
  }
  return { kopf: kopf, zeilen: offen, blatt: sh };
}

/** Trockenlauf. Zeigt, wer drankaeme, und sendet nichts. */
function nachsendenPruefen() {
  var d = offeneAuswertungen_();
  var p = PropertiesService.getScriptProperties();
  var sperre = p.getProperty('TESTMODUS') || p.getProperty('ZOHO_TESTMODUS');
  Logger.log(sperre
    ? 'ACHTUNG: Sperre aktiv (' + sperre + ') — es ginge nur an diese Adressen.'
    : 'Keine Sperre gesetzt, Versand ginge an alle unten.');
  Logger.log('Offen: ' + d.zeilen.length);
  d.zeilen.forEach(function (z) {
    Logger.log('  Zeile %s  %s  %s  bisher: "%s"',
               z.zeile, z.zeitpunkt, z.email, z.bisher);
  });
}

/** Sendet die offenen Auswertungen und traegt Status und Token je Zeile ein. */
function nachsendenOffene() {
  var d = offeneAuswertungen_();
  var iMail = d.kopf.indexOf('mail'), iToken = d.kopf.indexOf('token');
  var heute = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.');
  Logger.log('Nachzusenden: ' + d.zeilen.length);

  d.zeilen.forEach(function (z) {
    var e = auswertungAufbauenUndSenden_(z.email, z.sid, z.angle);
    var status = e.status.indexOf('gesendet') === 0
      ? e.status + ' — nachgesendet ' + heute
      : e.status;
    d.blatt.getRange(z.zeile, iMail + 1).setValue(status);
    if (e.token && iToken >= 0) d.blatt.getRange(z.zeile, iToken + 1).setValue(e.token);
    Logger.log('  Zeile %s  %s  ->  %s', z.zeile, z.email, status);
    SpreadsheetApp.flush();
    Utilities.sleep(1200);   // Zoho Mail nicht in einem Rutsch anfahren
  });
  Logger.log('Fertig.');
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
