const fetch = require("node-fetch");

const GRAPH_VERSION = "v20.0";
const FIELDS = [
  "id",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "page_name",
  "page_id",
  "publisher_platforms",
].join(",");

// Deriva un término de búsqueda "humano" a partir del handle de Instagram o el dominio.
function deriveSearchTerm({ website, instagram }) {
  if (instagram) {
    const handle = instagram
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/$/, "")
      .replace(/^@/, "")
      .split("?")[0];
    return handle.replace(/[._]/g, " ").trim();
  }
  if (website) {
    try {
      const url = new URL(website.startsWith("http") ? website : `https://${website}`);
      return url.hostname.replace(/^www\./, "").split(".")[0];
    } catch (e) {
      return website;
    }
  }
  return null;
}

async function rawSearch({ searchTerm, pageId, country = "AR" }) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "NO_TOKEN" };
  if (!searchTerm && !pageId) return { ok: false, reason: "NO_SEARCH_TERM" };

  const params = new URLSearchParams({
    ad_type: "ALL",
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: "ACTIVE",
    limit: "100",
    fields: FIELDS,
    access_token: token,
  });

  if (pageId) {
    params.set("search_page_ids", JSON.stringify([String(pageId)]));
  } else {
    params.set("search_terms", searchTerm);
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/ads_archive?${params.toString()}`;

  try {
    const res = await fetch(url, { timeout: 15000 });
    const json = await res.json();

    if (!res.ok || json.error) {
      return { ok: false, reason: "API_ERROR", detail: json.error || json };
    }
    const ads = json.data || [];
    if (ads.length === 0) return { ok: false, reason: "NO_ADS_FOUND" };
    return { ok: true, ads, raw: json };
  } catch (err) {
    return { ok: false, reason: "FETCH_FAILED", detail: err.message };
  }
}

// Busca por término libre y agrupa los resultados por página, para que el usuario
// pueda confirmar cuál es "la suya" cuando hay más de un match.
async function findCandidatePages({ website, instagram, searchTerm: manualTerm, country = "AR" }) {
  const searchTerm = manualTerm || deriveSearchTerm({ website, instagram });
  const result = await rawSearch({ searchTerm, country });

  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.detail, searchTerm };
  }

  const byPage = new Map();
  for (const ad of result.ads) {
    if (!ad.page_id) continue;
    const key = ad.page_id;
    if (!byPage.has(key)) {
      byPage.set(key, { pageId: ad.page_id, pageName: ad.page_name || "(sin nombre)", adCount: 0 });
    }
    byPage.get(key).adCount += 1;
  }

  const candidates = Array.from(byPage.values()).sort((a, b) => b.adCount - a.adCount);
  return { ok: true, candidates, searchTerm };
}

// Búsqueda final ya con la página confirmada (o, en su defecto, por término libre).
async function searchAdvertiserAds({ website, instagram, pageId, country = "AR" }) {
  const searchTerm = deriveSearchTerm({ website, instagram });
  const result = pageId
    ? await rawSearch({ pageId, country })
    : await rawSearch({ searchTerm, country });

  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.detail, searchTerm };
  }
  return { ok: true, ads: result.ads, searchTerm };
}

module.exports = { searchAdvertiserAds, findCandidatePages, deriveSearchTerm };
