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

async function searchAdvertiserAds({ website, instagram, country = "AR" }) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, reason: "NO_TOKEN" };
  }

  const searchTerm = deriveSearchTerm({ website, instagram });
  if (!searchTerm) {
    return { ok: false, reason: "NO_SEARCH_TERM" };
  }

  const params = new URLSearchParams({
    search_terms: searchTerm,
    ad_type: "ALL",
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: "ACTIVE",
    limit: "100",
    fields: FIELDS,
    access_token: token,
  });

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/ads_archive?${params.toString()}`;

  try {
    const res = await fetch(url, { timeout: 15000 });
    const json = await res.json();

    if (!res.ok || json.error) {
      return { ok: false, reason: "API_ERROR", detail: json.error || json, searchTerm };
    }

    const ads = json.data || [];
    if (ads.length === 0) {
      return { ok: false, reason: "NO_ADS_FOUND", searchTerm };
    }

    return { ok: true, ads, searchTerm, raw: json };
  } catch (err) {
    return { ok: false, reason: "FETCH_FAILED", detail: err.message, searchTerm };
  }
}

module.exports = { searchAdvertiserAds, deriveSearchTerm };
