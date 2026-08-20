const { ANGLES, ANGLE_KEYS, classifyText } = require("./angles");

const STALE_DAYS_THRESHOLD = 45;
const SLOW_SITE_MS = 2500;

function daysSince(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr).getTime();
  if (Number.isNaN(start)) return null;
  return Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
}

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

// Normaliza anuncios crudos de la Ad Library (o demo) a un shape común.
function normalizeAd(raw) {
  const body =
    (raw.ad_creative_bodies && raw.ad_creative_bodies[0]) ||
    (raw.ad_creative_link_titles && raw.ad_creative_link_titles[0]) ||
    raw.body ||
    "";
  const days = daysSince(raw.ad_delivery_start_time || raw.startedAt);
  const classification = classifyText(
    [body, ...(raw.ad_creative_link_descriptions || [])].join(" ")
  );
  return {
    id: raw.id || `ad-${Math.random().toString(36).slice(2, 8)}`,
    body: body || "(sin texto de copy detectado)",
    daysActive: days,
    angle: classification && classification.score > 0 ? classification.angle : null,
    platforms: raw.publisher_platforms || raw.platforms || [],
  };
}

function buildAngleDistribution(ads) {
  const counts = {};
  ANGLE_KEYS.forEach((k) => (counts[k] = 0));
  let sinAngulo = 0;

  ads.forEach((ad) => {
    if (ad.angle) counts[ad.angle] += 1;
    else sinAngulo += 1;
  });

  const distribucion = ANGLE_KEYS.map((key) => ({
    key,
    label: ANGLES[key].label,
    count: counts[key],
    pct: pct(counts[key], ads.length),
  }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);

  const anglesUsed = distribucion.length;
  const diversidadPct = pct(anglesUsed, ANGLE_KEYS.length);
  const sinAnguloPct = pct(sinAngulo, ads.length);
  const dominante = distribucion[0] || null;
  const concentracionPct = dominante ? dominante.pct : 0;

  return { distribucion, diversidadPct, sinAnguloPct, concentracionPct, dominante, sinAngulo };
}

function buildScore({ ads, angleStats, site, staleRatio }) {
  let score = 100;
  const notes = [];

  // Diversidad de ángulos: penaliza concentración excesiva.
  if (angleStats.concentracionPct >= 70) {
    score -= 20;
    notes.push("Alta concentración en un solo ángulo de venta");
  } else if (angleStats.concentracionPct >= 50) {
    score -= 10;
  }

  // Ángulo difuso / sin mensaje claro.
  if (angleStats.sinAnguloPct >= 40) {
    score -= 15;
    notes.push("Buena parte de los anuncios no tiene un ángulo de venta reconocible");
  } else if (angleStats.sinAnguloPct >= 20) {
    score -= 7;
  }

  // Fatiga creativa.
  if (staleRatio >= 0.5) {
    score -= 20;
    notes.push("Más de la mitad de los anuncios activos están fatigados");
  } else if (staleRatio >= 0.25) {
    score -= 10;
  }

  // Volumen de anuncios activos (muy pocos = poco testing).
  if (ads.length <= 2) {
    score -= 15;
    notes.push("Muy pocos anuncios activos: no hay testing real");
  } else if (ads.length <= 4) {
    score -= 7;
  }

  // Señales del sitio.
  if (site && site.ok) {
    if (!site.hasHttps) {
      score -= 10;
      notes.push("El sitio no corre en HTTPS");
    }
    if (!site.hasCTA) {
      score -= 8;
      notes.push("No se detectan llamados a la acción claros en el sitio");
    }
    if (!site.hasTrustSignals) {
      score -= 5;
    }
    if (site.loadMs > SLOW_SITE_MS) {
      score -= 10;
      notes.push("El sitio carga lento");
    }
  }

  score = Math.max(5, Math.min(100, Math.round(score)));
  return { score, notes };
}

function buildGastoFactors({ angleStats, staleRatio, ads, site, monthlyBudget }) {
  const factors = [];

  const staleShare = Math.round(staleRatio * 100);
  factors.push({
    titulo: "Fatiga creativa",
    severidad: staleRatio >= 0.5 ? "alta" : staleRatio >= 0.25 ? "media" : "baja",
    descripcion: `${staleShare}% de tus anuncios activos llevan más de ${STALE_DAYS_THRESHOLD} días corriendo sin refresh de creativo.`,
    impacto: monthlyBudget
      ? `Estimado: ~$${Math.round((monthlyBudget * staleRatio * 0.3)).toLocaleString(
          "es-AR"
        )} /mes en pauta rindiendo por debajo de su potencial (estimación).`
      : "Los anuncios fatigados suelen perder eficiencia de forma progresiva (CTR y CPA se deterioran).",
  });

  factors.push({
    titulo: "Concentración de ángulo",
    severidad:
      angleStats.concentracionPct >= 70 ? "alta" : angleStats.concentracionPct >= 50 ? "media" : "baja",
    descripcion: angleStats.dominante
      ? `${angleStats.dominante.pct}% de tus anuncios usan el mismo ángulo ("${angleStats.dominante.label}"). El resto del mercado que no responde a ese gatillo no tiene por qué convertirte.`
      : "No se pudo determinar un ángulo dominante claro.",
    impacto: "Menor cobertura de audiencia fría: le estás hablando siempre al mismo tipo de comprador.",
  });

  factors.push({
    titulo: "Mensaje difuso",
    severidad: angleStats.sinAnguloPct >= 40 ? "alta" : angleStats.sinAnguloPct >= 20 ? "media" : "baja",
    descripcion: `${angleStats.sinAnguloPct}% de tus anuncios activos no tienen un gancho de venta identificable en el copy.`,
    impacto: "Sin un ángulo claro, el algoritmo tarda más en encontrar a quién mostrárselo — pagás ese aprendizaje extra.",
  });

  const siteIssues = [];
  if (site && site.ok) {
    if (!site.hasCTA) siteIssues.push("sin CTA claro");
    if (!site.hasTrustSignals) siteIssues.push("sin señales de confianza (envío, cambios, garantía)");
    if (site.loadMs > SLOW_SITE_MS) siteIssues.push(`carga en ${(site.loadMs / 1000).toFixed(1)}s`);
    if (!site.hasHttps) siteIssues.push("sin HTTPS");
  }
  factors.push({
    titulo: "Fricción en el sitio de destino",
    severidad: siteIssues.length >= 2 ? "alta" : siteIssues.length === 1 ? "media" : "baja",
    descripcion:
      siteIssues.length > 0
        ? `Tu landing tiene fricción: ${siteIssues.join(", ")}.`
        : "El sitio no muestra fricciones evidentes a nivel técnico.",
    impacto: "Estás pagando por el clic; si la landing no cierra, ese clic se pierde igual.",
  });

  const order = { alta: 0, media: 1, baja: 2 };
  return factors.sort((a, b) => order[a.severidad] - order[b.severidad]);
}

function buildProblemas({ gastoFactors, ads }) {
  const problemas = gastoFactors.map((f) => ({
    titulo: f.titulo,
    severidad: f.severidad,
    descripcion: f.descripcion,
    impacto: f.impacto,
  }));

  if (ads.length > 0) {
    const sinTexto = ads.filter((a) => a.body === "(sin texto de copy detectado)").length;
    if (sinTexto > 0) {
      problemas.push({
        titulo: "Anuncios sin copy legible",
        severidad: "media",
        descripcion: `${sinTexto} anuncio(s) activos no tienen texto de copy indexado en la biblioteca.`,
        impacto: "Puede ser solo un anuncio de imagen/video puro — igual conviene revisar que el mensaje esté en el creativo.",
      });
    }
  }

  return problemas;
}

function buildPlanDeAccion({ angleStats, staleRatio, site }) {
  const plan = [];

  if (angleStats.concentracionPct >= 50) {
    plan.push({
      paso: "Diversificar ángulos",
      detalle: `Lanzar 2-3 creativos nuevos que ataquen ángulos distintos a "${angleStats.dominante ? angleStats.dominante.label : "el dominante"}" (probar prueba social o urgencia si no los estás usando).`,
    });
  }
  if (staleRatio >= 0.25) {
    plan.push({
      paso: "Refrescar creativos fatigados",
      detalle: `Pausar o reemplazar los anuncios con más de ${STALE_DAYS_THRESHOLD} días activos por variantes nuevas del mismo ángulo ganador.`,
    });
  }
  if (site && site.ok && !site.hasCTA) {
    plan.push({
      paso: "Reforzar CTA en la landing",
      detalle: "Agregar un llamado a la acción visible arriba del pliegue (comprar / agregar al carrito) en la página de destino.",
    });
  }
  if (site && site.ok && site.loadMs > SLOW_SITE_MS) {
    plan.push({
      paso: "Optimizar velocidad de carga",
      detalle: "Comprimir imágenes y revisar apps/plugins de la tienda que estén frenando el tiempo de carga.",
    });
  }
  if (plan.length === 0) {
    plan.push({
      paso: "Mantener el testing activo",
      detalle: "La cuenta no muestra banderas rojas graves — el foco pasa a escalar lo que ya funciona con más presupuesto y variantes de formato.",
    });
  }
  return plan;
}

function buildReport({ ads: rawAds, site, website, instagram, mode, searchTerm, monthlyBudget }) {
  const ads = rawAds.map(normalizeAd);
  const staleAds = ads.filter((a) => a.daysActive !== null && a.daysActive > STALE_DAYS_THRESHOLD);
  const staleRatio = ads.length ? staleAds.length / ads.length : 0;

  const angleStats = buildAngleDistribution(ads);
  const { score, notes } = buildScore({ ads, angleStats, site, staleRatio });
  const gastoFactors = buildGastoFactors({ angleStats, staleRatio, ads, site, monthlyBudget });
  const problemas = buildProblemas({ gastoFactors, ads });
  const planDeAccion = buildPlanDeAccion({ angleStats, staleRatio, site });

  const inventario = ads.slice(0, 8).map((ad) => ({
    id: ad.id,
    resumenTexto: ad.body.length > 160 ? ad.body.slice(0, 157) + "..." : ad.body,
    angulo: ad.angle ? ANGLES[ad.angle].label : "Sin ángulo claro",
    diasActivo: ad.daysActive,
    hallazgo:
      ad.daysActive !== null && ad.daysActive > STALE_DAYS_THRESHOLD
        ? "Fatigado — candidato a refresh"
        : ad.angle
        ? "Ángulo identificado con claridad"
        : "Revisar: no se detecta gancho de venta",
  }));

  return {
    meta: {
      website,
      instagram,
      generatedAt: new Date().toISOString(),
      mode, // "real" | "demo"
      searchTerm,
    },
    score: {
      overall: score,
      label: score >= 75 ? "Sólido" : score >= 50 ? "Con oportunidades claras" : "Urgente atención",
      notes,
    },
    diagnostico: {
      totalAdsActivos: ads.length,
      cuentaEncontrada: ads.length > 0,
    },
    gasto: gastoFactors,
    inventario,
    mapeoAngulos: angleStats,
    problemas,
    planDeAccion,
  };
}

module.exports = { buildReport, normalizeAd, STALE_DAYS_THRESHOLD };
