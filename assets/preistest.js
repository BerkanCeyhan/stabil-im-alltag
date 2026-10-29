/*
 * Preistest Oktober 2026: 489 € regulär gegen 299 € mit 38 % Neukunden-Rabatt (Code NEUKUNDE).
 *
 * Jeder Besucher bekommt beim ersten Aufruf eines Funnel-Bausteins (Advertorial, lp3)
 * zufällig 50/50 eine Variante und behält sie: a = 489 €, b = 299 € mit Code.
 *   ?angebot=neukunde  erzwingt b (Rabatt-Anzeigen)
 *   ?angebot=regulaer  erzwingt a (Preis-Anzeigen mit 489 €)
 *
 * Läuft synchron im <head>: setzt vor dem ersten Rendern die Klasse v-rabatt oder v-regulaer
 * auf <html>. Elemente mit .p-a sind nur in a sichtbar, .p-b nur in b.
 * Danach bekommen alle Links auf lp3 und den Checkout ?angebot=... angehängt, damit die
 * Variante über Advertorial -> Landingpage -> Checkout erhalten bleibt.
 *
 * Auswertung: window.SIA_PREIS.quelle ist "zufall" (Teil des Tests) oder "anzeige"
 * (per Link erzwungen, nicht Teil des 50/50-Vergleichs).
 *
 * Schalter: TEST_AKTIV = false zeigt allen ohne Parameter 489 €.
 */
(function () {
  var TEST_AKTIV = true;
  var KEY = 'sia_preistest_2026_10';
  var V = {
    a: { variante: 'a', preis: 489, code: '', param: 'regulaer' },
    b: { variante: 'b', preis: 299, code: 'NEUKUNDE', param: 'neukunde' }
  };

  var p = '';
  try { p = (new URLSearchParams(location.search).get('angebot') || '').toLowerCase(); } catch (e) {}
  var gespeichert = null;
  try { gespeichert = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}

  var v, quelle;
  if (p === 'neukunde' || p === 'regulaer') {
    v = p === 'neukunde' ? 'b' : 'a';
    // Einmal per Anzeige erzwungen bleibt erzwungen, auch beim Wiederkommen ohne Parameter.
    quelle = gespeichert && gespeichert.v === v ? gespeichert.quelle : 'anzeige';
  } else if (gespeichert && (gespeichert.v === 'a' || gespeichert.v === 'b')) {
    v = gespeichert.v; quelle = gespeichert.quelle || 'zufall';
  } else if (TEST_AKTIV) {
    v = Math.random() < 0.5 ? 'a' : 'b'; quelle = 'zufall';
  } else {
    v = 'a'; quelle = 'ohne-test';
  }
  try { localStorage.setItem(KEY, JSON.stringify({ v: v, quelle: quelle, t: Date.now() })); } catch (e) {}

  var info = V[v];
  window.SIA_PREIS = { variante: info.variante, preis: info.preis, code: info.code, quelle: quelle };
  document.documentElement.classList.add(v === 'b' ? 'v-rabatt' : 'v-regulaer');

  function ziel(url) {
    return /\/ruecken\/lp3\/?$/.test(url.pathname) || /\/ruecken\/checkout\/?$/.test(url.pathname);
  }
  function markiereLinks() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var url;
      try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
      if (url.origin !== location.origin || !ziel(url)) return;
      url.searchParams.set('angebot', info.param);
      a.setAttribute('href', url.pathname + url.search + url.hash);
      if (a.classList.contains('track-atc')) a.dataset.value = String(info.preis);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markiereLinks);
  else markiereLinks();

  // Code-Knopf (data-code-kopieren): kopiert den Code, damit er im Shopify-Checkout nur
  // eingefuegt werden muss. Seit 29.10.2026 traegt die Kasse den Code nicht mehr selbst ein.
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-code-kopieren]') : null;
    if (!b) return;
    var code = b.getAttribute('data-code-kopieren');
    var fertig = function () { b.textContent = code + ' kopiert'; setTimeout(function () { b.textContent = code; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(fertig, fertig);
    else fertig();
  });
})();
