"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import {
  createReview,
  deleteReview,
  getMyReviewForPlace,
  updateReview,
} from "@/server/services/reviews";

// 1..5 obligatorio (rating general)
const ratingField = z.coerce.number().int().min(1, "Toca una estrella").max(5);

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
  photos: z.array(z.string().url()).max(4, "Máximo 4 fotos").default([]),
});

export type SubmitReviewState = {
  error?: string;
};

/**
 * Publica o edita una reseña (upsert). Validaciones en orden:
 * 1. DB configurada (modo demo no soporta escrituras).
 * 2. Sesión activa (sino redirect a login).
 * 3. Schema válido.
 * 4. Si el usuario ya reseñó este local → updateReview. Sino → createReview.
 *
 * En éxito: revalida `/[comuna]/[slug]` y redirige al detalle del local.
 */
export async function submitReview(
  _prev: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  if (!isDbConfigured()) {
    return {
      error: "Modo demo: publicar reseñas requiere DATABASE_URL. Inicia la DB con pnpm db:up.",
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
    photos: formData.getAll("photos").filter((v): v is string => typeof v === "string"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Upsert: si ya existe reseña del usuario en este local, editar; sino crear.
  const existing = await getMyReviewForPlace(parsed.data.placeId, session.user.id);

  if (existing) {
    await updateReview({
      reviewId: existing.id,
      byUserId: session.user.id,
      rating: parsed.data.rating,
      aspectComida: parsed.data.aspect_comida,
      aspectAtencion: parsed.data.aspect_atencion,
      aspectAmbiente: parsed.data.aspect_ambiente,
      text: parsed.data.text,
      photos: parsed.data.photos,
    });
  } else {
    await createReview({
      placeId: parsed.data.placeId,
      authorId: session.user.id,
      rating: parsed.data.rating,
      aspectComida: parsed.data.aspect_comida,
      aspectAtencion: parsed.data.aspect_atencion,
      aspectAmbiente: parsed.data.aspect_ambiente,
      text: parsed.data.text,
      photos: parsed.data.photos,
    });
  }

  revalidateTag("reviews");
  revalidateTag("places");
  revalidatePath(`/${parsed.data.comuna}/${parsed.data.slug}`);
  redirect(`/${parsed.data.comuna}/${parsed.data.slug}`);
}

const deleteSchema = z.object({
  reviewId: z.string().uuid("reviewId inválido"),
  comuna: z.string().min(1),
  slug: z.string().min(1),
});

/**
 * Borra la reseña propia del usuario. Llamada como Server Action desde un
 * form en la página de detalle. No retorna estado — éxito = redirect/refresh.
 */
export async function deleteMyReview(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const parsed = deleteSchema.safeParse({
    reviewId: formData.get("reviewId"),
    comuna: formData.get("comuna"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  await deleteReview(parsed.data.reviewId, session.user.id);

  revalidateTag("reviews");
  revalidateTag("places");
  revalidatePath(`/${parsed.data.comuna}/${parsed.data.slug}`);
}
