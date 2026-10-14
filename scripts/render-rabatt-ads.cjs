// Rendert die Rabatt-Anzeigen (299 EUR, 38 % Neukunden-Rabatt, Code NEUKUNDE) aus
// assets/ads/2026-10/v3/rabatt-vorlage.html nach assets/ads/2026-10/v3/{r-05,e-04}-rabatt.jpg.
//   node scripts/render-rabatt-ads.cjs
// Braucht Playwright (hier aus ~/projects/ig-ressources) und einen lokalen Server auf Port 8766:
//   python3 -m http.server 8766
const { chromium } = require(process.env.PLAYWRIGHT || '/home/berk/projects/ig-ressources/node_modules/playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const [zg, name] of [['ruecken', 'r-05-rabatt'], ['eltern', 'e-04-rabatt']]) {
    await p.goto(`http://localhost:8766/assets/ads/2026-10/v3/rabatt-vorlage.html?zg=${zg}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    const out = path.join(ROOT, `assets/ads/2026-10/v3/${name}.jpg`);
    await p.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log('ok', out);
  }
  await b.close();
})();
