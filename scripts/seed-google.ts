/**
 * Hambuscador — carga inicial via Google Places API (New)
 *
 * Para correr:
 *   set -a && source .env.local && set +a
 *   GOOGLE_PLACES_API_KEY=... pnpm tsx scripts/seed-google.ts [--dry-run] [--all]
 *
 * Flags:
 *   --dry-run  Muestra qué insertaría sin tocar la DB. Igual gasta API
 *              calls (Google cobra por request).
 *   --all      Lee las 346 comunas oficiales de la tabla `comunas`. Sin
 *              este flag usa solo PILOT_COMUNAS (4 comunas para test).
 *
 * Comportamiento:
 *  - Para cada comuna piloto, hace Text Search "hamburguesería en {comuna}, Chile".
 *  - Pagina hasta 3 páginas (60 max por query) cuando hay nextPageToken.
 *  - Filtra closed_permanently y resultados sin coords.
 *  - Dedup contra DB por (comuna_slug, slug). Si ya existe → skip.
 *  - Inserta como pending, submittedBy = null. El admin aprueba en
 *    /admin/moderacion.
 *  - cuisines default = ["clasica"]. Admin edita después si corresponde.
 *
 * Pricing (Google Places API New, 2025):
 *  - Text Search Enterprise = USD 35 / 1000 (incluye phone, hours, website).
 *  - Cada request paginated cuenta separado.
 *  - 4 comunas × 1-3 pages = 4-12 requests = USD 0.14 - 0.42.
 *  - Free credit USD 200/mes en Google Maps Platform → trivial.
 *
 * ToS:
 *  - El nombre, dirección y coords se pueden cachear hasta 30 días.
 *  - Hours, phone, website también, mientras no se redistribuyan.
 *  - Photos y reviews NO se cachean — por eso este script NO las pide
 *    (atmosphere fields = más caro y no nos sirve).
 *  - Atribución "Powered by Google" recomendada en la UI cuando se
 *    muestren datos derivados (TODO: pill chico en footer).
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db/client";
import { places, type NewDbPlace } from "../src/server/db/schema";

// ============================================================================
// Comunas piloto — 4 con alta densidad de hamburgueserías para validar
// el pipeline antes de escalar a las 346.
// ============================================================================
type SeedComuna = {
  slug: string;
  label: string;
  region: string;
  /** Centroide (lat, lng). Usado para descartar places lejos de la
   * comuna real — Google a veces devuelve places de comunas con el
   * mismo nombre en otros países (Cartagena CO, San Rafael MX, AR). */
  lat: number;
  lng: number;
};

const PILOT_COMUNAS: SeedComuna[] = [
  { slug: "providencia", label: "Providencia", region: "Región Metropolitana", lat: -33.4314, lng: -70.6093 },
  { slug: "las-condes", label: "Las Condes", region: "Región Metropolitana", lat: -33.4083, lng: -70.5778 },
  { slug: "nunoa", label: "Ñuñoa", region: "Región Metropolitana", lat: -33.4569, lng: -70.5972 },
  { slug: "concon", label: "Concón", region: "Región de Valparaíso", lat: -32.9192, lng: -71.5269 },
];

// ============================================================================
// Tipos del Google Places API (New) — solo los campos del field mask.
// ============================================================================
type GoogleOpeningPeriod = {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { periods?: GoogleOpeningPeriod[] };
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
};

type SearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.regularOpeningHours",
  "places.priceLevel",
  "places.businessStatus",
  "nextPageToken",
].join(",");

const PRICE_MAP: Record<string, "$" | "$$" | "$$$" | "$$$$"> = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

// Google API days: 0=Sunday..6=Saturday
const DAY_KEYS_GOOGLE = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;

/**
 * ¿Las coords están dentro de Chile? Mainland + islas oceánicas chilenas
 * (Rapa Nui, Juan Fernández).
 *
 * Necesario porque queries como "hamburguesería en Cartagena, Chile" o
 * "...en San Rafael, Chile" devuelven places en Cartagena CO, San Rafael
 * MX, etc. (comunas con nombres comunes en Latam). El filtro de comuna
 * en address no siempre los captura porque el address formateado de
 * Google también dice "Cartagena".
 */
function isInsideChile(lat: number, lng: number): boolean {
  const mainland = lat >= -56 && lat <= -17.5 && lng >= -76 && lng <= -66;
  const rapaNui = lat >= -27.5 && lat <= -27 && lng >= -109.7 && lng <= -109.2;
  const juanFernandez = lat >= -34 && lat <= -33.5 && lng >= -79 && lng <= -78.7;
  return mainland || rapaNui || juanFernandez;
}

// ============================================================================
// API helpers
// ============================================================================
async function searchText(
  apiKey: string,
  query: string,
): Promise<{ results: GooglePlace[]; requestCount: number }> {
  const all: GooglePlace[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const body: Record<string, unknown> = {
      textQuery: query,
      languageCode: "es",
      regionCode: "CL",
      maxResultCount: 20,
      // includedType filtra server-side a la primary type "hamburger_restaurant"
      // — sin esto, "hamburguesería en X" devuelve cualquier resto cercano que
      // mencione algo similar (pizza, sushi, café). Con esto, ~95% son burger.
      includedType: "hamburger_restaurant",
      strictTypeFiltering: true,
    };
    if (pageToken) body.pageToken = pageToken;

    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Places ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as SearchResponse;
    if (data.places) all.push(...data.places);
    pageToken = data.nextPageToken;
    pages += 1;

    if (pageToken) {
      // Google requiere ~2s entre paginated requests para que el token sea válido
      await new Promise((r) => setTimeout(r, 2000));
    }
  } while (pageToken && pages < 3);

  return { results: all, requestCount: pages };
}

// ============================================================================
// Conversión Google → NewDbPlace
// ============================================================================
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatHM(h?: number, m?: number): string | null {
  if (h === undefined) return null;
  return `${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/**
 * Google `websiteUri` viene como cualquier URL que el negocio registró.
 * Muchos PYMEs ponen su WhatsApp o Instagram ahí. Clasificamos para
 * rutear al campo correcto en vez de saturar el botón "sitio web" con
 * links de IG/WA.
 */
function classifyWebsite(url: string | undefined | null): {
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
} {
  if (!url) return { website: null, whatsapp: null, instagram: null };
  const u = url.trim();
  const lower = u.toLowerCase();

  if (lower.includes("wa.me") || lower.includes("whatsapp.com")) {
    const m = u.match(/\d{8,}/);
    // Si extraemos dígitos (ej. wa.me/56912345678) guardamos solo eso —
    // se puede formatear con espacios después. Si NO hay dígitos
    // (ej. wa.me/message/<id> click-to-chat) preservamos el URL completo;
    // el botón de WhatsApp en la ficha lo detecta y lo usa as-is.
    return {
      website: null,
      whatsapp: m ? m[0] : u,
      instagram: null,
    };
  }

  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    const m = u.match(/instagra(?:m\.com|m\.am)\/([^/?#]+)/i);
    const raw = m && m[1] ? m[1] : null;
    const handle = raw ? raw.replace(/^@/, "") : null;
    // Skip rutas reservadas de IG (no son handles de perfil).
    const reserved = new Set([
      "p", "explore", "reel", "reels", "stories", "tv",
      "accounts", "direct", "challenge", "developer", "about",
    ]);
    if (!handle || reserved.has(handle.toLowerCase())) {
      // No es perfil válido — preserva URL como website (mejor que perderlo).
      return { website: u, whatsapp: null, instagram: null };
    }
    return { website: null, whatsapp: null, instagram: handle };
  }

  return { website: u, whatsapp: null, instagram: null };
}

function buildHoursByDay(
  periods: GoogleOpeningPeriod[] | undefined,
): Record<string, string | null> | null {
  if (!periods || periods.length === 0) return null;
  const byDay: Record<string, string | null> = {};
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    const dayKey = DAY_KEYS_GOOGLE[p.open.day];
    if (!dayKey) continue;
    const o = formatHM(p.open.hour, p.open.minute);
    const c = formatHM(p.close.hour, p.close.minute);
    if (o && c) byDay[dayKey] = `${o}-${c}`;
  }
  return Object.keys(byDay).length > 0 ? byDay : null;
}

function summarize(byDay: Record<string, string | null> | null): {
  weekdays: string;
  weekends: string;
} {
  if (!byDay) return { weekdays: "", weekends: "" };
  const weekdays = byDay.mar ?? byDay.mie ?? byDay.jue ?? byDay.vie ?? byDay.lun ?? "";
  const weekends = byDay.sab ?? byDay.dom ?? "";
  return { weekdays: weekdays ?? "", weekends: weekends ?? "" };
}

async function placeExists(comunaSlug: string, slug: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(
    sql`SELECT 1 FROM places WHERE comuna_slug = ${comunaSlug} AND slug = ${slug} LIMIT 1`,
  );
  return rows.rows.length > 0;
}

// ============================================================================
// Main
// ============================================================================
async function loadAllComunas(): Promise<SeedComuna[]> {
  const db = getDb();
  const rows = await db.execute<{
    slug: string;
    label: string;
    region_label: string;
    lat: string;
    lng: string;
  }>(sql`SELECT slug, label, region_label, lat, lng FROM comunas ORDER BY region_label, label`);
  return rows.rows.map((r) => ({
    slug: r.slug,
    label: r.label,
    region: r.region_label,
    lat: Number(r.lat),
    lng: Number(r.lng),
  }));
}

/**
 * Distancia haversine en metros entre dos puntos (lat/lng decimal).
 * Para descartar places que Google ubica lejos del centroide de la
 * comuna queryada (típicamente Google devolvió un place de otra
 * comuna o de otro país con mismo nombre).
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Threshold de distancia comuna→place. 80km cubre comunas grandes
 * (rurales en Aysén, Magallanes) sin permitir mismatches groseros
 * (San Rafael Mendoza estaría a ~300km de San Rafael Maule). */
const MAX_COMUNA_DISTANCE_M = 80_000;

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("Falta GOOGLE_PLACES_API_KEY en env. Definelo en .env.local.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const allComunas = process.argv.includes("--all");

  const comunas = allComunas ? await loadAllComunas() : PILOT_COMUNAS;
  if (comunas.length === 0) {
    console.error("No hay comunas para procesar — ¿está poblada la tabla `comunas`?");
    process.exit(1);
  }

  console.log(`Modo: ${dryRun ? "DRY-RUN (no inserta)" : "WRITE (inserta en DB)"}`);
  console.log(
    `Comunas: ${comunas.length} ${allComunas ? "(todas las oficiales)" : "(piloto)"}\n`,
  );

  let totalFound = 0;
  let totalInserted = 0;
  let totalSkippedDup = 0;
  let totalSkippedClosed = 0;
  let totalSkippedInvalid = 0;
  let totalSkippedWrongComuna = 0;
  let totalSkippedOutsideChile = 0;
  let totalSkippedFarFromComuna = 0;
  let totalRequests = 0;

  let idx = 0;
  for (const comuna of comunas) {
    idx += 1;
    const query = `hamburguesería en ${comuna.label}, Chile`;
    console.log(`▸ [${idx}/${comunas.length}] ${comuna.label} (${comuna.region})`);

    let results: GooglePlace[];
    let requestCount: number;
    try {
      const r = await searchText(apiKey, query);
      results = r.results;
      requestCount = r.requestCount;
    } catch (err) {
      console.error(`  ✗ error: ${(err as Error).message}`);
      // Pequeño backoff por si fue rate limit; seguimos
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    totalRequests += requestCount;
    if (results.length === 0) {
      console.log(`  · 0 resultados`);
    } else {
      console.log(`  ✓ ${results.length} resultados (${requestCount} req)`);
    }

    for (const g of results) {
      totalFound += 1;
      const name = g.displayName?.text?.trim();
      const lat = g.location?.latitude;
      const lng = g.location?.longitude;

      if (!name || lat == null || lng == null) {
        totalSkippedInvalid += 1;
        continue;
      }
      if (g.businessStatus === "CLOSED_PERMANENTLY") {
        totalSkippedClosed += 1;
        continue;
      }

      // Bbox check — descarta places fuera de Chile (Cartagena CO,
      // San Rafael MX, etc.). Hace fallback más estricto que el address
      // matching, que falla cuando el formattedAddress de Google también
      // contiene la comuna queryada.
      if (!isInsideChile(lat, lng)) {
        totalSkippedOutsideChile += 1;
        continue;
      }

      // Distance check vs centroide de la comuna. Captura los casos donde
      // el place pasa el bbox de Chile pero está en otra comuna del país
      // (ej. San Rafael Mendoza AR cae dentro del bbox laxo, pero ~300km
      // del San Rafael Maule centroid).
      const distanceM = haversineMeters(lat, lng, comuna.lat, comuna.lng);
      if (distanceM > MAX_COMUNA_DISTANCE_M) {
        totalSkippedFarFromComuna += 1;
        continue;
      }

      // Verificación de comuna: Google text search puede devolver places
      // de comunas vecinas (ej. Viña del Mar cuando la query es Concón).
      // Filtramos por presencia del label de la comuna en la dirección
      // formateada (case + accent insensitive).
      const address = (g.shortFormattedAddress ?? g.formattedAddress ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      const comunaNorm = comuna.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      if (!address.includes(comunaNorm)) {
        totalSkippedWrongComuna += 1;
        continue;
      }

      const slug = slugify(name);
      if (!slug) {
        totalSkippedInvalid += 1;
        continue;
      }

      if (!dryRun) {
        const exists = await placeExists(comuna.slug, slug);
        if (exists) {
          totalSkippedDup += 1;
          continue;
        }
      }

      const byDay = buildHoursByDay(g.regularOpeningHours?.periods);
      const summary = summarize(byDay);
      const phone = g.nationalPhoneNumber ?? g.internationalPhoneNumber ?? null;
      const priceRange = (g.priceLevel && PRICE_MAP[g.priceLevel]) ?? "$$";
      // Google websiteUri suele ser un wa.me/<phone> o instagram.com/<handle>
      // — clasificamos para rutear al campo correcto.
      const classified = classifyWebsite(g.websiteUri);

      const place: NewDbPlace = {
        name,
        slug,
        comunaSlug: comuna.slug,
        comunaLabel: comuna.label,
        region: comuna.region,
        address: g.shortFormattedAddress ?? g.formattedAddress ?? "",
        lat: lat.toString(),
        lng: lng.toString(),
        cuisines: ["clasica"],
        priceRange,
        specialty: null,
        hoursWeekdays: summary.weekdays || null,
        hoursWeekends: summary.weekends || null,
        hoursByDay: byDay,
        phone,
        whatsapp: classified.whatsapp,
        instagram: classified.instagram,
        website: classified.website,
        photos: [],
        moderationStatus: "pending",
        submittedBy: null,
      };

      console.log(`  + ${name} — ${place.address}`);
      if (!dryRun) {
        const db = getDb();
        await db.insert(places).values(place);
      }
      totalInserted += 1;
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`  Encontrados:           ${totalFound}`);
  console.log(`  Insertados:            ${totalInserted}${dryRun ? " (dry-run, no escribió)" : ""}`);
  console.log(`  Skip (duplicados):     ${totalSkippedDup}`);
  console.log(`  Skip (cerrados):       ${totalSkippedClosed}`);
  console.log(`  Skip (sin coords):     ${totalSkippedInvalid}`);
  console.log(`  Skip (otra comuna):    ${totalSkippedWrongComuna}`);
  console.log(`  Skip (fuera de Chile): ${totalSkippedOutsideChile}`);
  console.log(`  Skip (lejos centroid): ${totalSkippedFarFromComuna}`);
  console.log(`  Requests Google:       ${totalRequests} → ~USD ${(totalRequests * 0.035).toFixed(3)}`);

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
