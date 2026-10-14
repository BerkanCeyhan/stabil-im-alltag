#!/usr/bin/env python3
"""
Baut eine einzelne HTML-Datei zum Verschicken (WhatsApp, Mail), in der alle Anzeigenmotive
eingebettet sind. Der Empfaenger tippt die guten Bilder an und schickt die Auswahl als JSON zurueck.

    python3 scripts/bau-anzeigen-auswahl.py

Quelle: assets/ads/2026-10/v3/*.jpg (verkleinert auf 800 px Breite)
Ziel:   assets/ads/2026-10/anzeigen-auswahl.html

Die Karten stehen fest im HTML, damit die Bilder auch in Vorschauen ohne JavaScript
sichtbar sind (z. B. WhatsApp auf dem iPhone). Das Antippen braucht einen Browser.
Benoetigt: ImageMagick (convert).
"""
import base64
import html
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/ads/2026-10/v3"
DST = ROOT / "assets/ads/2026-10/anzeigen-auswahl.html"

GROUPS = [
    ("Rücken, mit Produkt", "Führen direkt auf die Landingpage", [
        ("r-01", "r-01-30-tage-testen.jpg", "30 Tage testen"),
        ("r-02", "r-02-gurt-an-fernseher-an.jpg", "Gurt an. Fernseher an."),
        ("r-04", "r-04-im-sitzen.jpg", "Rücken trainieren. Im Sitzen."),
        ("r-05-489", "r-05-preis-489.jpg", "Preis 489 €"),
        ("r-05-299", "r-05-preis-299.jpg", "Preis 299 €"),
    ]),
    ("Eltern, mit Produkt", "Für Kinder, die für Mutter oder Vater kaufen", [
        ("e-01", "e-01-papa-rueckenuebungen.jpg", "Papa macht seine Rückenübungen nicht?"),
        ("e-02", "e-02-vier-tasten.jpg", "Vier Tasten. Kein Handy. Keine App."),
        ("e-03", "e-03-fuer-mama.jpg", "Für Mama. Ganz ohne Rückenübungen."),
        ("e-04-489", "e-04-preis-489.jpg", "Preis 489 €"),
        ("e-04-299", "e-04-preis-299.jpg", "Preis 299 €"),
    ]),
    ("Ohne Produkt", "Führen auf den Artikel, das Gerät kommt erst dort", [
        ("p-r-01", "p-r-01-stehen-kueche.jpg", "Nach einer Stunde Stehen tut der Rücken weh?"),
        ("p-r-02", "p-r-02-autofahrt.jpg", "Rückenschmerzen nach dem Autofahren?"),
        ("p-r-03", "p-r-03-uebungen-schublade.jpg", "Die Rückenübungen liegen in der Schublade?"),
        ("p-e-01", "p-e-01-geht-schon.jpg", "„Geht schon“, sagt Papa. Sein Rücken sagt etwas anderes."),
        ("p-e-02", "p-e-02-nur-noch-sessel.jpg", "Wenn Papa nur noch im Sessel sitzt"),
        ("p-e-03", "p-e-03-uebungsblatt-kuehlschrank.jpg", "Mamas Übungsblatt hängt seit Monaten am Kühlschrank?"),
    ]),
]


def data_uri(name):
    jpg = subprocess.run(
        ["convert", str(SRC / name), "-resize", "800x", "-strip", "-quality", "84", "jpg:-"],
        check=True, capture_output=True,
    ).stdout
    return "data:image/jpeg;base64," + base64.b64encode(jpg).decode()


CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>')

sections = []
for title, sub, items in GROUPS:
    cards = []
    for cid, fname, alt in items:
        a = html.escape(alt)
        cards.append(
            f'<button type="button" class="card" data-id="{cid}" aria-pressed="false" aria-label="{cid}: {a}">'
            f'<img src="{data_uri(fname)}" alt="{a}" width="800" height="993">'
            f'<span class="meta"><span class="id">{cid}</span>'
            f'<span class="state"><span class="box">{CHECK}</span><span class="lbl">Antippen</span></span></span>'
            f'</button>'
        )
    sections.append(
        f'<section><h2>{html.escape(title)}</h2><p class="sub">{html.escape(sub)}</p>'
        f'<div class="grid">{"".join(cards)}</div></section>'
    )

PAGE = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Wellenpuls Anzeigen-Auswahl</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&family=Literata:opsz,wght@7..72,600;7..72,700&display=swap">
<style>
/* Ruhige Bildwand: eine Spalte am Handy, bis drei am Desktop; Auswahlleiste unten fest. */
:root{
  --bg:oklch(98.5% 0.005 240);--surface:oklch(100% 0 0);--fg:oklch(24% 0.035 245);--fg-2:oklch(42% 0.03 245);
  --line:oklch(89% 0.015 240);--brand:oklch(27% 0.075 243);--pick:oklch(55% 0.12 165);--pick-soft:oklch(95% 0.035 165);
  --on-pick:oklch(99% 0.005 165);--bar:oklch(21% 0.055 245);--on-bar:oklch(97% 0.01 240);--on-bar-2:oklch(80% 0.03 240);
  --display:'Literata',Georgia,serif;--body:'Atkinson Hyperlegible Next','Segoe UI',Arial,sans-serif;
}
@media (prefers-color-scheme: dark){:root{
  --bg:oklch(19% 0.03 245);--surface:oklch(24% 0.035 245);--fg:oklch(95% 0.01 240);--fg-2:oklch(78% 0.02 240);
  --line:oklch(34% 0.03 245);--brand:oklch(90% 0.03 240);--pick:oklch(74% 0.12 165);--pick-soft:oklch(30% 0.05 165);
  --on-pick:oklch(18% 0.04 165);--bar:oklch(14% 0.03 245);--on-bar:oklch(96% 0.01 240);--on-bar-2:oklch(76% 0.02 240);color-scheme:dark}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);font-size:17px;line-height:1.5;-webkit-font-smoothing:antialiased}
.page{max-width:1080px;margin:0 auto;padding-inline:16px;padding-block:28px 160px}
h1,h2{font-family:var(--display);color:var(--brand);text-wrap:balance;line-height:1.2;margin:0}
h1{font-size:clamp(1.6rem,4.5vw,2.3rem)}
h2{font-size:1.25rem}
.intro{margin:10px 0 0;color:var(--fg-2);max-width:60ch}
section{margin-top:40px}
.sub{margin:4px 0 16px;color:var(--fg-2);font-size:0.92rem}
.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:560px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:900px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{position:relative;display:block;width:100%;padding:0;border:2px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;cursor:pointer;text-align:left;font:inherit;color:inherit;transition:border-color .15s ease-out,transform .15s ease-out}
.card img{display:block;width:100%;max-width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;background:var(--line)}
.card .meta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px}
.card .id{font-weight:700;font-size:0.9rem;font-variant-numeric:tabular-nums}
.card .state{font-size:0.85rem;color:var(--fg-2);display:inline-flex;align-items:center;gap:6px}
.card .box{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:grid;place-content:center;background:var(--surface);color:var(--on-pick)}
.card .box svg{width:14px;height:14px;opacity:0}
.card[aria-pressed="true"]{border-color:var(--pick);background:var(--pick-soft);box-shadow:0 0 0 3px var(--pick)}
.card[aria-pressed="true"] .box{background:var(--pick);border-color:var(--pick)}
.card[aria-pressed="true"] .box svg{opacity:1}
.card[aria-pressed="true"] .state{color:var(--fg);font-weight:700}
.card:active{transform:scale(.99)}
.card:focus-visible{outline:3px solid var(--pick);outline-offset:3px}
.send{margin-top:48px;padding:20px;border-radius:16px;background:var(--surface);border:1px solid var(--line);display:grid;gap:14px;max-width:720px}
.send label{display:grid;gap:6px;font-weight:700;font-size:0.92rem}
.send input,.send textarea{font:inherit;font-weight:400;color:var(--fg);background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;width:100%;min-width:0}
.send textarea{min-height:84px;resize:vertical}
#json{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.82rem;min-height:110px}
.row{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:10px 18px;border-radius:12px;border:0;font:inherit;font-weight:700;cursor:pointer;text-decoration:none}
.btn-main{background:var(--pick);color:var(--on-pick)}
.btn-wa{background:var(--brand);color:var(--bg)}
.btn-ghost{background:transparent;color:var(--fg-2);border:1.5px solid var(--line)}
.btn:focus-visible{outline:3px solid var(--pick);outline-offset:2px}
.note{font-size:0.88rem;color:var(--fg-2);margin:0}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:5;background:var(--bar);color:var(--on-bar);padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px))}
.bar-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.bar b{font-size:1.05rem}
.bar span{color:var(--on-bar-2);font-size:0.86rem;display:block}
.bar a{background:var(--pick);color:var(--on-pick);border-radius:12px;padding:12px 16px;font-weight:700;text-decoration:none;white-space:nowrap}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="page">
  <h1>Welche Anzeigen sind richtig gut?</h1>
  <p class="intro">Tippen Sie auf jedes Bild, das Sie gut finden. Noch einmal tippen nimmt die Auswahl zurück. Ganz unten können Sie die Auswahl kopieren oder direkt per WhatsApp schicken.</p>
  __SECTIONS__
  <form class="send" id="send" autocomplete="off">
    <h2>Auswahl schicken</h2>
    <label for="name">Ihr Name<input id="name" type="text" placeholder="z. B. Christian"></label>
    <label for="anmerkung">Anmerkung (optional)<textarea id="anmerkung" placeholder="z. B. e-03 gefällt mir, aber die Schrift ist zu klein"></textarea></label>
    <label for="json">Ihre Auswahl<textarea id="json" readonly></textarea></label>
    <div class="row">
      <button type="button" class="btn btn-main" id="copy">Auswahl kopieren</button>
      <a class="btn btn-wa" id="wa" href="https://wa.me/" target="_blank" rel="noopener">Per WhatsApp senden</a>
      <button type="button" class="btn btn-ghost" id="reset">Alles abwählen</button>
    </div>
    <p class="note" id="copied" aria-live="polite">Falls WhatsApp sich nicht öffnet: kopieren und in den Chat einfügen.</p>
  </form>
</div>
<div class="bar" role="region" aria-label="Auswahl">
  <div class="bar-inner">
    <div><b id="count">0 Bilder ausgewählt</b><span>Antippen zum Auswählen</span></div>
    <a href="#send">Fertig</a>
  </div>
</div>
<script>
(function(){
  var cards=[].slice.call(document.querySelectorAll(".card"));
  var ORDER=cards.map(function(b){return b.dataset.id;});
  var KEY="wellenpuls-auswahl-2026-10";
  var state={gut:[],name:"",anmerkung:""};
  try{var s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&Array.isArray(s.gut)){state.gut=s.gut.filter(function(x){return ORDER.indexOf(x)>-1;});state.name=s.name||"";state.anmerkung=s.anmerkung||"";}}catch(e){}
  var nameEl=document.getElementById("name"),noteEl=document.getElementById("anmerkung"),jsonEl=document.getElementById("json"),msg=document.getElementById("copied");
  function paint(b){var on=state.gut.indexOf(b.dataset.id)>-1;b.setAttribute("aria-pressed",on?"true":"false");b.querySelector(".lbl").textContent=on?"Gut":"Antippen";}
  function update(){
    var n=state.gut.length;
    document.getElementById("count").textContent=n===1?"1 Bild ausgewählt":n+" Bilder ausgewählt";
    var txt=JSON.stringify({auswahl:"Wellenpuls Anzeigen Oktober 2026",name:state.name.trim(),gut:state.gut,anmerkung:state.anmerkung.trim()},null,1);
    jsonEl.value=txt;
    document.getElementById("wa").href="https://wa.me/?text="+encodeURIComponent("Meine Auswahl der Wellenpuls-Anzeigen:\\n"+txt);
    try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}
  }
  cards.forEach(function(b){
    paint(b);
    b.addEventListener("click",function(){
      var id=b.dataset.id,i=state.gut.indexOf(id);
      if(i>-1)state.gut.splice(i,1);else state.gut.push(id);
      state.gut.sort(function(a,c){return ORDER.indexOf(a)-ORDER.indexOf(c);});
      paint(b);update();
    });
  });
  nameEl.value=state.name;noteEl.value=state.anmerkung;
  nameEl.addEventListener("input",function(){state.name=nameEl.value;update();});
  noteEl.addEventListener("input",function(){state.anmerkung=noteEl.value;update();});
  document.getElementById("send").addEventListener("submit",function(e){e.preventDefault();});
  document.getElementById("copy").addEventListener("click",function(){
    var txt=jsonEl.value;
    function fallback(){jsonEl.focus();jsonEl.select();msg.textContent="Text ist markiert. Jetzt kopieren und in WhatsApp einfügen.";}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){msg.textContent="Kopiert. Jetzt in WhatsApp einfügen und senden.";},fallback);}else fallback();
  });
  document.getElementById("reset").addEventListener("click",function(){state.gut=[];cards.forEach(paint);update();msg.textContent="Alle Bilder abgewählt.";});
  update();
})();
</script>
</body>
</html>
"""

DST.write_text(PAGE.replace("__SECTIONS__", "\n  ".join(sections)), encoding="utf-8")
print(DST, f"{DST.stat().st_size / 1e6:.2f} MB")
