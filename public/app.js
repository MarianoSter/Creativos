// ---- Configuración editable ----
const CONFIG = {
  CALENDLY_URL: "https://calendly.com/tu-usuario/20min", // reemplazar por tu link real de agenda
  BRAND_NAME: "TU MARCA", // reemplazar en index.html también
};

const LOADING_STEPS_SEARCH = [
  "Buscando tu página en Meta...",
  "Revisando anuncios activos...",
];
const LOADING_STEPS_REPORT = [
  "Leyendo tu sitio web...",
  "Clasificando ángulos de venta...",
  "Calculando fatiga creativa...",
  "Armando tu reporte...",
];

const views = {
  form: document.getElementById("view-form"),
  loading: document.getElementById("view-loading"),
  candidates: document.getElementById("view-candidates"),
  nomatch: document.getElementById("view-nomatch"),
  report: document.getElementById("view-report"),
};

const form = document.getElementById("analyze-form");
const submitBtn = document.getElementById("submit-btn");
const errorBox = document.getElementById("error-box");
const loadingStatus = document.getElementById("loading-status");
const candidatesList = document.getElementById("candidates-list");
const candidatesBack = document.getElementById("candidates-back");
const manualForm = document.getElementById("manual-form");
const nomatchText = document.getElementById("nomatch-text");
const nomatchDemo = document.getElementById("nomatch-demo");

let loadingInterval = null;
let leadState = {}; // datos del formulario, persisten entre pasos

function startLoadingAnimation(steps) {
  let i = 0;
  loadingStatus.textContent = steps[0];
  loadingInterval = setInterval(() => {
    i = (i + 1) % steps.length;
    loadingStatus.textContent = steps[i];
  }, 1400);
}
function stopLoadingAnimation() {
  clearInterval(loadingInterval);
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    const visible = key === name;
    if (key === "report") {
      el.classList.toggle("visible", visible);
      el.style.display = visible ? "block" : "none";
    } else {
      el.style.display = visible ? "block" : "none";
    }
  });
}

function showError(msg) {
  showView("form");
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

// ---------- Paso 1: form ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  submitBtn.disabled = true;

  leadState = {
    website: document.getElementById("website").value.trim(),
    instagram: document.getElementById("instagram").value.trim(),
    email: document.getElementById("email").value.trim(),
    whatsapp: document.getElementById("whatsapp").value.trim() || null,
    monthlyBudget: parseBudget(document.getElementById("monthlyBudget").value),
  };

  showView("loading");
  startLoadingAnimation(LOADING_STEPS_SEARCH);

  try {
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website: leadState.website, instagram: leadState.instagram }),
    });
    const data = await res.json();
    stopLoadingAnimation();
    handleCandidatesResponse(data);
  } catch (err) {
    stopLoadingAnimation();
    showError("Ocurrió un error buscando tu página. Probá de nuevo.");
  } finally {
    submitBtn.disabled = false;
  }
});

function parseBudget(raw) {
  const clean = raw.trim();
  if (!clean) return null;
  const n = Number(clean.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function handleCandidatesResponse(data) {
  if (data.ok && data.candidates && data.candidates.length > 1) {
    renderCandidates(data.candidates);
    showView("candidates");
    return;
  }
  if (data.ok && data.candidates && data.candidates.length === 1) {
    const c = data.candidates[0];
    runAnalysis({ pageId: c.pageId, pageName: c.pageName });
    return;
  }
  // Sin token configurado: no es un problema del usuario, vamos directo (modo demo).
  if (!data.ok && data.reason === "NO_TOKEN") {
    runAnalysis({});
    return;
  }
  // No hay anuncios / falló la búsqueda: dejamos elegir manualmente o ver demo.
  nomatchText.textContent = data.searchTerm
    ? `No encontramos anuncios activos en la Meta Ad Library para "${data.searchTerm}".`
    : "No encontramos anuncios activos en la Meta Ad Library para esta búsqueda.";
  showView("nomatch");
}

function renderCandidates(candidates) {
  candidatesList.innerHTML = candidates
    .map(
      (c, idx) => `
      <div class="candidate-card" data-idx="${idx}">
        <div>
          <div class="name">${escapeHtml(c.pageName)}</div>
          <div class="count">${c.adCount} anuncio(s) activo(s) encontrados</div>
        </div>
        <div class="pick">Es esta →</div>
      </div>
    `
    )
    .join("");

  candidatesList.querySelectorAll(".candidate-card").forEach((el) => {
    el.addEventListener("click", () => {
      const c = candidates[Number(el.dataset.idx)];
      runAnalysis({ pageId: c.pageId, pageName: c.pageName });
    });
  });
}

candidatesBack.addEventListener("click", () => showView("form"));

// ---------- Paso "no match" ----------
manualForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const term = document.getElementById("manualPageName").value.trim();
  if (!term) return;

  showView("loading");
  startLoadingAnimation(LOADING_STEPS_SEARCH);
  try {
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTerm: term }),
    });
    const data = await res.json();
    stopLoadingAnimation();
    handleCandidatesResponse(data);
  } catch (err) {
    stopLoadingAnimation();
    showError("Ocurrió un error buscando tu página. Probá de nuevo.");
  }
});

nomatchDemo.addEventListener("click", () => runAnalysis({}));

// ---------- Paso 2: analizar y renderizar reporte ----------
async function runAnalysis({ pageId, pageName }) {
  showView("loading");
  startLoadingAnimation(LOADING_STEPS_REPORT);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...leadState, pageId, pageName }),
    });
    const data = await res.json();
    stopLoadingAnimation();

    if (!res.ok) {
      throw new Error(data.error || "No pudimos generar el reporte.");
    }

    renderReport(data);
    showView("report");
  } catch (err) {
    stopLoadingAnimation();
    showError(err.message || "Ocurrió un error. Probá de nuevo.");
  }
}

function sevLabel(sev) {
  return { alta: "Alta", media: "Media", baja: "Baja" }[sev] || sev;
}

function renderReport(data) {
  const { meta, score, diagnostico, gasto, inventario, mapeoAngulos, problemas, planDeAccion } = data;

  const demoBanner =
    meta.mode === "demo"
      ? `<div class="demo-banner"><strong>Reporte de ejemplo.</strong> No encontramos anuncios activos en la Meta Ad Library para "${escapeHtml(
          meta.searchTerm || ""
        )}" (o falta configurar el acceso a la API). Este reporte usa datos de muestra para que veas el formato completo.</div>`
      : "";

  const scoreHtml = `
    <div class="score-block">
      <div class="score-eyebrow">Score de Creativos</div>
      <div class="score-number">${score.overall}<span>/100</span></div>
      <div class="score-label">${escapeHtml(score.label)}</div>
      <div class="score-meta">${escapeHtml(meta.pageName || meta.website || "")} ${meta.instagram ? "· " + escapeHtml(meta.instagram) : ""}</div>
    </div>
  `;

  const diagHtml = `
    <section class="block">
      <div class="block-title">01 — Diagnóstico</div>
      <h2 class="block-heading">Lo que encontramos</h2>
      <div class="diag-grid">
        <div class="diag-cell">
          <div class="n">${diagnostico.totalAdsActivos}</div>
          <div class="l">Anuncios activos detectados</div>
        </div>
        <div class="diag-cell">
          <div class="n">${diagnostico.cuentaEncontrada ? "Sí" : "No"}</div>
          <div class="l">Cuenta encontrada en Meta Ad Library</div>
        </div>
      </div>
    </section>
  `;

  const gastoHtml = `
    <section class="block">
      <div class="block-title">02 — Dónde se te va la plata</div>
      <h2 class="block-heading">4 factores que están frenando tu cuenta</h2>
      ${gasto
        .map(
          (f) => `
        <div class="card sev-${f.severidad}">
          <div class="card-top">
            <h4>${escapeHtml(f.titulo)}</h4>
            <span class="sev-tag sev-${f.severidad}">${sevLabel(f.severidad)}</span>
          </div>
          <p>${escapeHtml(f.descripcion)}</p>
          <p class="impacto">${escapeHtml(f.impacto)}</p>
        </div>
      `
        )
        .join("")}
    </section>
  `;

  const inventarioHtml = `
    <section class="block">
      <div class="block-title">03 — Inventario de anuncios</div>
      <h2 class="block-heading">Tus anuncios activos</h2>
      <div>
        ${inventario
          .map(
            (ad) => `
          <div class="ad-item">
            <div>
              <div class="ad-text">${escapeHtml(ad.resumenTexto)}</div>
              <div class="ad-meta">${escapeHtml(ad.angulo)} ${ad.diasActivo !== null ? "· " + ad.diasActivo + " días activo" : ""} · ${escapeHtml(ad.hallazgo)}</div>
            </div>
            <div class="ad-tag">${escapeHtml(ad.angulo)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </section>
  `;

  const maxCount = mapeoAngulos.distribucion.length
    ? Math.max(...mapeoAngulos.distribucion.map((a) => a.pct))
    : 1;

  const mapeoHtml = `
    <section class="block">
      <div class="block-title">04 — Mapeo de ángulos</div>
      <h2 class="block-heading">Cómo se reparte tu mensaje</h2>
      ${mapeoAngulos.distribucion
        .map(
          (a, idx) => `
        <div class="angle-row">
          <div class="angle-top"><span>${escapeHtml(a.label)}</span><span>${a.pct}%</span></div>
          <div class="angle-bar-bg"><div class="angle-bar-fill ${idx === 0 ? "dominant" : ""}" style="width:${(a.pct / maxCount) * 100}%"></div></div>
        </div>
      `
        )
        .join("")}
      <div class="diversity-line">
        <div class="metric"><div class="n">${mapeoAngulos.diversidadPct}%</div><div class="l">Diversidad de ángulos</div></div>
        <div class="metric"><div class="n">${mapeoAngulos.concentracionPct}%</div><div class="l">Concentración en el ángulo top</div></div>
        <div class="metric"><div class="n">${mapeoAngulos.sinAnguloPct}%</div><div class="l">Sin ángulo identificable</div></div>
      </div>
    </section>
  `;

  const problemasHtml = `
    <section class="block">
      <div class="block-title">05 — Problemas priorizados</div>
      <h2 class="block-heading">Por orden de impacto</h2>
      ${problemas
        .map(
          (p) => `
        <div class="card sev-${p.severidad}">
          <div class="card-top">
            <h4>${escapeHtml(p.titulo)}</h4>
            <span class="sev-tag sev-${p.severidad}">${sevLabel(p.severidad)}</span>
          </div>
          <p>${escapeHtml(p.descripcion)}</p>
        </div>
      `
        )
        .join("")}
    </section>
  `;

  const planHtml = `
    <section class="block">
      <div class="block-title">06 — Plan de acción</div>
      <h2 class="block-heading">Qué hacer esta semana</h2>
      ${planDeAccion
        .map(
          (p, idx) => `
        <div class="plan-item">
          <div class="plan-index">${String(idx + 1).padStart(2, "0")}</div>
          <div class="plan-body">
            <h4>${escapeHtml(p.paso)}</h4>
            <p>${escapeHtml(p.detalle)}</p>
          </div>
        </div>
      `
        )
        .join("")}
    </section>
  `;

  const ctaHtml = `
    <section class="block">
      <div class="cta-block">
        <h3>¿Lo revisamos juntos?</h3>
        <p>Agendá 20 minutos y repasamos tu cuenta en vivo: qué frenar, qué escalar y qué probar primero.</p>
        <a class="btn-cta" href="${CONFIG.CALENDLY_URL}" target="_blank" rel="noopener">Agendar llamada</a>
      </div>
    </section>
  `;

  const restartHtml = `<div class="restart-link" id="restart-link">← Analizar otra cuenta</div>`;

  views.report.innerHTML =
    demoBanner + scoreHtml + diagHtml + gastoHtml + inventarioHtml + mapeoHtml + problemasHtml + planHtml + ctaHtml + restartHtml;

  document.getElementById("restart-link").addEventListener("click", () => {
    showView("form");
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
