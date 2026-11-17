#!/usr/bin/env node
/**
 * Setzt die Meta-Statics November 2026 zusammen: öffnet assets/ads/2026-11/vorlagen.html
 * und speichert jedes <section class="ad"> als JPG, 1080 × 1350.
 *
 *   node scripts/bau-statics-2026-11.mjs            # alle
 *   node scripts/bau-statics-2026-11.mjs 03 14      # nur Motive, deren Name so beginnt
 *
 * Braucht Playwright. Im Repo ist es nicht installiert; PLAYWRIGHT zeigt auf eine vorhandene
 * Installation, Standard ist die aus ~/projects/wellenpuls-shop.
 * Ausgabe: assets/ads/2026-11/<name>.jpg
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PW = process.env.PLAYWRIGHT || resolve(ROOT, "../wellenpuls-shop/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(PW).href);

const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(ROOT, "assets/ads/2026-11/vorlagen.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const kaputt = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute("src")));
if (kaputt.length) console.log("Bilder fehlen:", kaputt);

for (const el of await page.locator("section.ad").all()) {
  const name = await el.getAttribute("data-name");
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  await el.screenshot({ path: resolve(ROOT, `assets/ads/2026-11/${name}.jpg`), type: "jpeg", quality: 92 });
  console.log("ok", name);
}
await browser.close();
