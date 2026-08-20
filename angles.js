// Clasificador de ángulos de venta por keywords (heurístico, sin dependencias externas).
// Cada ángulo tiene un set de términos gatillo en español (+ alguna variante en inglés).

const ANGLES = {
  precio_oferta: {
    label: "Precio / Oferta",
    keywords: [
      "off", "descuento", "%", "oferta", "promo", "2x1", "3x2", "rebaja",
      "cuotas", "sin interes", "sin interés", "envio gratis", "envío gratis",
      "hot sale", "black friday", "liquidacion", "liquidación", "outlet",
    ],
  },
  urgencia_escasez: {
    label: "Urgencia / Escasez",
    keywords: [
      "ultimas unidades", "últimas unidades", "quedan pocas", "por tiempo limitado",
      "solo hoy", "solo por hoy", "termina hoy", "se agota", "stock limitado",
      "ultimo dia", "último día", "ya casi no queda", "apurate", "apúrate",
    ],
  },
  prueba_social: {
    label: "Prueba social",
    keywords: [
      "clientes", "reseñas", "reseñas", "opiniones", "testimonio", "miles de",
      "el mas vendido", "el más vendido", "favorito", "recomendado", "5 estrellas",
      "sold out", "agotado por demanda",
    ],
  },
  beneficio_producto: {
    label: "Beneficio / Dolor resuelto",
    keywords: [
      "resolvé", "resolve", "solucion", "solución", "mejora", "sin esfuerzo",
      "comodo", "cómodo", "calidad", "durabilidad", "diseñado para", "ideal para",
      "problema", "cansado de",
    ],
  },
  autoridad_expertise: {
    label: "Autoridad / Expertise",
    keywords: [
      "expertos", "especialistas", "certificado", "garantia", "garantía",
      "premium", "artesanal", "fabricado", "materiales", "años de experiencia",
    ],
  },
  novedad_lanzamiento: {
    label: "Novedad / Lanzamiento",
    keywords: [
      "nuevo", "nueva colección", "nueva coleccion", "lanzamiento", "recién llegado",
      "recien llegado", "ya disponible", "preventa", "edicion limitada", "edición limitada",
    ],
  },
  envio_logistica: {
    label: "Envío / Logística",
    keywords: [
      "envio a todo el pais", "envío a todo el país", "entrega", "24hs", "48hs",
      "retiro en local", "cambios y devoluciones", "envio gratis", "envío gratis",
    ],
  },
};

const ANGLE_KEYS = Object.keys(ANGLES);

function classifyText(text) {
  if (!text) return null;
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip accents for matching robustness

  let bestAngle = null;
  let bestScore = 0;
  const scores = {};

  for (const key of ANGLE_KEYS) {
    const { keywords } = ANGLES[key];
    let score = 0;
    for (const kw of keywords) {
      const kwNorm = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      if (normalized.includes(kwNorm)) score += 1;
    }
    scores[key] = score;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = key;
    }
  }

  return { angle: bestAngle, score: bestScore, scores };
}

module.exports = { ANGLES, ANGLE_KEYS, classifyText };
