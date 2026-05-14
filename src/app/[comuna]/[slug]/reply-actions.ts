"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/server/auth";
import { getDb, isDbConfigured } from "@/server/db/client";
import { reviews } from "@/server/db/schema";
import { eq } from "drizzle-orm";

import { isOwnerOf } from "@/server/services/claims";
import { hasActivePremium } from "@/server/services/subscriptions";
import {
  deleteReply,
  upsertReply,
} from "@/server/services/review-replies";

const upsertSchema = z.object({
  reviewId: z.string().uuid(),
  placeId: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
});

async function authorizeOwnerPremium(userId: string, placeId: string) {
  const [owner, premium] = await Promise.all([
    isOwnerOf(userId, placeId),
    hasActivePremium(placeId),
  ]);
  if (!owner) throw new Error("no autorizado: no eres dueño del local");
  if (!premium) throw new Error("requiere tier premium activo");
}

export async function upsertReplyAction(formData: FormData) {
  if (!isDbConfigured()) throw new Error("upsertReply requiere DATABASE_URL");
  const session = await auth();
  if (!session?.user?.id) throw new Error("requiere sesión");

  const parsed = upsertSchema.safeParse({
    reviewId: formData.get("reviewId"),
    placeId: formData.get("placeId"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    throw new Error("datos inválidos: " + parsed.error.issues[0]?.message);
  }

  await authorizeOwnerPremium(session.user.id, parsed.data.placeId);

  // Defensa extra: confirmar que la review pertenece al place declarado.
  const db = getDb();
  const [row] = await db
    .select({ placeId: reviews.placeId })
    .from(reviews)
    .where(eq(reviews.id, parsed.data.reviewId))
    .limit(1);
  if (!row || row.placeId !== parsed.data.placeId) {
    throw new Error("reseña no encontrada o no pertenece al local");
  }

  await upsertReply({
    reviewId: parsed.data.reviewId,
    placeId: parsed.data.placeId,
    authorId: session.user.id,
    text: parsed.data.text,
  });

  // Invalida la ficha pública (reply visible) y el permalink de la review.
  revalidatePath(`/r/${parsed.data.reviewId}`);
  // No tenemos comuna/slug acá — el server component los lee. Revalidamos
  // la home y /buscar conservadores; el detail page tiene revalidate corto.
}

export async function deleteReplyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("requiere sesión");
  const reviewId = formData.get("reviewId");
  if (typeof reviewId !== "string" || !reviewId) {
    throw new Error("reviewId requerido");
  }

  if (!isDbConfigured()) return;
  const db = getDb();
  const [row] = await db
    .select({ placeId: reviews.placeId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  if (!row) throw new Error("reseña no encontrada");

  await authorizeOwnerPremium(session.user.id, row.placeId);
  await deleteReply(reviewId);
  revalidatePath(`/r/${reviewId}`);
}
