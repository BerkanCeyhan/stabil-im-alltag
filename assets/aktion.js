/*
 * Black Friday 2026: setzt die Klasse "bf" am <html>, solange die Aktion läuft
 * (20.11. 00:00 Uhr bis 30.11. 24:00 Uhr deutscher Zeit).
 *
 *   ?bf=1   Vorschau, zeigt die Aktion auch vor dem 20.11.
 *   ?bf=0   blendet sie aus
 *
 * Synchron im <head> laden, damit beim Aufbau nichts umspringt. Die Seiten blenden mit der
 * Klasse alles mit .bf-an ein und alles mit .bf-aus aus (CSS steht in der jeweiligen Seite).
 * Die Produktseite ruecken/lp4/ hat dieselben Daten im eigenen Kopfskript, dort zusätzlich
 * mit Weihnachtshinweis und Geschenk-Variante. Wer das Enddatum ändert, ändert es an beiden Stellen
 * und im Rabattcode BLACKFRIDAY in Shopify.
 */
(function () {
  try {
    var b = new URLSearchParams(location.search).get('bf');
    var jetzt = Date.now();
    var von = Date.parse('2026-11-20T00:00:00+01:00');
    var bis = Date.parse('2026-12-01T00:00:00+01:00');
    if (b === '1' || (b !== '0' && jetzt >= von && jetzt < bis)) {
      document.documentElement.classList.add('bf');
    }
  } catch (e) {}
})();
