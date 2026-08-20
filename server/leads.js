const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const DATA_DIR = path.join(__dirname, "..", "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Guarda el lead en un archivo local (append-only) y, si hay un webhook configurado,
// lo reenvía ahí también (Zapier / Make / Slack / Google Sheets, etc).
// El webhook es la forma recomendada de tener los leads a salvo si el hosting
// no persiste el disco entre deploys (ej. Render free tier).
async function saveLead(lead) {
  ensureDataDir();
  const record = { ...lead, savedAt: new Date().toISOString() };

  try {
    fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + "\n");
  } catch (err) {
    console.error("No se pudo guardar el lead en disco:", err.message);
  }

  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      timeout: 8000,
    }).catch((err) => console.error("No se pudo enviar el lead al webhook:", err.message));
  }

  return record;
}

function readLeads() {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) return [];
  const lines = fs.readFileSync(LEADS_FILE, "utf-8").split("\n").filter(Boolean);
  return lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

function leadsToCsv(leads) {
  const cols = ["savedAt", "email", "whatsapp", "website", "instagram", "pageName", "score", "mode"];
  const rows = [cols.join(",")];
  for (const l of leads) {
    rows.push(
      cols
        .map((c) => {
          const v = l[c] === undefined || l[c] === null ? "" : String(l[c]);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  }
  return rows.join("\n");
}

module.exports = { saveLead, readLeads, leadsToCsv };
