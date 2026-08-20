require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { searchAdvertiserAds, deriveSearchTerm } = require("./metaAdLibrary");
const { analyzeWebsite } = require("./siteAnalyzer");
const { buildReport } = require("./scoring");
const { buildDemoAds } = require("./demoData");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.post("/api/analyze", async (req, res) => {
  try {
    const { website, instagram, monthlyBudget } = req.body || {};

    if (!website && !instagram) {
      return res.status(400).json({ error: "Falta website y/o instagram." });
    }

    const [adResult, siteResult] = await Promise.all([
      searchAdvertiserAds({ website, instagram }),
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

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno generando el reporte.", detail: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasToken: Boolean(process.env.META_ACCESS_TOKEN) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Creative Score App corriendo en http://localhost:${PORT}`);
  console.log(`Modo: ${process.env.META_ACCESS_TOKEN ? "REAL (Meta Ad Library)" : "DEMO (sin META_ACCESS_TOKEN)"}`);
});
