#!/usr/bin/env node
/**
 * Google Sheets + Apps Script vom Terminal aus, damit der Agent direkt drankommt.
 * Keine npm-Abhaengigkeiten, nur fetch.
 *
 * ANMELDUNG (Details in docs/SOP-google-apps-script.md)
 *   Eigener OAuth-Client Typ "Desktop", dann eines von beiden:
 *     node scripts/gsuite.mjs auth ~/client_secret_....json
 *     node scripts/gsuite.mjs auth            # liest GOOGLE_CLIENT_* aus .env
 *   Dazu einmal der Schalter auf https://script.google.com/home/usersettings.
 *
 *   Die Credentials der Cloud SDK gehen NICHT. Deren Client-ID ist fuer
 *   .../auth/spreadsheets gesperrt, die Anmeldung endet in "Diese App ist
 *   blockiert". Ein eigener Client ist Pflicht.
 *
 *   gsuite.mjs whoami        zeigt, welche Berechtigungen wirklich erteilt sind
 *
 * SHEETS
 *   gsuite.mjs sheets:tabs   <sheetId>
 *   gsuite.mjs sheets:get    <sheetId> <A1Range> [--json]
 *   gsuite.mjs sheets:append <sheetId> <A1Range> <rows|@datei.json|->
 *   gsuite.mjs sheets:update <sheetId> <A1Range> <rows|@datei.json|->
 *   gsuite.mjs sheets:clear  <sheetId> <A1Range>
 *   gsuite.mjs sheets:addtab <sheetId> <Titel>
 *
 * APPS SCRIPT
 *   gsuite.mjs script:info        <scriptId>
 *   gsuite.mjs script:pull        <scriptId> [verzeichnis]
 *   gsuite.mjs script:push        <scriptId> [verzeichnis]
 *   gsuite.mjs script:versions    <scriptId>
 *   gsuite.mjs script:deployments <scriptId>
 *   gsuite.mjs script:deploy      <scriptId> <deploymentId> [beschreibung]
 *
 * script:deploy legt eine neue Version an und haengt die bestehende
 * Bereitstellung darauf um. Die /exec-URL bleibt dadurch gleich - genau der
 * Schritt, der bisher von Hand im Editor gemacht wurde.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REDIRECT_PORT = Number(process.env.GOOGLE_OAUTH_PORT || 4573);
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;

// Bewusst knapp gehalten: Tabellen lesen/schreiben, Script-Code, Bereitstellungen.
// Kein Drive-Scope, der Agent braucht keinen Vollzugriff auf die Ablage.
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
];

function env(name, required = true) {
  if (process.env[name]) return process.env[name].trim();
  let raw = "";
  try {
    raw = readFileSync(resolve(ROOT, ".env"), "utf8");
  } catch {
    raw = "";
  }
  const m = raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"));
  const val = m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
  if (!val && required) throw new Error(`${name} fehlt in .env`);
  return val;
}

/* Zwei Quellen fuer die Anmeldung, in dieser Reihenfolge:
   1. GOOGLE_* in .env, geschrieben von `gsuite.mjs auth`. Der normale Weg.
   2. Application Default Credentials, falls jemand sie mit einem eigenen
      Client-ID-File erzeugt hat. Mit dem Standardclient der Cloud SDK
      funktioniert das nicht, der ist fuer den Sheets-Scope gesperrt. */
const ADC_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(process.env.HOME || "/root", ".config/gcloud/application_default_credentials.json");

function credentials() {
  if (env("GOOGLE_REFRESH_TOKEN", false)) {
    return {
      source: ".env",
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
    };
  }
  let adc;
  try {
    adc = JSON.parse(readFileSync(ADC_PATH, "utf8"));
  } catch {
    throw new Error(
      "Keine Anmeldung gefunden. Eigenen OAuth-Client Typ \"Desktop\" anlegen, dann\n" +
        "  node scripts/gsuite.mjs auth <client_secret_....json>\n" +
        "Siehe docs/SOP-google-apps-script.md."
    );
  }
  if (!adc.refresh_token) throw new Error(`${ADC_PATH} enthaelt kein refresh_token.`);
  return { source: ADC_PATH, ...adc };
}

let cachedToken = null;

async function accessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 30000) return cachedToken.value;
  const c = credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.client_id,
      client_secret: c.client_secret,
      refresh_token: c.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${JSON.stringify(json)}`);
  cachedToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

/* ---------- OAuth, einmalig im Browser ---------- */

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function cmdAuth([file]) {
  // Entweder die aus der Console geladene client_secret_*.json, oder .env.
  let clientId;
  let clientSecret;
  if (file) {
    const j = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
    const c = j.installed || j.web || j;
    clientId = c.client_id;
    clientSecret = c.client_secret;
    if (!clientId || !clientSecret) throw new Error(`${file} enthaelt keine client_id/client_secret.`);
    console.log(`Client aus ${file}\n`);
  } else {
    clientId = env("GOOGLE_CLIENT_ID");
    clientSecret = env("GOOGLE_CLIENT_SECRET");
  }
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent", // erzwingt ein Refresh-Token, auch bei erneutem Lauf
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

  const code = await new Promise((done, fail) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      const c = u.searchParams.get("code");
      const err = u.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<p>${c ? "Fertig. Zurueck ins Terminal." : "Fehlgeschlagen: " + err}</p>`);
      server.close();
      c ? done(c) : fail(new Error(err || "kein Code erhalten"));
    });
    server.listen(REDIRECT_PORT, "127.0.0.1", () => {
      console.log("\nDiese URL im Browser oeffnen:\n\n" + authUrl + "\n");
      console.log("Warte auf die Weiterleitung ...");
    });
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Code-Tausch fehlgeschlagen: ${JSON.stringify(json)}`);
  if (!json.refresh_token) throw new Error("Kein refresh_token zurueckgekommen. Zugriff unter myaccount.google.com/permissions entfernen und erneut versuchen.");
  console.log("\nDiese Zeile in .env eintragen:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}\n`);
}

/* ---------- Sheets ---------- */

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const enc = (s) => encodeURIComponent(s);

async function readRows(arg) {
  let raw = arg;
  if (arg === "-") raw = await readStdin();
  else if (arg.startsWith("@")) raw = readFileSync(resolve(ROOT, arg.slice(1)), "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error("Zeilen muessen ein Array von Arrays sein, z. B. [[\"a\",\"b\"],[\"c\",\"d\"]]");
  }
  return rows;
}

function printTable(values) {
  (values || []).forEach((row) => console.log(row.map((c) => String(c ?? "")).join("\t")));
}

const sheetsCmds = {
  async tabs([id]) {
    const j = await api(`${SHEETS}/${id}?fields=properties.title,sheets.properties`);
    console.log(j.properties.title);
    j.sheets.forEach((s) => {
      const p = s.properties;
      console.log(`  ${p.title}\tid=${p.sheetId}\t${p.gridProperties.rowCount}x${p.gridProperties.columnCount}`);
    });
  },
  async get([id, range, flag]) {
    const j = await api(`${SHEETS}/${id}/values/${enc(range)}`);
    if (flag === "--json") console.log(JSON.stringify(j.values || [], null, 2));
    else printTable(j.values);
  },
  async append([id, range, rows]) {
    const j = await api(
      `${SHEETS}/${id}/values/${enc(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: { values: await readRows(rows) } }
    );
    console.log(j.updates.updatedRange);
  },
  async update([id, range, rows]) {
    const j = await api(`${SHEETS}/${id}/values/${enc(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: { values: await readRows(rows) },
    });
    console.log(`${j.updatedRange} (${j.updatedCells} Zellen)`);
  },
  async clear([id, range]) {
    const j = await api(`${SHEETS}/${id}/values/${enc(range)}:clear`, { method: "POST", body: {} });
    console.log(j.clearedRange);
  },
  async addtab([id, title]) {
    await api(`${SHEETS}/${id}:batchUpdate`, {
      method: "POST",
      body: { requests: [{ addSheet: { properties: { title } } }] },
    });
    console.log(`Tabellenblatt "${title}" angelegt.`);
  },
};

/* ---------- Apps Script ---------- */

const SCRIPT = "https://script.googleapis.com/v1/projects";
const EXT = { SERVER_JS: ".gs", HTML: ".html", JSON: ".json" };

function typeOf(file) {
  if (file.endsWith(".json")) return "JSON";
  if (file.endsWith(".html")) return "HTML";
  return "SERVER_JS";
}

const scriptCmds = {
  async info([id]) {
    const j = await api(`${SCRIPT}/${id}`);
    console.log(`${j.title}\nscriptId ${j.scriptId}\nparentId ${j.parentId || "(keiner, eigenstaendig)"}\ngeaendert ${j.updateTime}`);
  },
  async pull([id, dir = "apps-script"]) {
    const j = await api(`${SCRIPT}/${id}/content`);
    const out = resolve(ROOT, dir);
    mkdirSync(out, { recursive: true });
    j.files.forEach((f) => {
      const name = f.name + (EXT[f.type] || ".gs");
      writeFileSync(join(out, name), f.source, "utf8");
      console.log(`  ${dir}/${name}`);
    });
  },
  async push([id, dir = "apps-script"]) {
    const out = resolve(ROOT, dir);
    const files = readdirSync(out)
      .filter((f) => /\.(gs|js|html|json)$/.test(f))
      .map((f) => ({
        name: f.replace(/\.(gs|js|html|json)$/, ""),
        type: typeOf(f),
        source: readFileSync(join(out, f), "utf8"),
      }));
    if (!files.some((f) => f.name === "appsscript")) {
      throw new Error("appsscript.json fehlt im Verzeichnis. Erst script:pull laufen lassen.");
    }
    // updateContent ersetzt den kompletten Projektinhalt, nicht einzelne Dateien.
    await api(`${SCRIPT}/${id}/content`, { method: "PUT", body: { files } });
    console.log(`${files.length} Dateien hochgeladen. Das ist der HEAD-Stand, noch nicht bereitgestellt.`);
  },
  async versions([id]) {
    const j = await api(`${SCRIPT}/${id}/versions?pageSize=20`);
    (j.versions || []).forEach((v) => console.log(`  v${v.versionNumber}\t${v.createTime}\t${v.description || ""}`));
  },
  async deployments([id]) {
    const j = await api(`${SCRIPT}/${id}/deployments`);
    (j.deployments || []).forEach((d) => {
      const c = d.deploymentConfig || {};
      const web = (d.entryPoints || []).find((e) => e.entryPointType === "WEB_APP");
      console.log(`  ${d.deploymentId}\tv${c.versionNumber ?? "HEAD"}\t${c.description || ""}`);
      if (web) console.log(`    ${web.webApp.url}`);
    });
  },
  async deploy([id, deploymentId, description = `Deploy ${new Date().toISOString()}`]) {
    if (!deploymentId) throw new Error("deploymentId fehlt. Erst script:deployments aufrufen.");
    const v = await api(`${SCRIPT}/${id}/versions`, { method: "POST", body: { description } });
    console.log(`Version v${v.versionNumber} angelegt.`);
    const d = await api(`${SCRIPT}/${id}/deployments/${deploymentId}`, {
      method: "PUT",
      body: {
        deploymentConfig: {
          scriptId: id,
          versionNumber: v.versionNumber,
          manifestFileName: "appsscript",
          description,
        },
      },
    });
    const web = (d.entryPoints || []).find((e) => e.entryPointType === "WEB_APP");
    console.log(`Bereitstellung ${deploymentId} zeigt jetzt auf v${v.versionNumber}.`);
    if (web) console.log(web.webApp.url);
  },
};

/* ---------- Dispatch ---------- */

const [cmd, ...args] = process.argv.slice(2);
const [group, sub] = String(cmd || "").split(":");
const table = { sheets: sheetsCmds, script: scriptCmds };

async function cmdWhoami() {
  const c = credentials();
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + (await accessToken()));
  const j = await res.json();
  console.log(`Quelle    ${c.source}`);
  console.log(`Konto     ${j.email || "(keine E-Mail im Token)"}`);
  console.log("Scopes");
  String(j.scope || "").split(" ").filter(Boolean).forEach((s) => console.log("  " + s));
  const missing = SCOPES.filter((s) => !String(j.scope || "").includes(s));
  if (missing.length) console.log("\nFehlt:\n" + missing.map((s) => "  " + s).join("\n"));
}

try {
  if (cmd === "auth") await cmdAuth();
  else if (cmd === "whoami") await cmdWhoami();
  else if (table[group] && table[group][sub]) await table[group][sub](args);
  else {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#![^\n]*\n\/\*\*\n/, "").replace(/^ \* ?/gm, ""));
    process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(String(err.message || err));
  process.exit(1);
}
