import { and, eq, ilike, or, sql } from "drizzle-orm";

import type { CuisineId, PriceRangeId } from "@/lib/constants";
import { getDb, isDbConfigured } from "@/server/db/client";
import { places, type DbPlace, type NewDbPlace } from "@/server/db/schema";
import type { Place } from "@/types/place";
import { getPlacesNearbyMock, getPlaceBySlugMock, searchPlacesMock } from "./mock";

// ============================================================================
// Conversión DB → UI
// ----------------------------------------------------------------------------
// La tabla `places` tiene columnas en formato de storage (numeric para
// lat/lng, text[] para cuisines). El tipo `Place` que consume la UI es más
// pulido. Esta función traduce.
// ============================================================================

function dbPlaceToUi(row: DbPlace, distanceM?: number): Place {
  const status = computeStatus(row.hoursWeekdays, row.hoursWeekends);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    comuna: row.comunaSlug,
    comunaLabel: row.comunaLabel,
    region: row.region,
    address: row.address,
    cuisines: row.cuisines as CuisineId[],
    specialty: row.specialty,
    priceRange: row.priceRange as PriceRangeId,
    rating: row.ratingAvg ? Number(row.ratingAvg) : 0,
    reviewCount: row.reviewCount,
    status,
    hours: {
      weekdays: row.hoursWeekdays ?? "",
      weekends: row.hoursWeekends ?? "",
    },
    coords: {
      lat: Number(row.lat),
      lng: Number(row.lng),
    },
    distanceM,
    photos: row.photos,
    phone: row.phone ?? undefined,
    instagram: row.instagram ?? undefined,
    isVerified: row.isVerified,
    isClaimed: !!row.claimedBy,
  };
}

/**
 * Calcula el status (abierto/cierra-pronto/cerrado) en base a la hora actual
 * y el horario del local. Implementación simple — TODO Fase 3: respetar
 * timezone (Chile cambia hora 2 veces al año), días de la semana, feriados.
 */
function computeStatus(
  weekdays: string | null,
  _weekends: string | null,
): "open" | "closing-soon" | "closed" {
  if (!weekdays) return "closed";
  // Heurística temporal: si tiene horario, mostramos abierto. Real check va
  // en Fase 3 con dayjs/luxon + timezone "America/Santiago".
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12 || hour >= 23) return "closed";
  if (hour >= 22) return "closing-soon";
  return "open";
}

// ============================================================================
// API pública del servicio
// ============================================================================

/**
 * Locales cerca de un punto. Si no hay coords, retorna los más recientes.
 * Solo retorna locales aprobados (moderation_status = 'approved').
 */
export async function getPlacesNearby(opts?: {
  lat?: number;
  lng?: number;
  /** Radio en metros, default 5km */
  radiusM?: number;
  limit?: number;
}): Promise<Place[]> {
  if (!isDbConfigured()) {
    return getPlacesNearbyMock();
  }

  const { lat, lng, radiusM = 5000, limit = 20 } = opts ?? {};
  const db = getDb();

  if (lat !== undefined && lng !== undefined) {
    // Query geo con PostGIS
    const rows = await db.execute(sql`
      SELECT
        p.*,
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS distance_m
      FROM places p
      WHERE
        p.moderation_status = 'approved'
        AND ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )
      ORDER BY distance_m ASC
      LIMIT ${limit}
    `);

    return (rows.rows as Array<DbPlace & { distance_m: number }>).map((row) =>
      dbPlaceToUi(row, Number(row.distance_m)),
    );
  }

  // Fallback: solo locales aprobados, ordenados por rating
  const rows = await db
    .select()
    .from(places)
    .where(eq(places.moderationStatus, "approved"))
    .orderBy(sql`rating_avg DESC NULLS LAST`)
    .limit(limit);

  return rows.map((row) => dbPlaceToUi(row));
}

/**
 * Busca un local por su URL pública (comuna + slug). Solo aprobados.
 */
export async function getPlaceBySlug(comunaSlug: string, slug: string): Promise<Place | null> {
  if (!isDbConfigured()) {
    return getPlaceBySlugMock(comunaSlug, slug);
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(places)
    .where(
      and(
        eq(places.comunaSlug, comunaSlug),
        eq(places.slug, slug),
        eq(places.moderationStatus, "approved"),
      ),
    )
    .limit(1);

  return row ? dbPlaceToUi(row) : null;
}

/**
 * Búsqueda full-text + filtros. Si la query es vacía, lista los aprobados.
 */
export async function searchPlaces(opts: {
  query?: string;
  comunaSlug?: string;
  cuisine?: string;
  limit?: number;
}): Promise<Place[]> {
  if (!isDbConfigured()) {
    return searchPlacesMock(opts.query ?? "", { cuisine: opts.cuisine });
  }

  const { query, comunaSlug, cuisine, limit = 30 } = opts;
  const db = getDb();

  const conditions = [eq(places.moderationStatus, "approved")];

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    // ILIKE en name + comuna_label es suficiente para v1. En Fase 3
    // podemos cambiar a similarity() del trigram index.
    const orCondition = or(ilike(places.name, q), ilike(places.comunaLabel, q));
    if (orCondition) conditions.push(orCondition);
  }

  if (comunaSlug) {
    conditions.push(eq(places.comunaSlug, comunaSlug));
  }

  if (cuisine) {
    conditions.push(sql`${cuisine} = ANY(${places.cuisines})`);
  }

  const rows = await db
    .select()
    .from(places)
    .where(and(...conditions))
    .orderBy(sql`rating_avg DESC NULLS LAST`)
    .limit(limit);

  return rows.map((row) => dbPlaceToUi(row));
}

/**
 * Obtiene el ID de un place por (comuna_slug, slug). Útil para fetch de
 * reseñas u otras relaciones desde una page que ya tiene los slugs.
 */
export async function getPlaceIdBySlug(
  comunaSlug: string,
  slug: string,
): Promise<string | null> {
  if (!isDbConfigured()) {
    const p = getPlaceBySlugMock(comunaSlug, slug);
    return p?.id ?? null;
  }
  const db = getDb();
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.comunaSlug, comunaSlug), eq(places.slug, slug)))
    .limit(1);
  return row?.id ?? null;
}

// ============================================================================
// Mutaciones (escritura) — TODO conectar a Server Actions / Route Handlers
// ============================================================================

/**
 * Crea un local en estado `pending` (esperando moderación).
 * Llamar desde Server Action. Validar el input con zod antes.
 */
export async function createPlace(input: {
  name: string;
  comunaSlug: string;
  comunaLabel: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
  cuisines: string[];
  priceRange: string;
  specialty?: string;
  hoursWeekdays?: string;
  hoursWeekends?: string;
  phone?: string;
  instagram?: string;
  submittedBy: string;
}): Promise<DbPlace> {
  if (!isDbConfigured()) {
    throw new Error("createPlace requiere DATABASE_URL — no se puede ejecutar en modo mock.");
  }

  const db = getDb();
  const slug = toSlugLike(input.name);

  const newPlace: NewDbPlace = {
    name: input.name,
    slug,
    comunaSlug: input.comunaSlug,
    comunaLabel: input.comunaLabel,
    region: input.region,
    address: input.address,
    lat: input.lat.toString(),
    lng: input.lng.toString(),
    cuisines: input.cuisines,
    priceRange: input.priceRange,
    specialty: input.specialty ?? null,
    hoursWeekdays: input.hoursWeekdays ?? null,
    hoursWeekends: input.hoursWeekends ?? null,
    phone: input.phone ?? null,
    instagram: input.instagram ?? null,
    submittedBy: input.submittedBy,
    moderationStatus: "pending",
  };

  const [row] = await db.insert(places).values(newPlace).returning();
  if (!row) throw new Error("INSERT no retornó fila");
  return row;
}

/**
 * Recalcula los agregados denormalizados (rating_avg, review_count) para un
 * local. Llamar después de crear/borrar una reseña.
 */
export async function recomputePlaceAggregates(placeId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  await db.execute(sql`
    UPDATE places
    SET
      rating_avg = COALESCE((
        SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE place_id = ${placeId}
      ), NULL),
      review_count = (
        SELECT COUNT(*)::int FROM reviews WHERE place_id = ${placeId}
      ),
      updated_at = NOW()
    WHERE id = ${placeId}
  `);
}

// ----------------------------------------------------------------------------
// Helpers internos
// ----------------------------------------------------------------------------

function toSlugLike(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
