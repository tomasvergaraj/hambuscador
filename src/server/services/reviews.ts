import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { places, reviews, users, type DbReview } from "@/server/db/schema";
import type { Review } from "@/types/place";
import { getReviewsByPlaceIdMock } from "./mock";
import { createNotification } from "./notifications";
import { recomputePlaceAggregates } from "./places";

// ============================================================================
// Conversión DB → UI
// ============================================================================

type DbReviewWithAuthor = DbReview & {
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
};

function dbReviewToUi(row: DbReviewWithAuthor): Review {
  const name = row.authorName ?? "Anónimo";
  const initials = computeInitials(name);
  return {
    id: row.id,
    placeId: row.placeId,
    authorId: row.authorId,
    authorName: name,
    authorInitials: initials,
    authorImage: row.authorImage,
    authorUsername: row.authorUsername,
    rating: row.rating,
    ratingsByAspect: {
      comida: row.aspectComida ?? row.rating,
      atencion: row.aspectAtencion ?? row.rating,
      ambiente: row.aspectAmbiente ?? row.rating,
    },
    text: row.text,
    photos: row.photos,
    createdAt: row.createdAt.toISOString(),
  };
}

function computeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

// ============================================================================
// API pública
// ============================================================================

/**
 * Reseñas de un local, más recientes primero.
 */
export async function getReviewsByPlaceId(
  placeId: string,
  opts?: { limit?: number; excludeAuthorId?: string },
): Promise<Review[]> {
  if (!isDbConfigured()) {
    return getReviewsByPlaceIdMock(placeId);
  }

  const { limit = 20, excludeAuthorId } = opts ?? {};
  const db = getDb();

  // INNER JOIN + filter banned: si el autor está baneado, su reseña queda
  // oculta del listado público (ban retroactivo en lectura). El agregado
  // `places.rating_avg` se mantiene consistente porque `banUser` dispara
  // `recomputePlacesForUser` que excluye baneados.
  //
  // `excludeAuthorId` permite a la detail page traer "otras" reseñas sin
  // contar la del usuario logueado (que se fetchea aparte con getMyReviewForPlace).
  const whereClauses = [eq(reviews.placeId, placeId), isNull(users.bannedAt)];
  if (excludeAuthorId) {
    whereClauses.push(ne(reviews.authorId, excludeAuthorId));
  }
  const rows = await db
    .select({
      id: reviews.id,
      placeId: reviews.placeId,
      authorId: reviews.authorId,
      rating: reviews.rating,
      aspectComida: reviews.aspectComida,
      aspectAtencion: reviews.aspectAtencion,
      aspectAmbiente: reviews.aspectAmbiente,
      text: reviews.text,
      photos: reviews.photos,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      authorName: users.name,
      authorImage: users.image,
      authorUsername: users.username,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.authorId, users.id))
    .where(and(...whereClauses))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  return rows.map((row) => dbReviewToUi(row));
}

/**
 * Crea una reseña y actualiza los agregados denormalizados del local.
 * Tira si el usuario ya reseñó este local (constraint de unique index).
 */
export async function createReview(input: {
  placeId: string;
  authorId: string;
  rating: number;
  aspectComida?: number;
  aspectAtencion?: number;
  aspectAmbiente?: number;
  text?: string;
  photos?: string[];
}): Promise<DbReview> {
  if (!isDbConfigured()) {
    throw new Error("createReview requiere DATABASE_URL — no se puede ejecutar en modo mock.");
  }

  if (input.rating < 1 || input.rating > 5) {
    throw new Error("rating debe estar entre 1 y 5");
  }

  const db = getDb();

  // Tx: insert review + recompute place aggregates + bump user.review_count
  const result = await db.transaction(async (tx) => {
    const [review] = await tx
      .insert(reviews)
      .values({
        placeId: input.placeId,
        authorId: input.authorId,
        rating: input.rating,
        aspectComida: input.aspectComida ?? null,
        aspectAtencion: input.aspectAtencion ?? null,
        aspectAmbiente: input.aspectAmbiente ?? null,
        text: input.text ?? null,
        photos: input.photos ?? [],
      })
      .returning();

    if (!review) throw new Error("INSERT review no retornó fila");

    // Bump user counter
    await tx
      .update(users)
      .set({ reviewCount: sql`${users.reviewCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, input.authorId));

    return review;
  });

  // Recompute fuera de la tx para mantenerla corta
  await recomputePlaceAggregates(input.placeId);

  // Notificación al owner del local (si está reclamado y no es el mismo
  // reviewer). Fire-and-forget: un error acá no debe romper la reseña que
  // ya está commiteada en la DB.
  void notifyOwnerOfReview({
    placeId: input.placeId,
    authorId: input.authorId,
    reviewId: result.id,
    rating: input.rating,
    snippet: input.text ?? null,
  }).catch((err) => {
    console.error("[notifyOwnerOfReview]", err);
  });

  return result;
}

/**
 * Si el local está reclamado y el reviewer no es el owner, crea una
 * notificación al owner. Lee place + user en una sola query (LEFT JOIN sobre
 * places, INNER JOIN sobre el author para sacar el name/username).
 */
async function notifyOwnerOfReview(input: {
  placeId: string;
  authorId: string;
  reviewId: string;
  rating: number;
  snippet: string | null;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();

  const [row] = await db
    .select({
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      comunaSlug: places.comunaSlug,
      claimedBy: places.claimedBy,
      authorName: users.name,
      authorImage: users.image,
      authorUsername: users.username,
    })
    .from(places)
    .innerJoin(users, eq(users.id, input.authorId))
    .where(eq(places.id, input.placeId))
    .limit(1);

  if (!row) return;
  if (!row.claimedBy) return; // sin owner — nadie a quien avisar
  if (row.claimedBy === input.authorId) return; // owner reseña su propio local — no spam

  await createNotification({
    userId: row.claimedBy,
    type: "review_on_owned_place",
    payload: {
      placeId: row.placeId,
      placeName: row.placeName,
      placeSlug: row.placeSlug,
      comunaSlug: row.comunaSlug,
      reviewId: input.reviewId,
      rating: input.rating,
      reviewerName: row.authorName ?? "Anónimo",
      reviewerImage: row.authorImage,
      reviewerUsername: row.authorUsername,
      snippet: input.snippet ? input.snippet.slice(0, 140) : null,
    },
  });
}

export type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  photos: string[];
  createdAt: Date;
  author: {
    id: string;
    name: string;
    initials: string;
    image: string | null;
    username: string | null;
  };
  place: {
    id: string;
    name: string;
    slug: string;
    comunaSlug: string;
    comunaLabel: string;
    region: string;
  };
};

/**
 * Lookup público de una reseña por id, con su autor y local. null si no
 * existe o si el autor está baneado (coherente con el ban retroactivo).
 * Para `/r/[id]` y la OG dinámica.
 */
export async function getReviewById(reviewId: string): Promise<PublicReview | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      photos: reviews.photos,
      createdAt: reviews.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorImage: users.image,
      authorUsername: users.username,
      authorBannedAt: users.bannedAt,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      placeComunaSlug: places.comunaSlug,
      placeComunaLabel: places.comunaLabel,
      placeRegion: places.region,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .innerJoin(places, eq(places.id, reviews.placeId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!row || row.authorBannedAt) return null;

  const name = row.authorName ?? "Anónimo";
  return {
    id: row.id,
    rating: row.rating,
    text: row.text,
    photos: row.photos,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      name,
      initials: computeInitials(name),
      image: row.authorImage,
      username: row.authorUsername,
    },
    place: {
      id: row.placeId,
      name: row.placeName,
      slug: row.placeSlug,
      comunaSlug: row.placeComunaSlug,
      comunaLabel: row.placeComunaLabel,
      region: row.placeRegion,
    },
  };
}

/**
 * Reseña del usuario en este local (si existe). null si no hay.
 * No usa cache — depende de la sesión.
 *
 * Retorna `DbReview` crudo — usado por el flow de calificar (edit/upsert)
 * que necesita los aspect ratings con su semántica NULL preservada
 * (NULL = no calificado, !== rating overall).
 */
export async function getMyReviewForPlace(
  placeId: string,
  userId: string,
): Promise<DbReview | null> {
  if (!isDbConfigured()) return null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.placeId, placeId), eq(reviews.authorId, userId)))
    .limit(1);

  return row ?? null;
}

/**
 * Variante con JOIN a `users` para renderizar "tu reseña" en la ficha del
 * local sin tener que buscarla en el array paginado de reseñas. Útil cuando
 * la lista de reseñas se trae con `excludeAuthorId` y un `limit` chico —
 * la reseña propia se trae aparte con este método.
 */
export async function getMyReviewWithAuthor(
  placeId: string,
  userId: string,
): Promise<Review | null> {
  if (!isDbConfigured()) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: reviews.id,
      placeId: reviews.placeId,
      authorId: reviews.authorId,
      rating: reviews.rating,
      aspectComida: reviews.aspectComida,
      aspectAtencion: reviews.aspectAtencion,
      aspectAmbiente: reviews.aspectAmbiente,
      text: reviews.text,
      photos: reviews.photos,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      authorName: users.name,
      authorImage: users.image,
      authorUsername: users.username,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.authorId, users.id))
    .where(and(eq(reviews.placeId, placeId), eq(reviews.authorId, userId)))
    .limit(1);

  return row ? dbReviewToUi(row) : null;
}

/**
 * Edita una reseña existente. Solo el autor puede editar la suya.
 * Recalcula los agregados del local.
 */
export async function updateReview(input: {
  reviewId: string;
  byUserId: string;
  rating: number;
  aspectComida?: number;
  aspectAtencion?: number;
  aspectAmbiente?: number;
  text?: string;
  photos?: string[];
}): Promise<DbReview> {
  if (!isDbConfigured()) {
    throw new Error("updateReview requiere DATABASE_URL — no se puede ejecutar en modo mock.");
  }

  if (input.rating < 1 || input.rating > 5) {
    throw new Error("rating debe estar entre 1 y 5");
  }

  const db = getDb();

  const [existing] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  if (!existing) throw new Error("Reseña no encontrada");
  if (existing.authorId !== input.byUserId) {
    throw new Error("Solo el autor puede editar su reseña");
  }

  const [updated] = await db
    .update(reviews)
    .set({
      rating: input.rating,
      aspectComida: input.aspectComida ?? null,
      aspectAtencion: input.aspectAtencion ?? null,
      aspectAmbiente: input.aspectAmbiente ?? null,
      text: input.text ?? null,
      photos: input.photos ?? [],
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, input.reviewId))
    .returning();

  if (!updated) throw new Error("UPDATE review no retornó fila");

  await recomputePlaceAggregates(existing.placeId);

  return updated;
}

// ============================================================================
// Admin / moderación
// ============================================================================

export type AdminReviewItem = {
  id: string;
  rating: number;
  text: string | null;
  photos: string[];
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  place: {
    id: string;
    name: string;
    slug: string;
    comunaSlug: string;
    comunaLabel: string;
  };
};

export type ReviewCursor = { createdAt: string; id: string };
export type AdminReviewsPage = {
  items: AdminReviewItem[];
  nextCursor: ReviewCursor | null;
};

/**
 * Cursor-based pagination de reseñas para el panel admin.
 *
 * Orden estable por `(created_at DESC, id DESC)` — el id desempata cuando
 * dos reseñas se crean en el mismo timestamp (raro pero posible). El
 * índice `reviews_created_at_idx` cubre exactamente este orden, así que
 * la query es O(log N) sin importar la profundidad de la página.
 *
 * El cursor codifica la última fila visible. La página siguiente se pide
 * con esa info y filtra `(created_at, id) < cursor` para saltar lo ya
 * mostrado sin OFFSET.
 */
export async function getRecentReviews(opts?: {
  limit?: number;
  cursor?: ReviewCursor | null;
}): Promise<AdminReviewsPage> {
  if (!isDbConfigured()) return { items: [], nextCursor: null };

  const { limit = 25, cursor } = opts ?? {};
  const db = getDb();

  // Pedimos limit+1 para saber si hay siguiente página sin un count separado
  const lookahead = limit + 1;

  const cursorCondition = cursor
    ? sql`(${reviews.createdAt}, ${reviews.id}) < (${new Date(cursor.createdAt)}, ${cursor.id}::uuid)`
    : sql`TRUE`;

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      photos: reviews.photos,
      createdAt: reviews.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorEmail: users.email,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      placeComunaSlug: places.comunaSlug,
      placeComunaLabel: places.comunaLabel,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .innerJoin(places, eq(places.id, reviews.placeId))
    .where(cursorCondition)
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(lookahead);

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible[visible.length - 1];
  const nextCursor: ReviewCursor | null =
    hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;

  const items: AdminReviewItem[] = visible.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    photos: r.photos,
    createdAt: r.createdAt,
    author: {
      id: r.authorId,
      name: r.authorName,
      email: r.authorEmail,
    },
    place: {
      id: r.placeId,
      name: r.placeName,
      slug: r.placeSlug,
      comunaSlug: r.placeComunaSlug,
      comunaLabel: r.placeComunaLabel,
    },
  }));

  return { items, nextCursor };
}

/**
 * Borra una reseña sin chequear autoría — para uso desde el panel admin.
 * Decrementa el contador del autor y recalcula los agregados del local.
 */
export async function deleteReviewAsAdmin(reviewId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) return;

  await db.transaction(async (tx) => {
    await tx.delete(reviews).where(eq(reviews.id, reviewId));
    await tx
      .update(users)
      .set({ reviewCount: sql`GREATEST(${users.reviewCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(users.id, review.authorId));
  });

  await recomputePlaceAggregates(review.placeId);
}

/**
 * Borra una reseña (soft / hard a definir). Por ahora hard delete.
 * TODO Fase 5: soft delete con `deleted_at` para auditoría.
 */
export async function deleteReview(reviewId: string, byUserId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();

  // Verificar autoría
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) return;
  if (review.authorId !== byUserId) {
    throw new Error("Solo el autor puede borrar su reseña");
  }

  await db.transaction(async (tx) => {
    await tx.delete(reviews).where(eq(reviews.id, reviewId));
    await tx
      .update(users)
      .set({ reviewCount: sql`GREATEST(${users.reviewCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(users.id, byUserId));
  });

  await recomputePlaceAggregates(review.placeId);
}
