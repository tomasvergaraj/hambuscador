import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { CuisineId, PriceRangeId } from "@/lib/constants";
import { tokenizeQuery } from "@/lib/search";
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
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    website: row.website ?? undefined,
    isVerified: row.isVerified,
    isFeatured: row.isFeatured,
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
 * **Pipeline de relevancia** (cuando hay `query`):
 *   1. `tokenizeQuery` baja a ASCII lowercase, separa tokens, descarta stop
 *      words ("de la y en…") y expande sinónimos (veggie → vegetariana, etc).
 *   2. WHERE: cada token tiene que matchear AL MENOS un campo
 *      (name / cuisines / specialty / comuna_label / region / address).
 *      AND entre tokens. "smash providencia" exige BOTH smash AND providencia.
 *   3. SCORE por fila = sumatoria sobre tokens de `max field weight matched`:
 *      prefix-name=5, name=3, cuisine=2, specialty=1.5, comuna=1, region=0.7,
 *      address=0.5. Bonus +5 si el `phrase` completo está como substring del nombre.
 *   4. TIEBREAK: bayesian rating (suaviza outliers de 5★ con 1 reseña),
 *      después distancia si hay coords, después rating raw.
 *
 * Toda la comparación corre sobre `f_unaccent(lower(...))` así "ñunoa",
 * "Ñuñoa" y "nunoa" son equivalentes — clave para mobile/Chile.
 *
 * Si el strict pass devuelve 0, fallback a fuzzy con `pg_trgm.similarity()`
 * sobre la versión normalizada (también accent-insensitive).
 *
 * `openNow` se filtra en JS porque depende de la hora actual (TZ Chile) y
 * de `hours_by_day`/legacy hours.
 */
export async function searchPlaces(opts: {
  query?: string;
  comunaSlug?: string;
  cuisines?: string[];
  priceRanges?: string[];
  openNow?: boolean;
  sort?: "rating" | "recent" | "distance" | "popularity";
  userCoords?: { lat: number; lng: number };
  limit?: number;
  /** Filtro adicional por bayes rating mínimo. Útil para listas curadas. */
  minBayesRating?: number;
  /** Solo locales aprobados en los últimos N días (sección "recién agregadas"). */
  approvedWithinDays?: number;
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
    minBayesRating,
    approvedWithinDays,
  } = opts;
  const db = getDb();
  const { groups, phrase } = tokenizeQuery(query ?? "");

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

  if (typeof approvedWithinDays === "number" && approvedWithinDays > 0) {
    baseConditions.push(
      sql`approved_at >= NOW() - INTERVAL '1 day' * ${approvedWithinDays}`,
    );
  }

  if (typeof minBayesRating === "number" && minBayesRating > 0) {
    // Bayes inline: prior C=5, μ=4.0. Si review_count = 0, bayes = 4.0.
    baseConditions.push(
      sql`(
        (COALESCE(${places.reviewCount}, 0)::numeric * COALESCE(${places.ratingAvg}, 4.0) + 5 * 4.0)
        / (COALESCE(${places.reviewCount}, 0) + 5)
      ) >= ${minBayesRating}`,
    );
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
      sort === "recent"
        ? sql`created_at DESC`
        : sort === "popularity"
          ? sql`(
              (COALESCE(review_count, 0)::numeric * COALESCE(rating_avg, 4.0) + 5 * 4.0)
              / (COALESCE(review_count, 0) + 5)
            ) DESC, review_count DESC, rating_avg DESC NULLS LAST`
          : sql`rating_avg DESC NULLS LAST`;
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

  // Bayesian rating: prior C=5 con global avg 4.0. Pulla 5★ con 1 reseña
  // hacia el centro; un 4.7★ con 200 reseñas se queda muy cerca de 4.7.
  const bayesRating = sql<number>`(
    (COALESCE(${places.reviewCount}, 0)::numeric * COALESCE(${places.ratingAvg}, 4.0) + 5 * 4.0)
    / (COALESCE(${places.reviewCount}, 0) + 5)
  )`;

  if (groups.length === 0) {
    // Sin tokens útiles (query vacía, o solo stop-words): filtros + sort default.
    mapped = await runQuery(baseConditions);
  } else {
    // Helper: clause de match para UN término en CUALQUIERA de los campos.
    const matchClauseFor = (t: string) => {
      const like = `%${t}%`;
      return sql`(
        f_unaccent(lower(${places.name})) LIKE ${like} OR
        f_unaccent(lower(${places.comunaLabel})) LIKE ${like} OR
        f_unaccent(lower(${places.region})) LIKE ${like} OR
        f_unaccent(lower(COALESCE(${places.specialty}, ''))) LIKE ${like} OR
        f_unaccent(lower(${places.address})) LIKE ${like} OR
        EXISTS (SELECT 1 FROM unnest(${places.cuisines}) c WHERE f_unaccent(lower(c)) LIKE ${like})
      )`;
    };

    // Cada grupo: OR entre alternativas (token + sinónimos). Grupos: AND.
    const groupWhereClauses = groups.map((alts) =>
      sql`(${sql.join(alts.map(matchClauseFor), sql` OR `)})`,
    );
    const conditions = [
      ...baseConditions,
      sql`(${sql.join(groupWhereClauses, sql` AND `)})`,
    ];

    // Score por término individual.
    const scoreFor = (t: string) => {
      const like = `%${t}%`;
      const prefix = `${t}%`;
      return sql`GREATEST(
        CASE WHEN f_unaccent(lower(${places.name})) LIKE ${prefix} THEN 5.0 ELSE 0 END,
        CASE WHEN f_unaccent(lower(${places.name})) LIKE ${like} THEN 3.0 ELSE 0 END,
        CASE WHEN EXISTS (SELECT 1 FROM unnest(${places.cuisines}) c WHERE f_unaccent(lower(c)) LIKE ${like}) THEN 2.0 ELSE 0 END,
        CASE WHEN f_unaccent(lower(COALESCE(${places.specialty}, ''))) LIKE ${like} THEN 1.5 ELSE 0 END,
        CASE WHEN f_unaccent(lower(${places.comunaLabel})) LIKE ${like} THEN 1.0 ELSE 0 END,
        CASE WHEN f_unaccent(lower(${places.region})) LIKE ${like} THEN 0.7 ELSE 0 END,
        CASE WHEN f_unaccent(lower(${places.address})) LIKE ${like} THEN 0.5 ELSE 0 END
      )`;
    };
    // Por grupo: max score entre alternativas (sinónimos no se suman, son alternativas).
    const scoreTerms = groups.map((alts) =>
      alts.length === 1
        ? scoreFor(alts[0]!)
        : sql`GREATEST(${sql.join(alts.map(scoreFor), sql`, `)})`,
    );
    // Phrase bonus: el phrase normalizado completo dentro del nombre = +5.
    // Solo cuando vale la pena (≥ 4 chars; sino "bu" matchearía cualquier cosa).
    const phraseBonus =
      phrase.length >= 4
        ? sql`(CASE WHEN f_unaccent(lower(${places.name})) LIKE ${`%${phrase}%`} THEN 5.0 ELSE 0 END)`
        : sql`0`;
    const score = sql<number>`(${sql.join(scoreTerms, sql` + `)} + ${phraseBonus})`;

    // Order: relevancia primero, después popularidad (bayes), después
    // distancia si hay coords, después rating crudo.
    const orderBy =
      sort === "distance" && userCoords
        ? sql`${score} DESC, ${bayesRating} DESC, distance_m ASC, rating_avg DESC NULLS LAST`
        : sql`${score} DESC, ${bayesRating} DESC, rating_avg DESC NULLS LAST`;
    mapped = await runQuery(conditions, orderBy);

    // Fuzzy fallback: si strict da 0 y el phrase tiene ≥ 3 chars, retry con
    // similarity sobre la versión normalizada (accent-insensitive).
    if (mapped.length === 0 && phrase.length >= 3) {
      const fuzzyClause = sql`similarity(f_unaccent(lower(${places.name})), ${phrase}) > 0.3`;
      const fuzzyConditions = [...baseConditions, fuzzyClause];
      const fuzzyOrder = sql`similarity(f_unaccent(lower(${places.name})), ${phrase}) DESC, ${bayesRating} DESC`;
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
 * Obtiene un place por ID (cualquier estado de moderación).
 * Solo para usar desde admin pages — bypassa el filtro de approved.
 */
export async function getPlaceByIdForAdmin(id: string): Promise<Place | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
  return row ? dbPlaceToUi(row) : null;
}

/**
 * Lista para admin con búsqueda opcional por nombre/comuna. Incluye locales
 * en cualquier estado (approved/pending/rejected). Para el index editorial.
 */
export async function getAllPlacesForAdmin(opts?: {
  query?: string;
  status?: "approved" | "pending" | "rejected";
  limit?: number;
}): Promise<Array<Place & { moderationStatus: string }>> {
  if (!isDbConfigured()) return [];
  const { query, status, limit = 50 } = opts ?? {};
  const db = getDb();
  const conditions = [];
  if (status) conditions.push(eq(places.moderationStatus, status));
  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    const orC = or(ilike(places.name, q), ilike(places.comunaLabel, q));
    if (orC) conditions.push(orC);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(places)
    .where(where)
    .orderBy(sql`updated_at DESC`)
    .limit(limit);
  return rows.map((r) => ({ ...dbPlaceToUi(r), moderationStatus: r.moderationStatus }));
}

/**
 * Patch parcial de un place. Solo desde Server Action protegida por rol admin.
 * NO permite cambiar `slug` ni `comunaSlug` para preservar la URL pública
 * (cambiarlos rompería links existentes y SEO). Si se necesita rebatear,
 * mejor rechazar + recrear.
 */
export async function updatePlace(
  placeId: string,
  patch: {
    name?: string;
    comunaLabel?: string;
    region?: string;
    address?: string;
    lat?: number;
    lng?: number;
    cuisines?: string[];
    priceRange?: string;
    specialty?: string | null;
    hoursWeekdays?: string | null;
    hoursWeekends?: string | null;
    hoursByDay?: Record<string, string | null> | null;
    phone?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    website?: string | null;
    photos?: string[];
    isVerified?: boolean;
    isFeatured?: boolean;
  },
): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("updatePlace requiere DATABASE_URL");
  }

  const db = getDb();
  const updates: Partial<NewDbPlace> & { updatedAt: Date } = { updatedAt: new Date() };

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.comunaLabel !== undefined) updates.comunaLabel = patch.comunaLabel;
  if (patch.region !== undefined) updates.region = patch.region;
  if (patch.address !== undefined) updates.address = patch.address;
  if (patch.lat !== undefined) updates.lat = patch.lat.toString();
  if (patch.lng !== undefined) updates.lng = patch.lng.toString();
  if (patch.cuisines !== undefined) updates.cuisines = patch.cuisines;
  if (patch.priceRange !== undefined) updates.priceRange = patch.priceRange;
  if (patch.specialty !== undefined) updates.specialty = patch.specialty;
  if (patch.hoursWeekdays !== undefined) updates.hoursWeekdays = patch.hoursWeekdays;
  if (patch.hoursWeekends !== undefined) updates.hoursWeekends = patch.hoursWeekends;
  if (patch.hoursByDay !== undefined) updates.hoursByDay = patch.hoursByDay;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.whatsapp !== undefined) updates.whatsapp = patch.whatsapp;
  if (patch.instagram !== undefined) updates.instagram = patch.instagram;
  if (patch.website !== undefined) updates.website = patch.website;
  if (patch.photos !== undefined) updates.photos = patch.photos;
  if (patch.isVerified !== undefined) updates.isVerified = patch.isVerified;
  if (patch.isFeatured !== undefined) updates.isFeatured = patch.isFeatured;

  await db.update(places).set(updates).where(eq(places.id, placeId));
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
  whatsapp?: string;
  instagram?: string;
  website?: string;
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
    whatsapp: input.whatsapp ?? null,
    instagram: input.instagram ?? null,
    website: input.website ?? null,
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

/**
 * Cuenta los locales en estado `pending`. Usado por el admin layout para
 * el badge en el tab "pendientes". Más eficiente que getPendingPlaces().length
 * cuando solo necesitás el número.
 */
export async function countPendingPlaces(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const rows = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM places WHERE moderation_status = 'pending'`,
  );
  const first = rows.rows[0] as { count?: number } | undefined;
  return first?.count ?? 0;
}

export type PendingPlaceItem = {
  place: Place;
  /** True si el submitter está baneado al momento de la query — el admin
   * lo revisa con extra cuidado antes de aprobar (probable spam). */
  submitterBanned: boolean;
};

export async function getPendingPlaces(opts?: {
  limit?: number;
}): Promise<PendingPlaceItem[]> {
  if (!isDbConfigured()) return [];

  const { limit = 50 } = opts ?? {};
  const db = getDb();
  const { users } = await import("@/server/db/schema");
  const rows = await db
    .select({
      place: places,
      submitterBannedAt: users.bannedAt,
    })
    .from(places)
    .leftJoin(users, eq(users.id, places.submittedBy))
    .where(eq(places.moderationStatus, "pending"))
    .orderBy(sql`${places.createdAt} ASC`)
    .limit(limit);

  return rows.map((row) => ({
    place: dbPlaceToUi(row.place),
    submitterBanned: Boolean(row.submitterBannedAt),
  }));
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
 * local. Llamar después de crear/borrar una reseña O después de banear/
 * unbanear un usuario que dejó reseñas.
 *
 * EXCLUYE reseñas de usuarios baneados — el ban es retroactivo en lecturas
 * públicas, así el rating reflejado coincide con las reseñas que el usuario
 * ve listadas (sin las del baneado).
 */
export async function recomputePlaceAggregates(placeId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  await db.execute(sql`
    UPDATE places p
    SET
      rating_avg = COALESCE((
        SELECT AVG(r.rating)::numeric(3,2)
        FROM reviews r
        JOIN users u ON u.id = r.author_id
        WHERE r.place_id = ${placeId} AND u.banned_at IS NULL
      ), NULL),
      review_count = (
        SELECT COUNT(*)::int
        FROM reviews r
        JOIN users u ON u.id = r.author_id
        WHERE r.place_id = ${placeId} AND u.banned_at IS NULL
      ),
      updated_at = NOW()
    WHERE p.id = ${placeId}
  `);
}

/**
 * Recompute agregados de TODOS los places donde un usuario dejó reseñas.
 * Usado al banear/unbanear, para que el rating público quede consistente
 * con las reseñas visibles después del cambio de estado del usuario.
 */
export async function recomputePlacesForUser(userId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  // 1 query por place (en serie). Si llegamos a usuarios prolíficos con
  // muchos places, mover a un solo UPDATE con CTE.
  const rows = await db.execute<{ place_id: string }>(sql`
    SELECT DISTINCT place_id FROM reviews WHERE author_id = ${userId}
  `);

  for (const row of rows.rows) {
    await recomputePlaceAggregates(row.place_id);
  }
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
