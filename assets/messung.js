/*
 * Eigene Lesemessung für Advertorial, Landingpage, Checkout und Danke-Seite.
 *
 * Schreibt über dasselbe Apps Script wie die Quiz-Schritte in das Blatt "Seiten"
 * der Quiz-Tabelle (apps-script/quiz-sheet, Nutzlast typ "seite").
 *
 * Ohne Cookie und ohne localStorage: Die Sitzungs-ID lebt nur im Arbeitsspeicher
 * dieser einen Seite, es wird nichts auf dem Gerät gespeichert oder von dort
 * gelesen und kein Formularinhalt übertragen. Deshalb hängt die Messung nicht an
 * der Marketing-Einwilligung, wie die Quiz-Schritte auch.
 *
 * Einbinden (defer, nach preistest.js):
 *   <script src="../../assets/messung.js" data-seite="lp3" defer></script>
 *
 * Ereignisse
 *   ansicht     Seite geladen
 *   scroll      25, 50, 75, 100 Prozent der Seite erreicht (Wert = Prozent)
 *   abschnitt   eine Überschrift (h2 in main/article) oder ein Element mit
 *               data-mess="name" ist ins Bild gekommen (Detail = Name)
 *   klick       Link oder Button mit data-mess-klick="name", .track-lead, .track-atc
 *   feld        Checkout: ein Formularfeld wurde zum ersten Mal angetippt (Detail = name)
 *   absenden    Checkout: Formular abgeschickt
 *   ende        Seite verlassen (Wert = tiefster Scroll in Prozent, Sekunden = Lesezeit)
 */
(function () {
  var ENDPUNKT = 'https://script.google.com/macros/s/AKfycbwraM9stECq1iIpcdo1V--YByP7p78MGb-gpcNxdabL1nzF25OT9pJmfjyxlhrvZlQb3A/exec';
  if (navigator.webdriver) return; // automatisierte Browser verfälschen die Zahlen

  var skript = document.currentScript;
  var SEITE = (skript && skript.getAttribute('data-seite')) || location.pathname;
  var SID = (function () {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      var a = new Uint32Array(4); crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (n) { return n.toString(36); }).join('');
    } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  })();

  var p = new URLSearchParams(location.search);
  if (p.get('fuer')) SEITE += '-' + p.get('fuer').slice(0, 12); // lp3-eltern
  var basis = {
    typ: 'seite',
    sid: SID,
    seite: SEITE,
    utm_source: p.get('utm_source') || '',
    utm_campaign: p.get('utm_campaign') || '',
    utm_content: p.get('utm_content') || '',
    geraet: window.innerWidth < 768 ? 'mobil' : 'desktop'
  };

  // Lesezeit zählt nur, solange die Seite sichtbar ist.
  var lesezeit = 0;
  var sichtbarSeit = document.visibilityState === 'visible' ? Date.now() : 0;
  function sekunden() {
    var ms = lesezeit + (sichtbarSeit ? Date.now() - sichtbarSeit : 0);
    return Math.round(ms / 1000);
  }

  function variante() {
    var v = window.SIA_PREIS;
    if (v) return { variante: v.variante, quelle: v.quelle };
    var a = (p.get('angebot') || '').toLowerCase();
    if (a === 'neukunde') return { variante: 'b', quelle: '' };
    if (a === 'regulaer') return { variante: 'a', quelle: '' };
    return { variante: '', quelle: '' };
  }

  function sende(ereignis, detail, wert) {
    var n = {};
    var k;
    for (k in basis) n[k] = basis[k];
    var v = variante();
    n.variante = v.variante;
    n.quelle = v.quelle;
    n.ereignis = ereignis;
    n.detail = detail || '';
    if (typeof wert === 'number') n.wert = wert;
    n.sek = sekunden();
    var text = JSON.stringify(n);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPUNKT, new Blob([text], { type: 'text/plain;charset=utf-8' }))) return;
    } catch (e) {}
    try {
      fetch(ENDPUNKT, { method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: text }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Scrolltiefe ---------- */
  var tiefste = 0;
  var stufen = [25, 50, 75, 100];
  var geplant = false;
  function scrollMessen() {
    geplant = false;
    abschnittePruefen();
    var doc = document.documentElement;
    var hoehe = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (!hoehe) return;
    var prozent = Math.min(100, Math.round((window.scrollY + window.innerHeight) / hoehe * 100));
    if (prozent >= 98) prozent = 100;
    if (prozent <= tiefste) return;
    tiefste = prozent;
    while (stufen.length && prozent >= stufen[0]) sende('scroll', '', stufen.shift());
  }
  window.addEventListener('scroll', function () {
    if (!geplant) { geplant = true; requestAnimationFrame(scrollMessen); }
  }, { passive: true });

  /* ---------- Abschnitte ---------- */
  function kurz(t) {
    return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  // Erreicht ist ein Abschnitt, wenn sein Anfang im oberen Teil des Bildschirms
  // angekommen ist oder schon darüber liegt (auch nach schnellem Springen).
  var offen = [];
  function abschnittePruefen() {
    if (!offen.length) return;
    var grenze = window.innerHeight * 0.7;
    offen = offen.filter(function (z) {
      if (z.el.getBoundingClientRect().top > grenze) return true;
      sende('abschnitt', z.name);
      return false;
    });
  }
  function abschnitteSammeln() {
    var ziele = [];
    document.querySelectorAll('[data-mess]').forEach(function (el) {
      ziele.push({ el: el, name: el.getAttribute('data-mess') });
    });
    var h2 = document.querySelectorAll('main h2, article h2');
    if (!h2.length) h2 = document.querySelectorAll('h2');
    Array.prototype.forEach.call(h2, function (el, i) {
      if (el.closest('[data-mess]')) return;
      ziele.push({ el: el, name: 'h2-' + (i + 1) + ' ' + kurz(el.textContent) });
    });
    // In Seitenreihenfolge, damit die Ereignisse beim Springen geordnet ankommen.
    ziele.sort(function (a, b) {
      return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    offen = ziele;
  }

  /* ---------- Klicks ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!el) return;
    var name = el.getAttribute('data-mess-klick');
    if (!name && el.classList.contains('track-lead')) name = 'lead';
    if (!name && el.classList.contains('track-atc')) name = 'bestellen';
    if (!name) return;
    sende('klick', name);
  }, true);

  /* ---------- Checkout-Formular ---------- */
  function formularBeobachten() {
    var f = document.getElementById('checkout-form');
    if (!f) return;
    var gesehen = {};
    f.addEventListener('focusin', function (e) {
      var n = e.target && (e.target.name || e.target.id);
      if (!n || gesehen[n]) return;
      gesehen[n] = true;
      sende('feld', n);
    });
    f.addEventListener('submit', function () { sende('absenden'); }, true);
  }

  /* ---------- Ende ---------- */
  var beendet = false;
  function ende() {
    if (beendet) return;
    beendet = true;
    sende('ende', '', tiefste);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (sichtbarSeit) { lesezeit += Date.now() - sichtbarSeit; sichtbarSeit = 0; }
      ende();
    } else {
      sichtbarSeit = Date.now();
      beendet = false; // zurückgekommen: beim nächsten Verlassen erneut melden
    }
  });
  window.addEventListener('pagehide', ende);

  // Herkunft ohne Parameter: Host und Pfad der vorigen Seite.
  function herkunft() {
    try {
      if (!document.referrer) return '';
      var r = new URL(document.referrer);
      return kurz(r.hostname.replace(/^www\./, '') + r.pathname);
    } catch (e) { return ''; }
  }

  function start() {
    sende('ansicht', herkunft());
    abschnitteSammeln();
    formularBeobachten();
    scrollMessen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
