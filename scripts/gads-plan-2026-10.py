#!/usr/bin/env python3
"""
Google-Ads-Suchkampagnen Oktober 2026 fuer Wellenpuls (Konto 7822852952).

    python3 scripts/gads-plan-2026-10.py > /tmp/plan.json
    gads --kunde wellenpuls mutate @/tmp/plan.json --probe     # prueft nur
    gads --kunde wellenpuls mutate @/tmp/plan.json --ja        # legt an

Zwei Suchkampagnen, beide PAUSED mit Start 15.10.2026 (Google erlaubt nur 00:00), je 5 EUR/Tag:
- wp_ruecken_search_2026-10: Geraetesuche -> lp3, Problemsuche -> Advertorial Ruecken
- wp_eltern_search_2026-10:  Geschenk-/Seniorensuche -> lp3?fuer=eltern, Problemsuche -> Eltern-Advertorial

Gebot: maximale Klicks mit CPC-Obergrenze 1,50 EUR, bis Kaeufe gemessen werden
(Google-Tag laeuft erst seit 14.10.). Danach auf maximale Conversions umstellen.
Nicht erlaubt (Google-Gesundheitsrichtlinie, beim Pruefen abgelehnt): "tens gerät rücken",
"rückenschmerzen beim stehen", "chronische rückenschmerzen", "rückenschmerzen nach autofahren".
Die Anzeigen verlinken ohne ?angebot, damit Google-Besucher in den 50/50-Preistest
der Seite fallen (assets/preistest.js).
"""
import json
import sys

CID = "7822852952"
C = f"customers/{CID}"
START = "2026-10-15 00:00:00"  # Google erlaubt nur Tagesbeginn
SITE = "https://stabil-im-alltag.de"

ops = []
tmp = [0]


def nid():
    tmp[0] -= 1
    return tmp[0]


def chk(texts, n, what):
    for t in texts:
        if len(t) > n:
            sys.exit(f"{what} zu lang ({len(t)} > {n}): {t}")


NEGATIV = [
    "kostenlos", "gratis", "gebraucht", "kleinanzeigen", "ebay", "amazon", "aldi", "lidl", "tchibo",
    "decathlon", "beurer", "sanitas", "medisana", "pdf", "youtube", "video", "job", "jobs",
    "ausbildung", "studium", "stellenangebot", "rezept", "krankenkasse", "hilfsmittel",
    "bandscheibenvorfall", "schwangerschaft", "schwanger", "hund", "pferd", "kind", "baby",
    "niere", "nierenschmerzen", "krebs", "symptome", "selber bauen", "reparatur", "ersatzteil",
]

SITELINKS = [
    ("So funktioniert es", "Sanfte Impulse, 20 Minuten", "Die tiefe Muskulatur arbeitet", f"{SITE}/ruecken/lp3/#so-funktionierts"),
    ("In 3 Schritten startklar", "Befeuchten, anlegen, einschalten", "Christian zeigt es im Video", f"{SITE}/ruecken/lp3/#anleitung"),
    ("Für Ihre Eltern", "Lieferung direkt zu den Eltern", "Vier Tasten, keine App", f"{SITE}/ruecken/lp3/?fuer=eltern"),
    ("Kundenstimmen", "4,9 von 5 aus 29 Bewertungen", "Über 120 Kundinnen und Kunden", f"{SITE}/ruecken/lp3/#stimmen"),
]
CALLOUTS = ["30 Tage testen", "Kostenloser Versand", "Kein Abo", "Mit Wärmefunktion",
            "Persönlicher Support", "Entwickelt an der DSHS", "Vier Tasten, keine App"]

KAMPAGNEN = [
    {
        "name": "wp_ruecken_search_2026-10",
        "suffix": "utm_source=google&utm_medium=cpc&utm_campaign=wp_ruecken_search_2026-10&utm_term={keyword}",
        "gruppen": [
            {
                "name": "Gerät · Rückentrainer → lp3",
                "url": f"{SITE}/ruecken/lp3/",
                "path": ("rueckentraining", "im-sitzen"),
                "keywords": [
                    ("wellenpuls", "EXACT"), ("wellenpuls lws", "EXACT"),
                    ("rückentrainer", "PHRASE"), ("rückentrainer gerät", "PHRASE"), ("rückentrainer für zuhause", "PHRASE"),
                    ("rückentrainer elektrisch", "PHRASE"), ("ems gürtel rücken", "PHRASE"), ("ems rückengürtel", "PHRASE"),
                    ("ems gerät rücken", "PHRASE"), ("ems rücken", "PHRASE"),
                    ("elektrostimulation rücken", "PHRASE"), ("muskelstimulation rücken", "PHRASE"), ("nmes gerät", "PHRASE"),
                    ("reizstromgerät rücken", "PHRASE"), ("rückengurt mit wärme", "PHRASE"), ("wärmegürtel rücken", "PHRASE"),
                    ("rücken trainieren im sitzen", "PHRASE"), ("rückenmuskulatur stärken gerät", "PHRASE"),
                    ("tiefenmuskulatur rücken gerät", "PHRASE"),
                ],
                "headlines": [
                    "Rückentraining im Sitzen", "Wellenpuls LWS", "Tiefe Rückenmuskulatur stärken", "20 Minuten, 2× pro Woche",
                    "30 Tage zu Hause testen", "Entwickelt an der DSHS Köln", "Vier Tasten, keine App", "Kostenloser Versand",
                    "Für den unteren Rücken", "Ganz ohne Rückenübungen", "Mit Wärmefunktion", "Geld-zurück-Garantie",
                    "Patent angemeldet", "NMES statt TENS", "Trainieren auf dem Sofa",
                ],
                "pin": {"Rückentraining im Sitzen": "HEADLINE_1"},
                "descriptions": [
                    "Der Gurt trainiert die tiefe Rückenmuskulatur, während Sie sitzen. 20 Minuten, mit Wärme.",
                    "30 Tage zu Hause testen. Hilft er Ihnen nicht, bekommen Sie den vollen Kaufpreis zurück.",
                    "Entwickelt an der Deutschen Sporthochschule Köln. Vier Tasten, kein Handy, keine App.",
                    "Mit 1:1-Gespräch mit dem Gründer, Videokurs und E-Book. Versand ist kostenlos.",
                ],
            },
            {
                "name": "Problem · unterer Rücken → Advertorial",
                "url": f"{SITE}/ruecken/adv/2/",
                "path": ("unterer-ruecken", ""),
                "keywords": [
                    ("unterer rücken stärken", "PHRASE"), ("tiefe rückenmuskulatur stärken", "PHRASE"),
                    ("tiefenmuskulatur rücken", "PHRASE"), ("rückenschmerzen unterer rücken", "PHRASE"), ("rückenschmerzen nach langem sitzen", "PHRASE"), ("rückenschmerzen im alter", "PHRASE"),
                    ("lws schmerzen", "PHRASE"),
                    ("rückenübungen helfen nicht", "PHRASE"), ("rücken stabilisieren", "PHRASE"),
                    ("rückenmuskulatur aufbauen", "PHRASE"), ("rückenschmerzen was hilft", "PHRASE"),
                ],
                "headlines": [
                    "Unterer Rücken zieht?", "Schmerzen nach langem Stehen?", "Rückenübungen helfen nicht?",
                    "Was mir keiner gesagt hat", "Ein Leser erzählt", "Nach dem Autofahren steif?",
                    "Warum Rückenübungen scheitern", "Die tiefe Rückenmuskulatur", "Jetzt kostenlos lesen",
                    "Sitzen, Stehen, Rücken zieht?", "Georgs Brief an die Leser",
                ],
                "pin": {},
                "descriptions": [
                    "Nach einer Stunde Stehen zieht es im unteren Rücken? Georg ging es jahrelang genauso.",
                    "Rückenübungen, Physio, Wärmflasche: Georg hat alles probiert. Was ihm keiner gesagt hat.",
                    "Warum die tiefe Rückenmuskulatur so wichtig ist und Rückenübungen sie selten erreichen.",
                ],
            },
        ],
    },
    {
        "name": "wp_eltern_search_2026-10",
        "suffix": "utm_source=google&utm_medium=cpc&utm_campaign=wp_eltern_search_2026-10&utm_term={keyword}",
        "gruppen": [
            {
                "name": "Geschenk · Senioren → lp3 Eltern",
                "url": f"{SITE}/ruecken/lp3/?fuer=eltern",
                "path": ("fuer-eltern", ""),
                "keywords": [
                    ("rückentrainer senioren", "PHRASE"), ("rückentraining senioren", "PHRASE"),
                    ("rückentraining für senioren", "PHRASE"), ("rückengerät für senioren", "PHRASE"),
                    ("ems gerät senioren", "PHRASE"), ("rücken stärken senioren", "PHRASE"),
                    ("geschenk eltern rückenschmerzen", "PHRASE"), ("geschenk mama rückenschmerzen", "PHRASE"),
                    ("geschenk papa rückenschmerzen", "PHRASE"), ("geschenk für senioren gesundheit", "PHRASE"),
                    ("geschenk für eltern gesundheit", "PHRASE"),
                ],
                "headlines": [
                    "Rückentraining für Eltern", "Ein Geschenk für den Rücken", "Rückentraining im Sessel",
                    "Ganz ohne Rückenübungen", "Vier Tasten, keine App", "Lieferung direkt zu den Eltern",
                    "30 Tage zu Hause testen", "Entwickelt an der DSHS Köln", "Wellenpuls LWS",
                    "Kostenloser Versand", "Für Mama oder Papa", "Einfach zu bedienen",
                ],
                "pin": {"Rückentraining für Eltern": "HEADLINE_1"},
                "descriptions": [
                    "Gurt anlegen, im Sessel sitzen bleiben: 20 Minuten, zweimal pro Woche, mit Wärme.",
                    "Auf Wunsch liefern wir direkt zu Ihren Eltern. Christian erklärt die Anwendung persönlich.",
                    "30 Tage zu Hause testen. Hilft er nicht, gibt es den vollen Kaufpreis zurück.",
                    "Vier Tasten, kein Handy, keine App. Entwickelt an der Deutschen Sporthochschule Köln.",
                ],
            },
            {
                "name": "Problem · Eltern → Advertorial Eltern",
                "url": f"{SITE}/ruecken/eltern/adv/",
                "path": ("eltern", "erfahrung"),
                "keywords": [
                    ("rückenschmerzen eltern", "PHRASE"), ("vater rückenschmerzen", "PHRASE"),
                    ("mutter rückenschmerzen", "PHRASE"), ("rückenschmerzen senioren", "PHRASE"),
                    ("rückenübungen senioren", "PHRASE"), ("rückenschmerzen im alter was tun", "PHRASE"),
                    ("senioren muskelabbau rücken", "PHRASE"), ("eltern machen keine übungen", "PHRASE"),
                ],
                "headlines": [
                    "Rückenübungen bleiben liegen?", "„Geht schon“, sagt Papa", "Ein Sohn erzählt",
                    "Wenn Papa nur noch sitzt", "Eltern mit Rückenschmerzen?", "Was Kinder tun können",
                    "Jetzt kostenlos lesen", "Erfahrungsbericht lesen", "Rücken der Eltern stärken",
                ],
                "pin": {},
                "descriptions": [
                    "„Geht schon“, sagt Papa am Telefon. Ein Sohn erzählt, was am Ende wirklich geholfen hat.",
                    "Die Rückenübungen vom Physiotherapeuten liegen in der Schublade? So war es bei Markus.",
                    "Warum Eltern ihre Rückenübungen nicht machen und was Sie als Sohn oder Tochter tun können.",
                ],
            },
        ],
    },
]

# Gemeinsame Assets (einmal anlegen, an beide Kampagnen haengen)
asset_ids = []
for text, d1, d2, url in SITELINKS:
    chk([text], 25, "Sitelink"); chk([d1, d2], 35, "Sitelink-Beschreibung")
    a = nid()
    ops.append({"assetOperation": {"create": {"resourceName": f"{C}/assets/{a}", "finalUrls": [url],
                "sitelinkAsset": {"linkText": text, "description1": d1, "description2": d2}}}})
    asset_ids.append((a, "SITELINK"))
for text in CALLOUTS:
    chk([text], 25, "Callout")
    a = nid()
    ops.append({"assetOperation": {"create": {"resourceName": f"{C}/assets/{a}", "calloutAsset": {"calloutText": text}}}})
    asset_ids.append((a, "CALLOUT"))

for k in KAMPAGNEN:
    b, c = nid(), nid()
    ops.append({"campaignBudgetOperation": {"create": {
        "resourceName": f"{C}/campaignBudgets/{b}", "name": f"{k['name']} Budget",
        "amountMicros": "5000000", "deliveryMethod": "STANDARD", "explicitlyShared": False}}})
    ops.append({"campaignOperation": {"create": {
        "resourceName": f"{C}/campaigns/{c}", "name": k["name"], "status": "PAUSED",
        "advertisingChannelType": "SEARCH", "campaignBudget": f"{C}/campaignBudgets/{b}",
        "targetSpend": {"cpcBidCeilingMicros": "1500000"},
        "networkSettings": {"targetGoogleSearch": True, "targetSearchNetwork": False,
                            "targetContentNetwork": False, "targetPartnerSearchNetwork": False},
        "geoTargetTypeSetting": {"positiveGeoTargetType": "PRESENCE", "negativeGeoTargetType": "PRESENCE"},
        "containsEuPoliticalAdvertising": "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        "startDateTime": START, "finalUrlSuffix": k["suffix"]}}})
    camp = f"{C}/campaigns/{c}"
    ops.append({"campaignCriterionOperation": {"create": {"campaign": camp, "location": {"geoTargetConstant": "geoTargetConstants/2276"}}}})
    ops.append({"campaignCriterionOperation": {"create": {"campaign": camp, "language": {"languageConstant": "languageConstants/1001"}}}})
    for n in NEGATIV:
        ops.append({"campaignCriterionOperation": {"create": {"campaign": camp, "negative": True,
                    "keyword": {"text": n, "matchType": "BROAD"}}}})
    for a, ft in asset_ids:
        ops.append({"campaignAssetOperation": {"create": {"campaign": camp, "asset": f"{C}/assets/{a}", "fieldType": ft}}})
    for g in k["gruppen"]:
        chk(g["headlines"], 30, "Titel"); chk(g["descriptions"], 90, "Beschreibung"); chk([p for p in g["path"]], 15, "Pfad")
        ag = nid()
        ops.append({"adGroupOperation": {"create": {"resourceName": f"{C}/adGroups/{ag}", "campaign": camp,
                    "name": g["name"], "status": "ENABLED", "type": "SEARCH_STANDARD"}}})
        adg = f"{C}/adGroups/{ag}"
        for text, mt in g["keywords"]:
            ops.append({"adGroupCriterionOperation": {"create": {"adGroup": adg, "status": "ENABLED",
                        "keyword": {"text": text, "matchType": mt}}}})
        heads = []
        for h in g["headlines"]:
            e = {"text": h}
            if h in g["pin"]:
                e["pinnedField"] = g["pin"][h]
            heads.append(e)
        rsa = {"headlines": heads, "descriptions": [{"text": d} for d in g["descriptions"]], "path1": g["path"][0]}
        if g["path"][1]:
            rsa["path2"] = g["path"][1]
        ops.append({"adGroupAdOperation": {"create": {"adGroup": adg, "status": "ENABLED",
                    "ad": {"finalUrls": [g["url"]], "responsiveSearchAd": rsa}}}})

json.dump(ops, sys.stdout, ensure_ascii=False, indent=1)
print(f"{len(ops)} Operationen", file=sys.stderr)
