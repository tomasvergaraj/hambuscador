import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
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
    phone: text("phone"),
    instagram: text("instagram"),
    website: text("website"),
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),

    // Moderación / autoría
    moderationStatus: text("moderation_status", { enum: placeStatusEnum })
      .notNull()
      .default("pending"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    claimedBy: uuid("claimed_by").references(() => users.id, { onDelete: "set null" }),
    isVerified: boolean("is_verified").notNull().default(false),

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

// ============================================================================
// Tipos derivados — preferir estos antes que los de @/types/place cuando se
// está en la capa de DB/server. Los de @/types/place son para la UI.
// ============================================================================

export type DbUser = typeof users.$inferSelect;
export type DbPlace = typeof places.$inferSelect;
export type DbReview = typeof reviews.$inferSelect;
export type DbFavorite = typeof favorites.$inferSelect;

export type NewDbPlace = typeof places.$inferInsert;
export type NewDbReview = typeof reviews.$inferInsert;
