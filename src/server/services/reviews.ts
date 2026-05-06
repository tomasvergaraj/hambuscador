import { desc, eq, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { reviews, users, type DbReview } from "@/server/db/schema";
import type { Review } from "@/types/place";
import { getReviewsByPlaceIdMock } from "./mock";
import { recomputePlaceAggregates } from "./places";

// ============================================================================
// Conversión DB → UI
// ============================================================================

type DbReviewWithAuthor = DbReview & {
  authorName: string | null;
  authorImage: string | null;
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
  opts?: { limit?: number },
): Promise<Review[]> {
  if (!isDbConfigured()) {
    return getReviewsByPlaceIdMock(placeId);
  }

  const { limit = 20 } = opts ?? {};
  const db = getDb();

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
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.authorId, users.id))
    .where(eq(reviews.placeId, placeId))
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

  return result;
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
