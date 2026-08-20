const fetch = require("node-fetch");

const CTA_WORDS = ["comprar", "agregar al carrito", "sumar al carrito", "ver más", "shop now", "add to cart"];
const TRUST_WORDS = ["envío gratis", "envio gratis", "cambios y devoluciones", "compra protegida", "garantía", "garantia", "pago seguro"];

async function analyzeWebsite(rawUrl) {
  const website = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const started = Date.now();
  try {
    const res = await fetch(website, { timeout: 12000, redirect: "follow" });
    const loadMs = Date.now() - started;
    const html = await res.text();
    const lower = html.toLowerCase();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);

    const hasHttps = website.startsWith("https://");
    const hasCTA = CTA_WORDS.some((w) => lower.includes(w));
    const hasTrustSignals = TRUST_WORDS.some((w) => lower.includes(w));
    const hasPrice = /\$\s?\d/.test(html);
    const title = titleMatch ? titleMatch[1].trim() : null;
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

    return {
      ok: true,
      website,
      loadMs,
      hasHttps,
      hasCTA,
      hasTrustSignals,
      hasPrice,
      title,
      metaDescription,
      textSample: html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 4000),
    };
  } catch (err) {
    return { ok: false, website, error: err.message };
  }
}

module.exports = { analyzeWebsite };
