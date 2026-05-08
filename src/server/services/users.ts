import bcrypt from "bcryptjs";
import { count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  favorites,
  places,
  reviews,
  users,
  type DbUser,
  type PlaceModerationStatus,
  type UserRole,
} from "@/server/db/schema";

// ============================================================================
// API pública del servicio de usuarios
// ----------------------------------------------------------------------------
// Se complementa con `@/server/auth` (Auth.js v5). Acá vive solo lo que toca
// la tabla `users` directamente: registro con password y lookups útiles.
// ============================================================================

const BCRYPT_ROUNDS = 12;

export class UserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Ya existe una cuenta para ${email}`);
    this.name = "UserAlreadyExistsError";
  }
}

/**
 * Crea un usuario con email + password. La password se guarda hasheada
 * (bcrypt). Tira `UserAlreadyExistsError` si el email ya está registrado.
 *
 * No inicia sesión — eso lo hace la Server Action que llama después a
 * `signIn("credentials", ...)` con las mismas credenciales.
 */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<DbUser> {
  if (!isDbConfigured()) {
    throw new Error("createUser requiere DATABASE_URL — no se puede ejecutar en modo demo.");
  }

  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new UserAlreadyExistsError(email);

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const [row] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      hashedPassword,
    })
    .returning();

  if (!row) throw new Error("INSERT user no retornó fila");
  return row;
}

/**
 * Devuelve el usuario por id, o null si no existe. Útil para hidratar la
 * sesión en pages que necesitan más data que la del JWT.
 */
export async function getUserById(id: string): Promise<DbUser | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export type PublicUserSuggestion = {
  username: string;
  name: string;
  reviewCount: number;
};

/**
 * Búsqueda de perfiles públicos para el dropdown global. Match por username
 * (ASCII) o name. Solo retorna usuarios CON username (los privados quedan
 * fuera) y NO baneados. Limit chico (4) — no es el caso primario del dropdown.
 */
export async function searchPublicUsers(
  query: string,
  opts?: { limit?: number },
): Promise<PublicUserSuggestion[]> {
  if (!isDbConfigured()) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { limit = 4 } = opts ?? {};

  const db = getDb();
  // Strip @ inicial si el user lo tipeó.
  const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const pattern = `%${normalized.toLowerCase()}%`;

  const rows = await db
    .select({
      username: users.username,
      name: users.name,
      reviewCount: users.reviewCount,
    })
    .from(users)
    .where(
      sql`${users.username} IS NOT NULL
        AND ${users.bannedAt} IS NULL
        AND (
          LOWER(${users.username}) LIKE ${pattern}
          OR LOWER(${users.name}) LIKE ${pattern}
        )`,
    )
    .orderBy(desc(users.reviewCount))
    .limit(limit);

  return rows
    .filter((r): r is { username: string; name: string | null; reviewCount: number } =>
      Boolean(r.username),
    )
    .map((r) => ({
      username: r.username,
      name: r.name ?? `@${r.username}`,
      reviewCount: r.reviewCount,
    }));
}

/**
 * Lookup por username público. Excluye baneados (coherente con el ban
 * retroactivo en lecturas públicas). Para `/u/[username]`.
 */
export async function getUserByUsername(username: string): Promise<DbUser | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!row || row.bannedAt) return null;
  return row;
}

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`@${username} ya está en uso`);
    this.name = "UsernameTakenError";
  }
}

const USERNAME_REGEX = /^[a-z0-9_-]+$/;

/**
 * Setea o actualiza el username público del usuario. Valida formato (ASCII
 * lowercase, 3-30 chars, _ y - permitidos) y unicidad. El username habilita
 * `/u/<username>` como perfil público; sin username, el usuario es privado.
 */
export async function setUsername(userId: string, raw: string): Promise<void> {
  if (!isDbConfigured()) throw new Error("setUsername requiere DATABASE_URL");
  const username = raw.trim().toLowerCase();
  if (username.length < 3 || username.length > 30) {
    throw new Error("El username debe tener entre 3 y 30 caracteres");
  }
  if (!USERNAME_REGEX.test(username)) {
    throw new Error("Solo letras a-z, números, _ y -");
  }

  const db = getDb();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (taken && taken.id !== userId) {
    throw new UsernameTakenError(username);
  }

  await db
    .update(users)
    .set({ username, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export type UserStats = {
  reviewCount: number;
  favoriteCount: number;
  placeCount: number;
};

/**
 * Conteos para el perfil. `reviewCount` viene del contador denormalizado;
 * `favoriteCount` y `placeCount` se calculan con count(*). Con
 * `approvedOnly: true` el `placeCount` cuenta solo aportes aprobados —
 * usado por `/u/[username]` para no exponer pending/rejected ajenos.
 *
 * En modo demo retorna ceros — la page de perfil ya redirige a login antes
 * de llegar acá, así que es solo defensivo.
 */
export async function getUserStats(
  userId: string,
  opts?: { approvedOnly?: boolean },
): Promise<UserStats> {
  if (!isDbConfigured()) {
    return { reviewCount: 0, favoriteCount: 0, placeCount: 0 };
  }

  const db = getDb();
  const placesFilter = opts?.approvedOnly
    ? sql`${places.submittedBy} = ${userId} AND ${places.moderationStatus} = 'approved'`
    : eq(places.submittedBy, userId);

  const [userRow, favRow, placeRow] = await Promise.all([
    db
      .select({ reviewCount: users.reviewCount })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ count: count() })
      .from(favorites)
      .where(eq(favorites.userId, userId)),
    db.select({ count: count() }).from(places).where(placesFilter),
  ]);

  return {
    reviewCount: userRow[0]?.reviewCount ?? 0,
    favoriteCount: Number(favRow[0]?.count ?? 0),
    placeCount: Number(placeRow[0]?.count ?? 0),
  };
}

// ============================================================================
// Listas de actividad para /perfil
// ============================================================================

type PlaceLink = {
  id: string;
  name: string;
  slug: string;
  comunaSlug: string;
  comunaLabel: string;
};

export type MyReviewItem = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: Date;
  place: PlaceLink;
};

export type MyFavoriteItem = {
  createdAt: Date;
  place: PlaceLink & {
    ratingAvg: string | null;
    reviewCount: number;
  };
};

export type MySubmissionItem = {
  id: string;
  name: string;
  slug: string;
  comunaSlug: string;
  comunaLabel: string;
  moderationStatus: PlaceModerationStatus;
  createdAt: Date;
};

/**
 * Reseñas del usuario, más recientes primero, con el local al que apuntan
 * para poder linkear a la ficha pública.
 */
export async function getMyReviews(userId: string): Promise<MyReviewItem[]> {
  if (!isDbConfigured()) return [];

  const db = getDb();
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      createdAt: reviews.createdAt,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      placeComunaSlug: places.comunaSlug,
      placeComunaLabel: places.comunaLabel,
    })
    .from(reviews)
    .innerJoin(places, eq(places.id, reviews.placeId))
    .where(eq(reviews.authorId, userId))
    .orderBy(desc(reviews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt,
    place: {
      id: r.placeId,
      name: r.placeName,
      slug: r.placeSlug,
      comunaSlug: r.placeComunaSlug,
      comunaLabel: r.placeComunaLabel,
    },
  }));
}

/**
 * Favoritos del usuario, más recientes primero. Incluye rating del local
 * para mostrar en la card.
 */
export async function getMyFavorites(userId: string): Promise<MyFavoriteItem[]> {
  if (!isDbConfigured()) return [];

  const db = getDb();
  const rows = await db
    .select({
      createdAt: favorites.createdAt,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      placeComunaSlug: places.comunaSlug,
      placeComunaLabel: places.comunaLabel,
      ratingAvg: places.ratingAvg,
      reviewCount: places.reviewCount,
    })
    .from(favorites)
    .innerJoin(places, eq(places.id, favorites.placeId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  return rows.map((r) => ({
    createdAt: r.createdAt,
    place: {
      id: r.placeId,
      name: r.placeName,
      slug: r.placeSlug,
      comunaSlug: r.placeComunaSlug,
      comunaLabel: r.placeComunaLabel,
      ratingAvg: r.ratingAvg,
      reviewCount: r.reviewCount,
    },
  }));
}

/**
 * Locales que el usuario aportó. Por defecto todos los estados de moderación
 * (para `/perfil` propio). Con `approvedOnly: true` solo aprobados — usado
 * por el perfil público `/u/[username]`, donde pending/rejected son privados.
 */
export async function getMySubmissions(
  userId: string,
  opts?: { approvedOnly?: boolean },
): Promise<MySubmissionItem[]> {
  if (!isDbConfigured()) return [];

  const db = getDb();
  const filter = opts?.approvedOnly
    ? sql`${places.submittedBy} = ${userId} AND ${places.moderationStatus} = 'approved'`
    : eq(places.submittedBy, userId);

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      slug: places.slug,
      comunaSlug: places.comunaSlug,
      comunaLabel: places.comunaLabel,
      moderationStatus: places.moderationStatus,
      createdAt: places.createdAt,
    })
    .from(places)
    .where(filter)
    .orderBy(desc(places.createdAt));

  return rows;
}

// ============================================================================
// Admin / gestión de usuarios
// ============================================================================

export type AdminUserItem = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  reviewCount: number;
  bannedAt: Date | null;
  createdAt: Date;
};

export type UserCursor = { createdAt: string; id: string };
export type AdminUsersPage = {
  items: AdminUserItem[];
  nextCursor: UserCursor | null;
};

/**
 * Listado paginado de usuarios para /admin/usuarios. Cursor-based en
 * (created_at desc, id desc) para escalar. `q` filtra por email/nombre.
 */
export async function getAdminUsers(opts?: {
  limit?: number;
  cursor?: UserCursor | null;
  q?: string;
}): Promise<AdminUsersPage> {
  if (!isDbConfigured()) return { items: [], nextCursor: null };

  const { limit = 25, cursor, q } = opts ?? {};
  const db = getDb();
  const lookahead = limit + 1;

  const conditions: import("drizzle-orm").SQL[] = [];
  if (cursor) {
    conditions.push(
      sql`(${users.createdAt}, ${users.id}) < (${new Date(cursor.createdAt)}, ${cursor.id}::uuid)`,
    );
  }
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    const orExpr = or(ilike(users.email, like), ilike(users.name, like));
    if (orExpr) conditions.push(orExpr);
  }

  const where =
    conditions.length === 0
      ? undefined
      : conditions.reduce<import("drizzle-orm").SQL>(
          (acc, c) => sql`${acc} AND ${c}`,
          sql`TRUE`,
        );

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      reviewCount: users.reviewCount,
      bannedAt: users.bannedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(lookahead);

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible[visible.length - 1];
  const nextCursor: UserCursor | null =
    hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  return { items: visible, nextCursor };
}

/**
 * ¿Está baneado el usuario? Helper rápido para el flujo de auth.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.bannedAt);
}

export async function banUser(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(users)
    .set({ bannedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
  // Recompute agregados de los places donde este user dejó reseñas — sus
  // reseñas se vuelven invisibles, el rating mostrado debe reflejarlo.
  const { recomputePlacesForUser } = await import("./places");
  await recomputePlacesForUser(userId);
}

export async function unbanUser(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(users)
    .set({ bannedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  // Las reseñas vuelven a ser visibles → recalcular rating con ellas adentro.
  const { recomputePlacesForUser } = await import("./places");
  await recomputePlacesForUser(userId);
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
