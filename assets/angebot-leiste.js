/*
 * Mitlaufende Leiste "Mehr Informationen" für die Advertorials, unten auf Handy und Desktop.
 *
 * Erscheint erst, wenn der Leser beim Wellenpuls angekommen ist: Das Element mit
 * data-leiste-start (die Bildunterschrift unter dem Anwendungsbild) muss einmal
 * im Bild gewesen sein. Danach bleibt sie, außer solange der Abschluss-Button
 * (.cta-final) zu sehen ist, damit nicht zwei Buttons übereinander stehen.
 *
 * Markup im Advertorial:
 *   <div class="angebot-leiste" id="angebot-leiste">
 *     <div class="al-in">
 *       <div class="al-text"><strong>Wellenpuls LWS</strong><span>30 Tage zu Hause testen</span></div>
 *       <a href="../../lp3/" class="al-btn track-lead" data-mess-klick="leiste">Mehr Informationen</a>
 *     </div>
 *   </div>
 */
(function () {
  var css =
    '.angebot-leiste{position:fixed;left:0;right:0;bottom:0;z-index:900;background:#fff;border-top:1px solid #D0DCE8;' +
    'box-shadow:0 -6px 24px rgba(30,45,58,.12);transform:translateY(110%);visibility:hidden;' +
    'transition:transform .32s ease,visibility 0s linear .32s;padding-bottom:env(safe-area-inset-bottom)}' +
    '.angebot-leiste.zeigen{transform:none;visibility:visible;transition:transform .32s ease}' +
    '.angebot-leiste .al-in{max-width:740px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:14px}' +
    '.angebot-leiste .al-text{flex:1;min-width:0;font-family:"Libre Franklin",system-ui,sans-serif;line-height:1.3;color:#1E2D3A}' +
    '.angebot-leiste .al-text strong{display:block;font-size:15px;font-weight:800}' +
    '.angebot-leiste .al-text span{display:block;font-size:13px;color:#6B7E8C}' +
    '.angebot-leiste .al-btn{flex-shrink:0;background:#28836A;color:#fff;text-decoration:none;border-radius:50px;' +
    'padding:13px 22px;font-family:"Libre Franklin",system-ui,sans-serif;font-size:15px;font-weight:800;white-space:nowrap}' +
    '.angebot-leiste .al-btn::after{content:" \\2192"}' +
    '.angebot-leiste .al-btn:hover{background:#1f6b56}' +
    '.angebot-leiste .al-btn:focus-visible{outline:3px solid #1A5C8A;outline-offset:2px}' +
    '@media (max-width:400px){.angebot-leiste .al-in{gap:10px;padding:10px 12px}.angebot-leiste .al-btn{padding:12px 16px;font-size:14px}}' +
    '@media (prefers-reduced-motion:reduce){.angebot-leiste,.angebot-leiste.zeigen{transition:none}}';

  function start() {
    var leiste = document.getElementById('angebot-leiste');
    var marke = document.querySelector('[data-leiste-start]');
    if (!leiste || !marke || !('IntersectionObserver' in window)) return;

    var stil = document.createElement('style');
    stil.textContent = css;
    document.head.appendChild(stil);

    var freigegeben = false;
    var abschlussSichtbar = false;
    function aktualisieren() {
      var an = freigegeben && !abschlussSichtbar;
      leiste.classList.toggle('zeigen', an);
      leiste.setAttribute('aria-hidden', an ? 'false' : 'true');
      // Platz am Seitenende, damit die Leiste den Hinweistext nicht verdeckt.
      document.body.style.paddingBottom = freigegeben ? leiste.offsetHeight + 'px' : '';
    }

    // "Etwas danach": Die Bildunterschrift muss bis in die obere Bildschirmhälfte
    // gewandert sein (oder darüber), das Anwendungsbild ist dann ganz gesehen.
    // Per Position statt IntersectionObserver, damit auch schnelles Springen zählt.
    var geplant = false;
    function pruefen() {
      geplant = false;
      if (freigegeben || marke.getBoundingClientRect().top > window.innerHeight * 0.55) return;
      freigegeben = true;
      window.removeEventListener('scroll', beimScrollen);
      aktualisieren();
    }
    function beimScrollen() {
      if (!geplant) { geplant = true; requestAnimationFrame(pruefen); }
    }
    window.addEventListener('scroll', beimScrollen, { passive: true });
    pruefen();

    var abschluss = document.querySelector('.cta-final');
    if (abschluss) {
      new IntersectionObserver(function (e) {
        abschlussSichtbar = e[0].isIntersecting;
        aktualisieren();
      }).observe(abschluss);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
