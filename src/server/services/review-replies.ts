import { eq, inArray } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { reviewReplies, type DbReviewReply } from "@/server/db/schema";

// ============================================================================
// review-replies service — owner premium responde reseñas de su local.
// Una sola reply por review (PK = review_id). Borrar la reseña casca la
// reply via ON DELETE CASCADE.
// ============================================================================

export async function getRepliesForReviewIds(
  reviewIds: string[],
): Promise<Map<string, DbReviewReply>> {
  if (!isDbConfigured() || reviewIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select()
    .from(reviewReplies)
    .where(inArray(reviewReplies.reviewId, reviewIds));
  return new Map(rows.map((r) => [r.reviewId, r]));
}

export async function getReplyForReview(reviewId: string): Promise<DbReviewReply | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(reviewReplies)
    .where(eq(reviewReplies.reviewId, reviewId))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert: si ya existe reply para la review, la actualiza; si no, la crea.
 * Caller debe validar autorización (owner premium del place) ANTES.
 */
export async function upsertReply(input: {
  reviewId: string;
  placeId: string;
  authorId: string;
  text: string;
}): Promise<DbReviewReply> {
  if (!isDbConfigured()) {
    throw new Error("upsertReply requiere DATABASE_URL");
  }
  const db = getDb();
  const [row] = await db
    .insert(reviewReplies)
    .values({
      reviewId: input.reviewId,
      placeId: input.placeId,
      authorId: input.authorId,
      text: input.text,
    })
    .onConflictDoUpdate({
      target: reviewReplies.reviewId,
      set: { text: input.text, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new Error("upsertReply: no row returned");
  return row;
}

export async function deleteReply(reviewId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db.delete(reviewReplies).where(eq(reviewReplies.reviewId, reviewId));
}
