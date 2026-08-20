// Dataset de ejemplo, usado cuando no hay META_ACCESS_TOKEN configurado
// o cuando la Ad Library no devuelve anuncios activos para la búsqueda.
// Sirve para poder mostrar el reporte completo en modo demo.

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function buildDemoAds() {
  return [
    {
      id: "demo-1",
      ad_creative_bodies: ["20% OFF en toda la colección nueva. Envío gratis a todo el país."],
      ad_delivery_start_time: daysAgoISO(5),
      publisher_platforms: ["instagram", "facebook"],
    },
    {
      id: "demo-2",
      ad_creative_bodies: ["Últimas unidades de nuestra remera más vendida. Se agota rápido."],
      ad_delivery_start_time: daysAgoISO(12),
      publisher_platforms: ["instagram"],
    },
    {
      id: "demo-3",
      ad_creative_bodies: ["Miles de clientes ya la eligieron. Mirá las reseñas 5 estrellas."],
      ad_delivery_start_time: daysAgoISO(61),
      publisher_platforms: ["facebook", "instagram"],
    },
    {
      id: "demo-4",
      ad_creative_bodies: ["20% OFF esta semana. Aprovechá antes de que termine la promo."],
      ad_delivery_start_time: daysAgoISO(70),
      publisher_platforms: ["instagram"],
    },
    {
      id: "demo-5",
      ad_creative_bodies: ["Nueva colección ya disponible. Edición limitada."],
      ad_delivery_start_time: daysAgoISO(3),
      publisher_platforms: ["instagram", "facebook"],
    },
    {
      id: "demo-6",
      ad_creative_bodies: ["2x1 en toda la tienda solo por hoy."],
      ad_delivery_start_time: daysAgoISO(48),
      publisher_platforms: ["facebook"],
    },
    {
      id: "demo-7",
      ad_creative_bodies: [""],
      ad_delivery_start_time: daysAgoISO(20),
      publisher_platforms: ["instagram"],
    },
  ];
}

module.exports = { buildDemoAds };
