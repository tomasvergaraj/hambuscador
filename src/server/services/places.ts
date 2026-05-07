import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

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
      byDay: row.hoursByDay ?? null,
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
    // Query geo con PostGIS — usamos drizzle .select() en vez de SQL crudo
    // para que las columnas vuelvan ya mapeadas a camelCase (sino dbPlaceToUi
    // recibe campos undefined). El predicado geo va como sql literal.
    const rows = await db
      .select({
        place: places,
        distanceM: sql<number>`ST_Distance(
          ${places}.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        )`.as("distance_m"),
      })
      .from(places)
      .where(
        and(
          eq(places.moderationStatus, "approved"),
          sql`ST_DWithin(
            ${places}.location,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusM}
          )`,
        ),
      )
      .orderBy(sql`distance_m ASC`)
      .limit(limit);

    return rows.map((r) => dbPlaceToUi(r.place, Number(r.distanceM)));
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

export type SearchResult = {
  items: Place[];
  /** Si true, hicimos fallback a búsqueda fuzzy (similarity > 0.3) porque
   *  la búsqueda exacta no devolvió nada. La UI lo usa para mostrar un banner. */
  usedFuzzy: boolean;
};

/**
 * Búsqueda full-text + filtros. Si la query es vacía, lista los aprobados.
 *
 * **Relevancia**: cuando hay `query`, se calcula un `score` por fila que pondera:
 *   - prefix match en name → +5
 *   - substring match en name → +3 (acumulable con prefix)
 *   - cuisine match → +2
 *   - specialty match → +1.5
 *   - comuna_label match → +1
 *   - address match → +0.5
 * Se ordena por `score DESC, rating_avg DESC`. Si la búsqueda exacta retorna 0
 * filas (y no hay filtros que expliquen el vacío) probamos fuzzy con `pg_trgm`
 * (`similarity(name, q) > 0.3`).
 *
 * `openNow` se filtra en JS porque depende de la hora actual (TZ Chile) y
 * de `hours_by_day`/legacy hours; replicarlo en SQL no compensa al volumen
 * actual. `sort=distance` requiere `userCoords`; sin coords cae a `rating`.
 */
export async function searchPlaces(opts: {
  query?: string;
  comunaSlug?: string;
  cuisines?: string[];
  priceRanges?: string[];
  openNow?: boolean;
  sort?: "rating" | "recent" | "distance";
  userCoords?: { lat: number; lng: number };
  limit?: number;
}): Promise<SearchResult> {
  if (!isDbConfigured()) {
    return searchPlacesMock(opts.query ?? "", {
      cuisines: opts.cuisines,
      priceRanges: opts.priceRanges,
      comunaSlug: opts.comunaSlug,
      openNow: opts.openNow,
      sort: opts.sort,
      userCoords: opts.userCoords,
    });
  }

  const {
    query,
    comunaSlug,
    cuisines,
    priceRanges,
    openNow,
    sort = "rating",
    userCoords,
    limit = 30,
  } = opts;
  const db = getDb();
  const trimmed = query?.trim() ?? "";

  const baseConditions = [eq(places.moderationStatus, "approved")];

  if (comunaSlug) baseConditions.push(eq(places.comunaSlug, comunaSlug));

  if (cuisines && cuisines.length > 0) {
    const cuisineLiterals = sql.join(
      cuisines.map((c) => sql`${c}`),
      sql`, `,
    );
    baseConditions.push(sql`${places.cuisines} && ARRAY[${cuisineLiterals}]::text[]`);
  }

  if (priceRanges && priceRanges.length > 0) {
    baseConditions.push(inArray(places.priceRange, priceRanges));
  }

  // Helper para correr la query con un set de condiciones; encapsula el
  // branch de distance vs rating/recent.
  const runQuery = async (
    conditions: typeof baseConditions,
    customOrderBy?: ReturnType<typeof sql>,
  ): Promise<Place[]> => {
    if (sort === "distance" && userCoords) {
      const rows = await db
        .select({
          place: places,
          distanceM: sql<number>`ST_Distance(
            ${places}.location,
            ST_SetSRID(ST_MakePoint(${userCoords.lng}, ${userCoords.lat}), 4326)::geography
          )`.as("distance_m"),
        })
        .from(places)
        .where(and(...conditions))
        .orderBy(customOrderBy ?? sql`distance_m ASC`)
        .limit(limit);
      return rows.map((r) => dbPlaceToUi(r.place, Number(r.distanceM)));
    }
    const fallbackOrder =
      sort === "recent" ? sql`created_at DESC` : sql`rating_avg DESC NULLS LAST`;
    const rows = await db
      .select()
      .from(places)
      .where(and(...conditions))
      .orderBy(customOrderBy ?? fallbackOrder)
      .limit(limit);
    return rows.map((row) => dbPlaceToUi(row));
  };

  let mapped: Place[];
  let usedFuzzy = false;

  if (trimmed.length === 0) {
    // Sin query: solo aplicar filtros + sort por defecto.
    mapped = await runQuery(baseConditions);
  } else {
    // Con query: scoring multi-campo. Match contra name, cuisines (unnest),
    // specialty, comuna_label, address.
    const like = `%${trimmed}%`;
    const prefix = `${trimmed}%`;
    const matchClause = or(
      ilike(places.name, like),
      ilike(places.comunaLabel, like),
      ilike(places.specialty, like),
      ilike(places.address, like),
      sql`EXISTS (SELECT 1 FROM unnest(${places.cuisines}) c WHERE c ILIKE ${like})`,
    );
    const conditions = matchClause
      ? [...baseConditions, matchClause]
      : baseConditions;
    const score = sql<number>`(
      (CASE WHEN ${places.name} ILIKE ${prefix} THEN 5 ELSE 0 END) +
      (CASE WHEN ${places.name} ILIKE ${like} THEN 3 ELSE 0 END) +
      (CASE WHEN EXISTS (SELECT 1 FROM unnest(${places.cuisines}) c WHERE c ILIKE ${like}) THEN 2 ELSE 0 END) +
      (CASE WHEN ${places.specialty} ILIKE ${like} THEN 1.5 ELSE 0 END) +
      (CASE WHEN ${places.comunaLabel} ILIKE ${like} THEN 1 ELSE 0 END) +
      (CASE WHEN ${places.address} ILIKE ${like} THEN 0.5 ELSE 0 END)
    )`;
    // Score-based sort siempre tiene prioridad sobre el sort default cuando
    // hay query — la relevancia debe mandar. Tie-break por rating, después
    // por distancia si hay coords.
    const orderBy =
      sort === "distance" && userCoords
        ? sql`${score} DESC, distance_m ASC`
        : sql`${score} DESC, rating_avg DESC NULLS LAST`;
    mapped = await runQuery(conditions, orderBy);

    // Fallback fuzzy: si el strict search no devolvió nada Y la query tiene
    // ≥ 3 chars (sino el ruido es alto), retry con similarity().
    if (mapped.length === 0 && trimmed.length >= 3) {
      const fuzzyClause = sql`similarity(${places.name}, ${trimmed}) > 0.3`;
      const fuzzyConditions = [...baseConditions, fuzzyClause];
      const fuzzyOrder = sql`similarity(${places.name}, ${trimmed}) DESC, rating_avg DESC NULLS LAST`;
      const fuzzy = await runQuery(fuzzyConditions, fuzzyOrder);
      if (fuzzy.length > 0) {
        mapped = fuzzy;
        usedFuzzy = true;
      }
    }
  }

  if (openNow) {
    mapped = mapped.filter((p) => p.status === "open" || p.status === "closing-soon");
  }

  return { items: mapped, usedFuzzy };
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
  hoursByDay?: Record<string, string | null>;
  phone?: string;
  instagram?: string;
  photos?: string[];
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
    hoursByDay: input.hoursByDay ?? null,
    phone: input.phone ?? null,
    instagram: input.instagram ?? null,
    photos: input.photos ?? [],
    submittedBy: input.submittedBy,
    moderationStatus: "pending",
  };

  const [row] = await db.insert(places).values(newPlace).returning();
  if (!row) throw new Error("INSERT no retornó fila");
  return row;
}

/**
 * Lista de places en estado `pending` (aguardando moderación), ordenados
 * por más viejos primero (FIFO de revisión).
 */
/**
 * ¿Ya hay un local con este nombre en esta comuna?
 * Usado por el wizard de /agregar para validar antes de submit (mejor UX
 * que esperar a que pegue el unique constraint en el INSERT).
 */
export async function placeExists(name: string, comunaSlug: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const slug = toSlugLike(name);
  if (slug.length === 0) return false;

  const db = getDb();
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.comunaSlug, comunaSlug)))
    .limit(1);

  return Boolean(row);
}

/**
 * Locales recién aprobados (últimos 14 días). Cierra el loop "alguien aporta
 * → aparece en home". Si no hay DB, retorna mock vacío (mock no tiene timestamps).
 */
export async function getRecentlyApprovedPlaces(opts?: {
  limit?: number;
  daysBack?: number;
}): Promise<Place[]> {
  if (!isDbConfigured()) {
    // Mock: marcamos los primeros 2 como "recientes" para que el home se vea poblado en demo.
    const mock = await getPlacesNearby({ limit: opts?.limit ?? 4 });
    return mock.slice(0, opts?.limit ?? 4);
  }

  const { limit = 4, daysBack = 14 } = opts ?? {};
  const db = getDb();
  const rows = await db
    .select()
    .from(places)
    .where(
      and(
        eq(places.moderationStatus, "approved"),
        sql`approved_at >= NOW() - INTERVAL '1 day' * ${daysBack}`,
      ),
    )
    .orderBy(sql`approved_at DESC`)
    .limit(limit);

  return rows.map((row) => dbPlaceToUi(row));
}

/**
 * Slugs (+ updatedAt) de todos los locales aprobados. Para el sitemap.
 * Solo retorna lo mínimo necesario — nada de fotos, reseñas, etc.
 */
export async function getApprovedSlugs(): Promise<
  Array<{ comunaSlug: string; slug: string; updatedAt: Date }>
> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({
      comunaSlug: places.comunaSlug,
      slug: places.slug,
      updatedAt: places.updatedAt,
    })
    .from(places)
    .where(eq(places.moderationStatus, "approved"))
    .orderBy(sql`updated_at DESC`);
}

export async function getPendingPlaces(opts?: { limit?: number }): Promise<Place[]> {
  if (!isDbConfigured()) return [];

  const { limit = 50 } = opts ?? {};
  const db = getDb();
  const rows = await db
    .select()
    .from(places)
    .where(eq(places.moderationStatus, "pending"))
    .orderBy(sql`created_at ASC`)
    .limit(limit);

  return rows.map((row) => dbPlaceToUi(row));
}

/**
 * Aprueba un place: cambia status a `approved` y marca `approvedAt`.
 * Llamar desde Server Action protegida por rol admin.
 */
export async function approvePlace(placeId: string): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("approvePlace requiere DATABASE_URL");
  }

  const db = getDb();
  await db
    .update(places)
    .set({
      moderationStatus: "approved",
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));
}

/**
 * Rechaza un place. Lo deja en `rejected` para auditoría (no se borra).
 * TODO Fase 5: agregar `rejectionReason` text para feedback al submitter.
 */
export async function rejectPlace(placeId: string): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("rejectPlace requiere DATABASE_URL");
  }

  const db = getDb();
  await db
    .update(places)
    .set({
      moderationStatus: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));
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
