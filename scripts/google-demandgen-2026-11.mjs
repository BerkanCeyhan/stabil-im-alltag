#!/usr/bin/env node
/**
 * Baut den Plan für die Google-Kampagne "Demand Gen" zu Black Friday 2026 (YouTube, Discover, Gmail)
 * mit denselben Motiven wie bei Meta, damit die Leute überall dieselben Bilder sehen.
 *
 *   node scripts/google-demandgen-2026-11.mjs <ausgabe.json> [tagesbudget_euro]
 *   gads --kunde wellenpuls mutate @<ausgabe.json> --probe     # Google prüft, schreibt nichts
 *   gads --kunde wellenpuls mutate @<ausgabe.json>             # legt alles pausiert an
 *
 * Der Plan enthält die Bilder als Daten (mehrere MB), er gehört deshalb nicht ins Repo.
 * Alles entsteht pausiert: Kampagne, Anzeigengruppen und Anzeigen. Die Kampagne hat Start und Ende
 * (20.11. bis 30.11.2026), weil die Motive und Texte den Code BLACKFRIDAY nennen.
 *
 * Vorher: uv run --with pillow python scripts/google-formate-2026-11.py (Quadrate und Logo).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KUNDE = "customers/7822852952";
const ADS = "assets/ads/2026-11";
const [ausgabe, budgetArg] = process.argv.slice(2);
if (!ausgabe) {
  console.error("Aufruf: node scripts/google-demandgen-2026-11.mjs <ausgabe.json> [tagesbudget_euro]");
  process.exit(1);
}
const BUDGET_EURO = Number(budgetArg || 5);

const KAMPAGNE = "wp_ruecken_demandgen_2026-11";
const SEITE = "https://stabil-im-alltag.de/ruecken";

const GRUPPEN = [
  {
    name: "Kalt · Erfahrungsbericht → adv/3",
    ziel: `${SEITE}/adv/3/`,
    knopf: null,
    alter: "45+",
    motive: ["03-gelb", "04-zahl", "05-astronaut"],
    titel: [
      "Warum Rückenübungen oft nicht reichen",
      "Alles probiert. Warum hilft nichts?",
      "Astronauten und Ihr Rücken",
      "Rücken stärken ohne Matte",
      "Mit 61: Was meinem Rücken gefehlt hat",
    ],
    texte: [
      "Renate, 61, hat vier Jahre alles für ihren Rücken getan. Hier erzählt sie, was fehlte.",
      "Bis zu 7 von 10 machen ihre Rückenübungen zu Hause nicht wie verordnet. Woran das liegt.",
      "Ein Erfahrungsbericht über Rückentraining, das im Sitzen funktioniert.",
    ],
  },
  {
    name: "Produkt · Rückentraining im Sitzen → lp4",
    ziel: `${SEITE}/lp4/`,
    knopf: null,
    alter: "45+",
    motive: ["06-bisher-jetzt", "07-lindert-trainiert", "08-kreise", "09-vier-bilder", "11-story"],
    titel: [
      "Rückentraining im Sitzen",
      "Lindern oder trainieren?",
      "Trainiert den Rücken und ist bequem",
      "Vier Tasten, zwanzig Minuten",
      "Black Friday: 190 € Rabatt bis 30.11.",
    ],
    texte: [
      "Der Wellenpuls LWS spannt die Rückenmuskeln an, während Sie sitzen. 2-mal pro Woche.",
      "Gurtsystem mit Wärme, vier Tasten, keine App. Bis 30.11. mit dem Code BLACKFRIDAY.",
      "Zwanzig Minuten auf dem Sofa, danach schaltet er sich ab. Rückgabe bis 15. Januar.",
    ],
  },
  {
    name: "Black Friday · Angebot → lp4",
    ziel: `${SEITE}/lp4/`,
    knopf: "Jetzt einkaufen",
    alter: "35+",
    motive: ["13-black-friday", "16-bf-sofa", "17-bf-schwarz", "18-bf-weihnachten"],
    titel: [
      "Black Friday: 190 € Rabatt",
      "299 € statt 489 € bis 30.11.",
      "Rückentraining im Sitzen",
      "Jetzt schon für Weihnachten sichern",
      "Code BLACKFRIDAY an der Kasse",
    ],
    texte: [
      "Bis 30. November: Wellenpuls LWS für 299 statt 489 Euro. Code BLACKFRIDAY an der Kasse.",
      "Gurtsystem mit Reiseetui, Gespräch mit dem Gründer, Videokurs und E-Book.",
      "Trainiert die tiefen Rückenmuskeln im Sitzen. Rückgabe bis 15. Januar.",
    ],
  },
  {
    name: "Geschenk · Weihnachten → lp4 für Liebste",
    ziel: `${SEITE}/lp4/?fuer=eltern`,
    knopf: "Jetzt einkaufen",
    alter: "35-64",
    motive: ["15-papa-sessel", "19-bf-geschenk"],
    titel: [
      "Perfekt als Weihnachtsgeschenk",
      "Für Väter, die nichts brauchen",
      "Rückentraining für den Sessel",
      "190 € Rabatt bis 30. November",
    ],
    texte: [
      "Ein Geschenk, das benutzt wird: Rückentraining im Sitzen, vier Tasten, keine App.",
      "Bis 30.11. für 299 statt 489 Euro mit dem Code BLACKFRIDAY. Rückgabe bis 15. Januar.",
      "Der Gründer erklärt die Anwendung auf Wunsch direkt der beschenkten Person.",
    ],
  },
];

// Längen prüfen, bevor Google es tut: Titel 40, Text 90 Zeichen.
for (const g of GRUPPEN) {
  for (const t of g.titel) if ([...t].length > 40) throw new Error(`Titel zu lang (${[...t].length}): ${t}`);
  for (const t of g.texte) if ([...t].length > 90) throw new Error(`Text zu lang (${[...t].length}): ${t}`);
}

const plan = [];
let zaehler = 0;
const neu = () => --zaehler;
const b64 = (pfad) => readFileSync(resolve(ROOT, pfad)).toString("base64");

function bild(pfad, name) {
  const id = neu();
  plan.push({ assetOperation: { create: {
    resourceName: `${KUNDE}/assets/${id}`, name, type: "IMAGE", imageAsset: { data: b64(pfad) } } } });
  return `${KUNDE}/assets/${id}`;
}

const logo = bild(`${ADS}/google/logo-1x1.png`, "wp 2026-11 Logo 1x1");

// Alter: Demand Gen nimmt keine einzelnen Alterskriterien an der Anzeigengruppe
// (CANNOT_ADD_AUDIENCE_SEGMENT_CRITERION_WHEN_AUDIENCE_GROUPED_IS_SET). Es braucht ein Zielgruppen-Objekt.
const ALTER = {
  "45+": [{ minAge: 45, maxAge: 54 }, { minAge: 55, maxAge: 64 }, { minAge: 65 }],
  "35+": [{ minAge: 35, maxAge: 44 }, { minAge: 45, maxAge: 54 }, { minAge: 55, maxAge: 64 }, { minAge: 65 }],
  "35-64": [{ minAge: 35, maxAge: 44 }, { minAge: 45, maxAge: 54 }, { minAge: 55, maxAge: 64 }],
};
const zielgruppe = {};
for (const [name, ageRanges] of Object.entries(ALTER)) {
  zielgruppe[name] = `${KUNDE}/audiences/${neu()}`;
  plan.push({ audienceOperation: { create: {
    resourceName: zielgruppe[name], name: `wp Alter ${name} (Demand Gen 2026-11)`,
    description: "Nur Alter, sonst offen. Für die Black-Friday-Kampagne November 2026.",
    dimensions: [{ age: { ageRanges, includeUndetermined: false } }] } } });
}

const budget = `${KUNDE}/campaignBudgets/${neu()}`;
plan.push({ campaignBudgetOperation: { create: {
  resourceName: budget, name: `${KAMPAGNE} Budget`, amountMicros: String(BUDGET_EURO * 1_000_000),
  deliveryMethod: "STANDARD", explicitlyShared: false } } });

const kampagne = `${KUNDE}/campaigns/${neu()}`;
plan.push({ campaignOperation: { create: {
  resourceName: kampagne, name: KAMPAGNE, status: "PAUSED",
  advertisingChannelType: "DEMAND_GEN", campaignBudget: budget,
  targetSpend: {},
  containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
  startDateTime: "2026-11-20 00:00:00", endDateTime: "2026-11-30 23:59:59",
  finalUrlSuffix: `utm_source=google&utm_medium=demandgen&utm_campaign=${KAMPAGNE}&utm_content={creative}&utm_id={campaignid}`,
} } });

for (const g of GRUPPEN) {
  const gruppe = `${KUNDE}/adGroups/${neu()}`;
  plan.push({ adGroupOperation: { create: { resourceName: gruppe, name: g.name, campaign: kampagne, status: "PAUSED" } } });

  // Deutschland und Deutsch gehören bei Demand Gen an die Anzeigengruppe. Ohne Geo liefe sie weltweit.
  plan.push({ adGroupCriterionOperation: { create: { adGroup: gruppe, location: { geoTargetConstant: "geoTargetConstants/2276" } } } });
  plan.push({ adGroupCriterionOperation: { create: { adGroup: gruppe, language: { languageConstant: "languageConstants/1001" } } } });
  plan.push({ adGroupCriterionOperation: { create: { adGroup: gruppe, audience: { audience: zielgruppe[g.alter] } } } });

  const quadrat = g.motive.map((m) => ({ asset: bild(`${ADS}/google/${m}-1x1.jpg`, `wp 2026-11 ${m} 1x1`) }));
  const hoch = g.motive.map((m) => ({ asset: bild(`${ADS}/${m}.jpg`, `wp 2026-11 ${m} 4x5`) }));
  plan.push({ adGroupAdOperation: { create: {
    adGroup: gruppe, status: "PAUSED",
    ad: {
      name: g.name,
      finalUrls: [g.ziel],
      demandGenMultiAssetAd: {
        squareMarketingImages: quadrat,
        portraitMarketingImages: hoch,
        logoImages: [{ asset: logo }],
        headlines: g.titel.map((text) => ({ text })),
        descriptions: g.texte.map((text) => ({ text })),
        businessName: "Wellenpuls",
        // Knopftext: Google nimmt nur Werte aus einer festen Liste. "Jetzt einkaufen" geht; "Mehr erfahren",
        // "Weitere Informationen" und "Website besuchen" wurden am 17.11.2026 abgelehnt. Ohne Angabe wählt Google selbst.
        ...(g.knopf ? { callToActionText: g.knopf } : {}),
      },
    },
  } } });
}

writeFileSync(ausgabe, JSON.stringify(plan));
console.log(`${plan.length} Operationen, Tagesbudget ${BUDGET_EURO} €, geschrieben nach ${ausgabe}`);
