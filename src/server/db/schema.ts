import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// Auth.js (next-auth v5) — tablas estándar requeridas por el adapter.
// Ver: https://authjs.dev/getting-started/adapters/drizzle
// ============================================================================

/**
 * Rol de usuario. `admin` accede a `/admin/*` (panel de moderación).
 * Para nombrar a alguien admin: `UPDATE users SET role = 'admin' WHERE email = '...'`
 * (después tiene que reloguearse para que el JWT recoja el nuevo rol).
 */
export const userRoleEnum = ["user", "admin"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),

  // Campos específicos de Hambuscador
  username: text("username").unique(), // ej. @camila — público en /u/camila
  hashedPassword: text("hashed_password"), // null si solo tiene OAuth
  bio: text("bio"),
  role: text("role", { enum: userRoleEnum }).notNull().default("user"),
  reviewCount: integer("review_count").notNull().default(0),

  /**
   * Si está seteado, el usuario está baneado y no puede iniciar sesión.
   * El ban es retroactivo en lecturas públicas: las reseñas se ocultan y
   * los agregados (rating_avg, review_count) se recalculan en banUser/
   * unbanUser. Los aportes (places submitidos) aprobados quedan visibles
   * porque la utilidad pública la da el local, no el submitter; los
   * pending llevan tag de advertencia en /admin/moderacion. Un admin
   * puede unban seteando a null y todo se restaura.
   */
  bannedAt: timestamp("banned_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ============================================================================
// Hambuscador — modelo del dominio
// ============================================================================

/**
 * Estado de moderación de un local.
 * - `pending`: agregado por usuario, esperando revisión
 * - `approved`: público y SEO-indexable
 * - `rejected`: oculto, queda para auditoría
 */
export const placeStatusEnum = ["pending", "approved", "rejected"] as const;
export type PlaceModerationStatus = (typeof placeStatusEnum)[number];

export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Identidad pública (URL: /[comuna_slug]/[slug])
    slug: text("slug").notNull(),
    name: text("name").notNull(),

    // Ubicación (parte legible)
    comunaSlug: text("comuna_slug").notNull(), // ej. "providencia"
    comunaLabel: text("comuna_label").notNull(), // ej. "Providencia"
    region: text("region").notNull(), // ej. "Región Metropolitana"
    address: text("address").notNull(),

    // Ubicación (parte numérica). El índice geográfico vive en una columna
    // generada llamada `location` definida en la migración inicial — Drizzle
    // no la modela directamente; se usa por SQL crudo en queries de cercanía.
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),

    // Detalles
    cuisines: text("cuisines").array().notNull().default(sql`'{}'::text[]`),
    specialty: text("specialty"),
    priceRange: text("price_range").notNull(), // "$" | "$$" | "$$$" | "$$$$"
    hoursWeekdays: text("hours_weekdays"),
    hoursWeekends: text("hours_weekends"),
    /**
     * Horario por día (lun..dom). Map<DayKey, "HH:MM-HH:MM" | null>.
     * Source of truth nuevo desde el wizard de /agregar; los campos
     * `hours_weekdays`/`hours_weekends` quedan como derivación legible
     * para los lectores que aún no leen esta columna.
     */
    hoursByDay: jsonb("hours_by_day").$type<Record<string, string | null>>(),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    instagram: text("instagram"),
    website: text("website"),
    /**
     * Logo de marca (URL pública en R2). Cuando está presente, reemplaza
     * el thumbnail de la PlaceCard compact (78×78) — un logo en formato
     * cuadrado lee mejor a ese tamaño que un crop de foto de comida.
     * El hero del detail page y el featured card siguen usando `photos`
     * (la primera foto) que es la cover natural.
     * Editable solo desde admin (locales reclamados / verificados).
     */
    logo: text("logo"),
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),

    // Moderación / autoría
    moderationStatus: text("moderation_status", { enum: placeStatusEnum })
      .notNull()
      .default("pending"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    claimedBy: uuid("claimed_by").references(() => users.id, { onDelete: "set null" }),
    isVerified: boolean("is_verified").notNull().default(false),
    /**
     * Local destacado por publicidad. Se renderiza con pin diferenciado en el
     * mapa y (futuro) prioridad sutil en listados. Solo togglable por admin.
     */
    isFeatured: boolean("is_featured").notNull().default(false),

    // Agregados denormalizados (se actualizan al insertar/borrar review)
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => ({
    // (comuna_slug, slug) es la URL pública — debe ser único
    comunaSlugIdx: uniqueIndex("places_comuna_slug_idx").on(table.comunaSlug, table.slug),
    statusIdx: index("places_moderation_status_idx").on(table.moderationStatus),
    nameIdx: index("places_name_idx").on(table.name),
  }),
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Rating overall + por aspecto (1..5)
    rating: integer("rating").notNull(),
    aspectComida: integer("aspect_comida"),
    aspectAtencion: integer("aspect_atencion"),
    aspectAmbiente: integer("aspect_ambiente"),

    text: text("text"),
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Un usuario solo puede tener una reseña por local
    uniqueAuthorPerPlaceIdx: uniqueIndex("reviews_author_place_idx").on(
      table.authorId,
      table.placeId,
    ),
    placeIdx: index("reviews_place_idx").on(table.placeId),
    authorIdx: index("reviews_author_idx").on(table.authorId),
    // Para paginación cursor en /admin/reseñas (orden estable por
    // (created_at desc, id desc)). Sin esto, a 100K filas la query
    // hace seq scan por cada página.
    createdAtIdx: index("reviews_created_at_idx").on(
      sql`${table.createdAt} DESC`,
      sql`${table.id} DESC`,
    ),
  }),
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.placeId] }),
  }),
);

/**
 * Solicitudes de claim — un dueño/representante reclama un local para
 * volverse owner. Admin revisa proof + aprueba/rechaza. Aprobar setea
 * `places.claimed_by` al user y `places.is_verified = true`.
 *
 * No hay UNIQUE strict para permitir reintentos: un user puede claim
 * el mismo local múltiples veces si la primera fue rechazada. La app
 * valida en runtime que no haya un pending del mismo (place_id, user_id).
 *
 * Migration: drizzle/2026-05-08-place-claims.sql
 */
export const claimStatusEnum = ["pending", "approved", "rejected"] as const;
export type ClaimStatus = (typeof claimStatusEnum)[number];

export const placeClaims = pgTable(
  "place_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: claimStatusEnum }).notNull().default("pending"),
    /** URL pública (R2) de imagen subida como prueba (cert SII, foto del local, etc). */
    proofUrl: text("proof_url"),
    /** Mensaje libre del usuario al admin. */
    message: text("message"),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    /** Razón de rechazo (opcional, para feedback al user). */
    rejectionReason: text("rejection_reason"),
  },
  (table) => ({
    placeIdx: index("place_claims_place_idx").on(table.placeId),
    statusIdx: index("place_claims_status_idx").on(table.status),
    userIdx: index("place_claims_user_idx").on(table.userId),
  }),
);

/**
 * Catálogo de comunas de Chile (346). Tabla seeded con metadata cartográfica
 * (centroide). Source of truth para el dropdown de `/agregar`, las sugerencias
 * de `/api/search/suggest` y los filtros server-rendered.
 *
 * `region_label` se denormaliza para que el match con `places.region` sea
 * directo (la columna `places.region` es text, no FK). `region_slug` es FK
 * a `regions` para joins con metadata cartográfica de la región.
 *
 * Migration: `drizzle/2026-05-08-comunas.sql`.
 */
export const comunas = pgTable(
  "comunas",
  {
    slug: text("slug").primaryKey(),
    label: text("label").notNull(),
    regionSlug: text("region_slug")
      .notNull()
      .references(() => regions.slug),
    regionLabel: text("region_label").notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  },
  (table) => ({
    regionSlugIdx: index("comunas_region_slug_idx").on(table.regionSlug),
  }),
);

/**
 * Catálogo de regiones de Chile (16). Tabla seeded con metadata cartográfica
 * estable: centroide aproximado + zoom sugerido para `flyTo` desde el buscador
 * del mapa. La derivación dinámica (qué regiones MOSTRAR como sugerencia)
 * matchea contra `places.region` (label exacto, ver INSERTs en
 * `drizzle/2026-05-08-regions.sql`). Cuando aporten un local en una región
 * sin presencia previa, aparece automáticamente como sugerencia.
 */
export const regions = pgTable("regions", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull().unique(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  zoom: integer("zoom").notNull(),
});

/**
 * Log de queries de /buscar. Una fila por visita (no por keystroke). Sirve
 * para detectar queries populares y queries sin resultado, que son la base
 * para nuevos sinónimos en `lib/search.ts`. Migración:
 * `drizzle/2026-05-08-search-logs.sql`.
 */
export const searchLogs = pgTable(
  "search_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Query tal como la tipeó el usuario (con tildes/case) — útil para mostrar muestras. */
    query: text("query").notNull(),
    /** Versión normalizada (lowercase + sin tildes) — clave de agregación. */
    normalizedQuery: text("normalized_query").notNull(),
    resultCount: integer("result_count").notNull(),
    /** True si la búsqueda strict dio 0 y el fallback fuzzy salvó el día. */
    usedFuzzy: boolean("used_fuzzy").notNull().default(false),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** "list" | "map" — vista de /buscar que disparó la búsqueda. */
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normalizedIdx: index("search_logs_normalized_idx").on(table.normalizedQuery),
    createdAtIdx: index("search_logs_created_at_idx").on(sql`${table.createdAt} DESC`),
  }),
);

// ============================================================================
// Tipos derivados — preferir estos antes que los de @/types/place cuando se
// está en la capa de DB/server. Los de @/types/place son para la UI.
// ============================================================================

export type DbUser = typeof users.$inferSelect;
export type DbPlace = typeof places.$inferSelect;
export type DbReview = typeof reviews.$inferSelect;
export type DbFavorite = typeof favorites.$inferSelect;
export type DbSearchLog = typeof searchLogs.$inferSelect;
export type DbRegion = typeof regions.$inferSelect;
export type DbComuna = typeof comunas.$inferSelect;
export type DbPlaceClaim = typeof placeClaims.$inferSelect;

export type NewDbPlace = typeof places.$inferInsert;
export type NewDbReview = typeof reviews.$inferInsert;
export type NewDbSearchLog = typeof searchLogs.$inferInsert;
export type NewDbPlaceClaim = typeof placeClaims.$inferInsert;
