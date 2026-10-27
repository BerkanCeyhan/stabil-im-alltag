/*
 * Umschalter alte Kasse (Formular -> Make -> WooCommerce/Mollie) -> Shopify-Checkout.
 *
 * Laeuft synchron im <head> von /ruecken/checkout/. Ist die Shopify-Kasse aktiv, leitet die
 * Seite sofort auf die Brueckenseite im Shop weiter, bevor irgendetwas gerendert wird. Alle
 * Funnels verlinken auf /ruecken/checkout/ und brauchen deshalb keine eigene Aenderung.
 *
 * Die Landingpages laden das Skript ebenfalls, leiten aber nicht weiter. Sie lesen nur
 * window.SIA_kasseShopify: Ist es true, meldet assets/consent.js beim Klick auf den Kaufbutton
 * kein AddToCart, weil die Meta-App im Shop das AddToCart selbst meldet.
 *
 * Die Bruecke (Shopify-Theme, templates/page.kasse.liquid) bekommt:
 *   angebot   neukunde | regulaer   (aus assets/preistest.js, wie bisher per ?angebot=)
 *   consent   ja | nein             (Marketing-Einwilligung aus dem Banner, fehlt = unentschieden)
 *   utm_*, fbclid, gclid, ...       (aus dem Cookie sia_attr von assets/consent.js)
 *   preis_quelle, seite             (Preistest-Auswertung, Herkunftsseite)
 *
 * Schalter:
 *   FUER_ALLE = true               Livegang: alle Besucher gehen zu Shopify
 *   ?kasse=shopify                 nur dieser Browser geht zu Shopify (Test), bleibt gespeichert
 *   ?kasse=alt                     Test beenden, wieder alte Kasse
 */
(function () {
  var FUER_ALLE = true;
  var BRUECKE = 'https://kasse.stabil-im-alltag.de/pages/kasse';
  var KEY = 'sia_kasse';

  var p = new URLSearchParams(location.search);
  var k = (p.get('kasse') || '').toLowerCase();
  try {
    if (k === 'shopify') localStorage.setItem(KEY, 'shopify');
    if (k === 'alt') localStorage.removeItem(KEY);
  } catch (e) {}
  var test = false;
  try { test = localStorage.getItem(KEY) === 'shopify'; } catch (e) {}
  window.SIA_kasseShopify = FUER_ALLE || test;
  if (!window.SIA_kasseShopify || !/\/checkout\/(index\.html)?$/.test(location.pathname)) return;

  function cookieJson(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  var ziel = new URL(BRUECKE);
  var angebot = (p.get('angebot') || '').toLowerCase();
  if (angebot === 'neukunde' || angebot === 'regulaer') ziel.searchParams.set('angebot', angebot);
  try {
    var g = JSON.parse(localStorage.getItem('sia_preistest_2026_10') || 'null');
    if (g && g.quelle) ziel.searchParams.set('preis_quelle', g.quelle);
  } catch (e) {}

  var consent = cookieJson('sia_consent');
  if (consent) ziel.searchParams.set('consent', consent.marketing ? 'ja' : 'nein');

  // Attribution: erst der Cookie, dann was die Seite selbst in der URL traegt.
  var attr = cookieJson('sia_attr') || {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
   'fbclid', 'gclid', 'gbraid', 'wbraid'].forEach(function (n) {
    var v = p.get(n) || attr[n];
    if (v) ziel.searchParams.set(n, v);
  });
  try { if (document.referrer) ziel.searchParams.set('seite', new URL(document.referrer).pathname); } catch (e) {}

  document.documentElement.style.visibility = 'hidden';
  location.replace(ziel.toString());
})();
