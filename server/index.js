require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { searchAdvertiserAds, findCandidatePages, deriveSearchTerm } = require("./metaAdLibrary");
const { analyzeWebsite } = require("./siteAnalyzer");
const { buildReport } = require("./scoring");
const { buildDemoAds } = require("./demoData");
const { saveLead, readLeads, leadsToCsv } = require("./leads");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Paso 1: busca páginas candidatas en la Ad Library para que el usuario confirme
// cuál es la suya antes de generar el reporte (evita falsos matches por nombre).
app.post("/api/candidates", async (req, res) => {
  try {
    const { website, instagram, searchTerm } = req.body || {};
    if (!website && !instagram && !searchTerm) {
      return res.status(400).json({ error: "Falta website, instagram o searchTerm." });
    }

    const result = await findCandidatePages({ website, instagram, searchTerm });

    if (!result.ok) {
      return res.json({ ok: false, reason: result.reason, searchTerm: result.searchTerm });
    }

    res.json({ ok: true, candidates: result.candidates, searchTerm: result.searchTerm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error buscando páginas.", detail: err.message });
  }
});

// Paso 2: genera el reporte, ya sea con una página confirmada (pageId) o,
// si no hay token/no hay matches, en modo demo.
app.post("/api/analyze", async (req, res) => {
  try {
    const { website, instagram, monthlyBudget, pageId, pageName, email, whatsapp } = req.body || {};

    if (!website && !instagram) {
      return res.status(400).json({ error: "Falta website y/o instagram." });
    }
    if (!email) {
      return res.status(400).json({ error: "Falta email." });
    }

    const [adResult, siteResult] = await Promise.all([
      searchAdvertiserAds({ website, instagram, pageId }),
      website ? analyzeWebsite(website) : Promise.resolve(null),
    ]);

    let mode = "real";
    let ads = [];
    let searchTerm = adResult.searchTerm || deriveSearchTerm({ website, instagram });

    if (adResult.ok) {
      ads = adResult.ads;
      mode = "real";
    } else {
      ads = buildDemoAds();
      mode = "demo";
    }

    const report = buildReport({
      ads,
      site: siteResult,
      website,
      instagram,
      mode,
      searchTerm,
      monthlyBudget: monthlyBudget ? Number(monthlyBudget) : null,
    });

    if (mode === "demo") {
      report.meta.demoReason = adResult.reason;
    }
    if (pageName) {
      report.meta.pageName = pageName;
    }

    // Guardamos el lead siempre que tengamos email, sea reporte real o demo:
    // alguien completó el formulario y eso ya vale como contacto calificado.
    await saveLead({
      email,
      whatsapp: whatsapp || null,
      website,
      instagram,
      pageName: pageName || null,
      score: report.score.overall,
      mode,
      searchTerm,
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno generando el reporte.", detail: err.message });
  }
});

// Panel simple para ver/exportar los leads capturados. Protegido por ADMIN_KEY.
// Ejemplo: /api/leads?key=TU_ADMIN_KEY  o  /api/leads?key=TU_ADMIN_KEY&format=csv
app.get("/api/leads", (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(501).json({ error: "Configurá ADMIN_KEY en el .env para habilitar este endpoint." });
  }
  if (req.query.key !== adminKey) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const leads = readLeads().reverse();

  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    return res.send(leadsToCsv(leads));
  }

  res.json({ count: leads.length, leads });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasToken: Boolean(process.env.META_ACCESS_TOKEN) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Creative Score App corriendo en http://localhost:${PORT}`);
  console.log(`Modo: ${process.env.META_ACCESS_TOKEN ? "REAL (Meta Ad Library)" : "DEMO (sin META_ACCESS_TOKEN)"}`);
});
