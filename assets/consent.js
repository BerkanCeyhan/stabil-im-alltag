/* Stabil im Alltag – zentrales Consent-Management + Meta Pixel + Lead-Tracking
   Eine Datei, auf allen Funnel-Seiten eingebunden.
   Consent wird in einem Cookie (path=/) gespeichert und gilt damit funnelweit:
   Wer auf dem Advertorial zustimmt, sieht das Banner auf LP/Checkout/Danke nicht erneut. */
(function () {
  var PIXEL_ID = '576311248662294';
  // Meta Conversions-API via Make (Server-Side). Empfängt Browser-Events und spielt sie serverseitig an Meta.
  var CAPI_WEBHOOK = 'https://hook.eu2.make.com/7omhyj9vgfm9az1i1el3i9ihvfh5hjym';
  var COOKIE   = 'sia_consent';
  var MAXAGE   = 15552000; // 180 Tage

  /* ---------- Cookie-Helfer ---------- */
  function getCookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(n, v, age) {
    var p = [n + '=' + encodeURIComponent(v), 'path=/', 'max-age=' + (age || MAXAGE), 'samesite=lax'];
    if (location.protocol === 'https:') p.push('secure');
    document.cookie = p.join('; ');
  }
  function getParam(n) {
    try { return new URL(window.location.href).searchParams.get(n); } catch (e) { return null; }
  }

  /* ---------- Attribution (UTM + fbclid) funnelweit festhalten ---------- */
  // Meta hängt die UTM-Parameter nur an den ersten Klick. Auf dem Weg
  // Quiz -> LP -> Checkout -> Danke gehen sie sonst verloren. Deshalb einmal
  // in einem Cookie sichern und an interne Links wieder anhängen.
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid'];
  var ATTR_COOKIE = 'sia_attr';

  function readAttr() {
    var c = getCookie(ATTR_COOKIE);
    if (!c) return {};
    try { return JSON.parse(c) || {}; } catch (e) { return {}; }
  }
  function captureAttr() {
    var stored = readAttr();
    var fresh = {};
    var hasFresh = false;
    ATTR_KEYS.forEach(function (k) {
      var v = getParam(k);
      if (v) { fresh[k] = v; hasFresh = true; }
    });
    // Ein neuer Klick aus einer Anzeige überschreibt die alte Attribution komplett.
    var out = hasFresh ? fresh : stored;
    if (hasFresh) setCookie(ATTR_COOKIE, JSON.stringify(out), MAXAGE);
    return out;
  }
  function decorateLinks() {
    var attr = readAttr();
    var keys = Object.keys(attr);
    if (!keys.length) return;
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (a.__siaDecorated) return;
      var url;
      try { url = new URL(a.getAttribute('href'), window.location.href); } catch (e) { return; }
      if (url.origin !== window.location.origin) return;
      keys.forEach(function (k) { if (!url.searchParams.has(k)) url.searchParams.set(k, attr[k]); });
      a.__siaDecorated = true;
      a.setAttribute('href', url.pathname + url.search + url.hash);
    });
  }
  window.SIA_decorateLinks = decorateLinks;

  // Attributionsblock fuer eigene Payloads (Quiz, Checkout). Ohne diese Werte
  // laesst sich eine spaetere Bestellung keinem Klick zuordnen — der Cookie
  // allein nuetzt nichts, wenn ihn niemand ausliest.
  // Haengt bewusst NICHT an der Marketing-Einwilligung: der Aufrufer entscheidet,
  // was er damit tut, und schreibt den Einwilligungsstatus mit.
  window.SIA_getAttr = function () {
    var attr = readAttr();
    var out = {};
    Object.keys(attr).forEach(function (k) { out[k] = attr[k]; });
    out.fbc = getCookie('_fbc') || ensureFbc() || '';
    out.fbp = getCookie('_fbp') || '';
    out.referrer = document.referrer || '';
    out.page_url = window.location.href;
    return out;
  };

  function readConsent() {
    var c = getCookie(COOKIE);
    if (!c) return null;
    try { return JSON.parse(c); } catch (e) { return null; }
  }
  function saveConsent(obj) {
    obj.ts = Math.floor(Date.now() / 1000);
    setCookie(COOKIE, JSON.stringify(obj), MAXAGE);
  }

  /* ---------- Meta Pixel (nur nach Einwilligung) ---------- */
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded) return;
    pixelLoaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fetchClientIp();
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }

  /* ---------- Client-IP (für Meta Match Quality) ---------- */
  // Make/Webhook stellt die Besucher-IP nicht zuverlässig bereit. Daher holen wir die
  // öffentliche IP direkt im Browser (nur nach Einwilligung) und senden sie im Payload mit.
  var clientIp = null;
  var ipFetched = false;
  function fetchClientIp() {
    if (ipFetched) return;
    ipFetched = true;
    try {
      fetch('https://api.ipify.org?format=json')
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.ip) clientIp = d.ip; })
        .catch(function () {});
    } catch (e) {}
  }

  /* ---------- Lead-Tracking (Browser-Pixel + Server-CAPI via Make) ---------- */
  function ensureFbc() {
    var e = getCookie('_fbc'); if (e) return e;
    var id = getParam('fbclid') || readAttr().fbclid; if (!id) return null;
    var fbc = 'fb.1.' + Date.now() + '.' + id;
    setCookie('_fbc', fbc, MAXAGE);
    return fbc;
  }
  function marketingAllowed() {
    var c = readConsent();
    return !!(c && c.marketing);
  }
  // Feuert ein Standard-Event über Pixel (Browser) UND Conversions-API (Server, via Make).
  // Beide nutzen dieselbe eventID -> Meta dedupliziert. btn ist optional (für Klick-Weiterleitung).
  // Events, die vor der Einwilligung ausgelöst wurden (z. B. Quiz-Abschluss,
  // während das Banner noch offen ist), werden nachgefeuert, sobald zugestimmt wird.
  var pending = [];
  function flushPending() {
    var q = pending; pending = [];
    q.forEach(function (e) { sendEvent(e.name, null, e.data); });
  }

  function sendEvent(eventName, btn, customData) {
    var href = btn && btn.href;

    if (!marketingAllowed()) {
      // Ohne Marketing-Einwilligung kein Pixel/CAPI – nur weiterleiten.
      if (!href && pending.length < 10) pending.push({ name: eventName, data: customData });
      if (href) window.location.href = href;
      return;
    }

    var attr = readAttr();
    customData = customData || {};
    Object.keys(attr).forEach(function (k) { if (customData[k] == null) customData[k] = attr[k]; });

    var eventId = eventName.toLowerCase() + '-' + Math.random().toString(36).substring(2, 12);
    if (typeof fbq === 'function') fbq('track', eventName, customData, { eventID: eventId });

    var payload = {
      trigger: true,
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: window.location.href,
      referrer: document.referrer || null,
      client_user_agent: navigator.userAgent,
      fbp: getCookie('_fbp'),
      fbc: ensureFbc(),
      fbclid: getParam('fbclid') || readAttr().fbclid || null,
      client_ip_address: clientIp,
      custom_data: customData
    };

    var navigated = false;
    function go() { if (href && !navigated) { navigated = true; window.location.href = href; } }
    if (href) setTimeout(go, 500);
    fetch(CAPI_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(go).catch(go);
  }

  function bindEventButtons() {
    decorateLinks();
    // Advertorial: Klick auf CTA -> Lead
    document.querySelectorAll('.track-lead').forEach(function (btn) {
      if (btn.__siaBound) return;
      btn.__siaBound = true;
      btn.addEventListener('click', function (e) { e.preventDefault(); sendEvent('Lead', btn); });
    });
    // Landing Page: Klick auf Kauf-/Bestell-Button (Richtung Checkout) -> AddToCart
    document.querySelectorAll('.track-atc').forEach(function (btn) {
      if (btn.__siaBound) return;
      btn.__siaBound = true;
      btn.addEventListener('click', function (e) { e.preventDefault(); sendEvent('AddToCart', btn, { value: 489.00, currency: 'EUR' }); });
    });
  }

  /* ---------- Cookie-Banner UI ---------- */
  function injectStyles() {
    if (document.getElementById('sia-consent-style')) return;
    var css =
      '#sia-consent{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-top:3px solid #1A5C8A;box-shadow:0 -4px 24px rgba(0,0,0,.14);font-family:"Libre Franklin",system-ui,sans-serif;color:#1E2D3A}' +
      '#sia-consent .sia-in{max-width:920px;margin:0 auto;padding:20px 20px 22px}' +
      '#sia-consent h2{font-size:16px;font-weight:800;margin:0 0 8px}' +
      '#sia-consent p{font-size:13.5px;line-height:1.6;color:#3A5060;margin:0 0 12px}' +
      '#sia-consent a{color:#1A5C8A;text-decoration:underline}' +
      '#sia-consent .sia-opts{display:none;border-top:1px solid #E2E9F0;margin:12px 0;padding-top:12px}' +
      '#sia-consent .sia-opts.open{display:block}' +
      '#sia-consent .sia-opt{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;line-height:1.5;margin-bottom:10px;color:#3A5060}' +
      '#sia-consent .sia-opt strong{color:#1E2D3A;font-weight:700}' +
      '#sia-consent .sia-opt input{margin-top:3px;width:18px;height:18px;flex-shrink:0}' +
      '#sia-consent .sia-opt input:disabled{accent-color:#9FB2C2}' +
      '#sia-consent .sia-btns{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
      '#sia-consent button{font-family:inherit;font-size:14px;font-weight:800;border-radius:6px;padding:13px 20px;cursor:pointer;border:none;letter-spacing:.01em}' +
      '#sia-consent .sia-accept{background:#28836A;color:#fff;flex:1;min-width:180px}' +
      '#sia-consent .sia-accept:hover{background:#1f6b56}' +
      '#sia-consent .sia-save{background:#fff;color:#1A5C8A;border:1.5px solid #1A5C8A}' +
      '#sia-consent .sia-essential{background:#EFF2F5;color:#3A5060}' +
      '#sia-consent .sia-toggle{background:none;border:none;color:#1A5C8A;text-decoration:underline;font-weight:600;font-size:13px;padding:6px 0;cursor:pointer}' +
      '@media(max-width:560px){#sia-consent .sia-accept{flex:1 1 100%}}';
    var s = document.createElement('style');
    s.id = 'sia-consent-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function dzPath() {
    // Relativen Pfad zur Datenschutzseite je nach Verzeichnistiefe ermitteln.
    return '/datenschutz/';
  }

  function showBanner() {
    if (document.getElementById('sia-consent')) {
      document.getElementById('sia-consent').style.display = 'block';
      return;
    }
    injectStyles();
    var existing = readConsent();
    var preChecked = existing && existing.marketing ? 'checked' : '';
    var wrap = document.createElement('div');
    wrap.id = 'sia-consent';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie-Einstellungen');
    wrap.innerHTML =
      '<div class="sia-in">' +
        '<h2>Wir respektieren deine Privatsphäre</h2>' +
        '<p>Wir verwenden notwendige Cookies, damit diese Seite funktioniert. Mit deiner Einwilligung setzen wir zusätzlich Marketing-Cookies ein – konkret den <strong>Meta-Pixel</strong> (Facebook/Instagram), um die Wirksamkeit unserer Werbung zu messen. Dabei werden Daten an Meta übermittelt. Mehr dazu in der <a href="' + dzPath() + '">Datenschutzerklärung</a>. Deine Auswahl gilt für alle Seiten dieses Angebots.</p>' +
        '<div class="sia-opts" id="sia-opts">' +
          '<div class="sia-opt"><input type="checkbox" checked disabled><div><strong>Notwendig</strong> – technisch erforderlich für Anzeige und Bestellung (z. B. Speicherung deiner Cookie-Auswahl). Immer aktiv.</div></div>' +
          '<div class="sia-opt"><input type="checkbox" id="sia-mkt" ' + preChecked + '><div><strong>Marketing</strong> – Meta-Pixel und serverseitige Conversion-Messung (Meta CAPI). Hilft uns, Werbung zu optimieren.</div></div>' +
        '</div>' +
        '<div class="sia-btns">' +
          '<button type="button" class="sia-accept" id="sia-accept">Alle akzeptieren</button>' +
          '<button type="button" class="sia-essential" id="sia-essential">Nur notwendige</button>' +
          '<button type="button" class="sia-save" id="sia-save" style="display:none">Auswahl speichern</button>' +
          '<button type="button" class="sia-toggle" id="sia-detail">Einstellungen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    document.getElementById('sia-accept').addEventListener('click', grantAll);
    document.getElementById('sia-essential').addEventListener('click', essentialOnly);
    document.getElementById('sia-save').addEventListener('click', saveSelection);
    document.getElementById('sia-detail').addEventListener('click', function () {
      var opts = document.getElementById('sia-opts');
      opts.classList.toggle('open');
      document.getElementById('sia-save').style.display = opts.classList.contains('open') ? 'inline-block' : 'none';
    });
  }

  function hideBanner() {
    var el = document.getElementById('sia-consent');
    if (el) el.style.display = 'none';
  }

  function grantAll() {
    saveConsent({ essential: true, marketing: true });
    loadPixel();
    bindEventButtons();
    flushPending();
    firePurchase();
    hideBanner();
  }
  function essentialOnly() {
    saveConsent({ essential: true, marketing: false });
    hideBanner();
  }
  function saveSelection() {
    var mkt = document.getElementById('sia-mkt');
    var marketing = !!(mkt && mkt.checked);
    saveConsent({ essential: true, marketing: marketing });
    if (marketing) { loadPixel(); bindEventButtons(); flushPending(); firePurchase(); }
    hideBanner();
  }

  /* ---------- Purchase (Bestätigungsseite): Pixel + CAPI via Make, einmalig ---------- */
  var purchaseSent = false;
  function firePurchase() {
    if (purchaseSent) return;
    try { if (sessionStorage.getItem('sia_purchase_sent') === '1') return; } catch (e) {}
    var data = window.SIA_PURCHASE;
    if (!data || typeof data !== 'object') return;
    if (!marketingAllowed()) return;
    purchaseSent = true;
    try { sessionStorage.setItem('sia_purchase_sent', '1'); } catch (e) {}
    // Kurze Verzögerung, damit die Client-IP (Match Quality) geladen ist.
    setTimeout(function () { sendEvent('Purchase', null, data); }, 1200);
  }

  // Öffentliche Helfer für andere Seiten (Danke-Seite, Quiz).
  window.SIA_openConsent = showBanner;                 // Cookie-Banner erneut öffnen
  window.SIA_bindEvents = bindEventButtons;            // dynamisch eingefügte Event-Buttons binden
  window.SIA_getConsent = readConsent;                 // Consent-Status auslesen
  window.SIA_trackPurchase = function (d) { if (d && typeof d === 'object') window.SIA_PURCHASE = d; firePurchase(); };
  // Beliebiges Standard-Event feuern: Pixel + CAPI mit gemeinsamer eventID.
  // Ohne Marketing-Einwilligung wird das Event gepuffert und nach Zustimmung nachgefeuert.
  window.SIA_track = function (name, customData) { if (name) sendEvent(name, null, customData || {}); };

  /* ---------- Init ---------- */
  function init() {
    captureAttr();      // UTM/fbclid aus der URL sichern, bevor navigiert wird.
    bindEventButtons(); // Buttons binden; sendEvent prüft Consent selbst.
    var consent = readConsent();
    if (consent) {
      if (consent.marketing) { loadPixel(); flushPending(); firePurchase(); }
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
