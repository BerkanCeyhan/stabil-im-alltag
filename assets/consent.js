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
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    // Optionales Purchase-Event (z. B. Danke-Seite): nur mit Einwilligung, da Pixel sonst nicht geladen ist.
    if (window.SIA_PURCHASE && typeof window.SIA_PURCHASE === 'object') {
      fbq('track', 'Purchase', window.SIA_PURCHASE);
    }
  }

  /* ---------- Lead-Tracking (Browser-Pixel + Server-CAPI via Make) ---------- */
  function ensureFbc() {
    var e = getCookie('_fbc'); if (e) return e;
    var id = getParam('fbclid'); if (!id) return null;
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
  function sendEvent(eventName, btn, customData) {
    var href = btn && btn.href;

    if (!marketingAllowed()) {
      // Ohne Marketing-Einwilligung kein Pixel/CAPI – nur weiterleiten.
      if (href) window.location.href = href;
      return;
    }

    var eventId = eventName.toLowerCase() + '-' + Math.random().toString(36).substring(2, 12);
    if (typeof fbq === 'function') fbq('track', eventName, customData || {}, { eventID: eventId });

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
      fbclid: getParam('fbclid'),
      custom_data: customData || {}
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
    if (marketing) { loadPixel(); bindEventButtons(); }
    hideBanner();
  }

  // Banner nachträglich erneut öffnen (Footer-Link "Cookie-Einstellungen").
  window.SIA_openConsent = showBanner;

  /* ---------- Init ---------- */
  function init() {
    bindEventButtons(); // Buttons binden; sendEvent prüft Consent selbst.
    var consent = readConsent();
    if (consent) {
      if (consent.marketing) loadPixel();
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
