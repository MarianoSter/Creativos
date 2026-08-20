# Score de Creativos

Lead magnet: el visitante carga su web y su Instagram, la app busca sus anuncios activos en la **Meta Ad Library** (biblioteca pública de anuncios de Meta), analiza ángulos de venta, fatiga creativa y fricción en el sitio, y devuelve un reporte con score, hallazgos priorizados y un CTA para agendar una llamada.

Estética: negro / blanco / gris / naranja de acento, minimalista, editorial.

---

## 1. Correr en local

```bash
npm install
cp .env.example .env
npm start
```

Abrí `http://localhost:3000`.

**Sin token configurado, la app arranca en MODO DEMO**: cualquier búsqueda devuelve un reporte de ejemplo (con el banner "Reporte de ejemplo" visible) para que veas el formato completo funcionando ya mismo.

---

## 2. Activar datos reales de Meta Ad Library (importante leer esto)

### Cómo conseguir el token (gratis, ~5 min)

1. Entrá a [developers.facebook.com](https://developers.facebook.com/) y creá una app tipo "Business" (o usá una que ya tengas).
2. En el buscador de herramientas de la app, andá a **Graph API Explorer**.
3. Generá un **User Access Token** (no hace falta pasar App Review para leer la Ad Library de anuncios comerciales — eso solo lo pide Meta para anuncios políticos/de temas sociales).
4. Copiá el token y pegalo en tu `.env`:
   ```
   META_ACCESS_TOKEN=EAAG...
   ```
5. Reiniciá el server. La consola te va a confirmar `Modo: REAL (Meta Ad Library)`.

Los tokens de usuario duran poco (horas/días). Para producción real conviene generar un **token de larga duración** o un token de sistema vinculado a la app — Meta lo explica en su documentación de "Access Tokens".

### Lo que la Ad Library SÍ y NO te da (léelo antes de vender esto como "auditoría exacta")

- **SÍ** te da: anuncios activos, texto del copy, plataformas donde corre, fecha de inicio.
- **NO** te da gasto ni impresiones para anuncios comerciales normales (eso solo está disponible para anuncios políticos/de temas sociales, por regulación de Meta).

Por eso el score y "Dónde se te va la plata" están construidos sobre **señales reales pero indirectas**: concentración de ángulo, fatiga creativa (días activos), ausencia de gancho de venta claro, y fricción del sitio de destino (CTA, HTTPS, velocidad, señales de confianza). Cuando el usuario carga un presupuesto mensual aproximado, se muestra un rango en pesos — está etiquetado como "estimación" porque lo es. No lo vendas como cifra exacta de gasto desperdiciado; es una construcción heurística persuasiva, no una auditoría contable. Sé claro con esto frente al prospecto si te preguntan cómo se calcula.

### Precisión de la búsqueda del advertiser

La app busca en la Ad Library usando el nombre derivado del handle de Instagram (o del dominio si no hay IG). Si tu marca tiene un nombre de página distinto al handle, puede no encontrar coincidencias exactas y caer en modo demo. Si ves que pasa seguido, lo más simple es agregar un campo opcional de "nombre de la página de Facebook" y usarlo como `search_terms` en `server/metaAdLibrary.js`.

---

## 3. Personalizar

- **Nombre de marca y colores**: `public/index.html` (texto "TU MARCA") y `public/styles.css` (variables `:root` — ya están en tu paleta: `#000000`, blanco, gris, `#DD5C1B`).
- **Link de agenda**: `public/app.js`, constante `CONFIG.CALENDLY_URL` — poné tu link real de Calendly/Cal.com.
- **País de búsqueda de anuncios**: `server/metaAdLibrary.js`, parámetro `country` (default `"AR"`).
- **Ángulos de venta y sus keywords**: `server/angles.js` — sumá o ajustá términos según tu vertical.

---

## 4. Deployar

Cualquier hosting de Node sirve. Los más simples:

**Railway / Render (recomendado, gratis para empezar)**
1. Subí este repo a GitHub.
2. Creá un nuevo servicio, conectá el repo.
3. Comando de build: `npm install`. Comando de start: `npm start`.
4. Variable de entorno: `META_ACCESS_TOKEN` (y opcionalmente `PORT`, la plataforma suele definirlo sola).
5. Deploy. Listo.

No hace falta base de datos ni nada persistente — todo se calcula al vuelo en cada request.

---

## 5. Estructura del proyecto

```
server/
  index.js          -> servidor Express + endpoint /api/analyze
  metaAdLibrary.js   -> integración real con Graph API (ads_archive)
  siteAnalyzer.js     -> fetch y análisis básico del sitio web
  angles.js            -> clasificador de ángulos de venta por keywords
  scoring.js            -> motor de scoring y armado del reporte
  demoData.js            -> dataset de ejemplo para el modo demo
public/
  index.html    -> landing + formulario
  styles.css     -> estética (negro/blanco/gris + naranja)
  app.js          -> lógica de front, fetch al backend, render del reporte
```

---

## 6. Próximos pasos sugeridos (no incluidos todavía)

- Guardar cada reporte generado (lead) en una base de datos o enviarlo por email/Zapier para que no se pierda ningún contacto.
- Reemplazar el matching por nombre con un paso de selección manual cuando la búsqueda devuelve varias páginas candidatas.
- Sumar un módulo de comparación contra competidores (mismo motor, corriendo sobre 2-3 cuentas de referencia).
