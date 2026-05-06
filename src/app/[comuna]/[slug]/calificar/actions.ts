"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { createReview } from "@/server/services/reviews";

// 1..5 obligatorio (rating general)
const ratingField = z.coerce.number().int().min(1, "Tocá una estrella").max(5);

// 1..5 opcional para los aspectos. Aceptamos string vacío y 0 como "no setear".
const optionalAspect = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(5)])
  .transform((v) => (v === "" || v === 0 ? undefined : (v as number)));

const reviewSchema = z.object({
  placeId: z.string().uuid("placeId inválido"),
  comuna: z.string().min(1),
  slug: z.string().min(1),
  rating: ratingField,
  aspect_comida: optionalAspect,
  aspect_atencion: optionalAspect,
  aspect_ambiente: optionalAspect,
  text: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type SubmitReviewState = {
  error?: string;
};

/**
 * Publica una reseña. Validaciones en orden:
 * 1. DB configurada (modo demo no soporta escrituras).
 * 2. Sesión activa (sino redirect a login).
 * 3. Schema válido.
 * 4. createReview no tira por unique constraint (un usuario, una reseña por local).
 *
 * En éxito: revalida `/[comuna]/[slug]` y redirige al detalle del local.
 */
export async function submitReview(
  _prev: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  if (!isDbConfigured()) {
    return {
      error: "Modo demo: publicar reseñas requiere DATABASE_URL. Levantá la DB con pnpm db:up.",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const parsed = reviewSchema.safeParse({
    placeId: formData.get("placeId"),
    comuna: formData.get("comuna"),
    slug: formData.get("slug"),
    rating: formData.get("rating"),
    aspect_comida: formData.get("aspect_comida"),
    aspect_atencion: formData.get("aspect_atencion"),
    aspect_ambiente: formData.get("aspect_ambiente"),
    text: formData.get("text"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await createReview({
      placeId: parsed.data.placeId,
      authorId: session.user.id,
      rating: parsed.data.rating,
      aspectComida: parsed.data.aspect_comida,
      aspectAtencion: parsed.data.aspect_atencion,
      aspectAmbiente: parsed.data.aspect_ambiente,
      text: parsed.data.text,
      photos: [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    // Postgres 23505 = unique_violation (reviews_author_place_idx)
    if (msg.includes("23505") || msg.toLowerCase().includes("unique")) {
      return {
        error: "Ya publicaste una reseña en este local. La edición llega en una próxima versión.",
      };
    }
    throw error;
  }

  revalidatePath(`/${parsed.data.comuna}/${parsed.data.slug}`);
  redirect(`/${parsed.data.comuna}/${parsed.data.slug}`);
}
