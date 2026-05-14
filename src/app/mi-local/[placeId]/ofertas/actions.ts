"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import {
  createPromotion,
  deletePromotion,
  getPromotionById,
  updatePromotion,
} from "@/server/services/promotions";
import { hasActiveTier } from "@/server/services/subscriptions";

const kinds = ["percent_discount", "featured_product", "combo"] as const;

const baseSchema = z.object({
  kind: z.enum(kinds),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  discountPct: z.coerce.number().int().min(1).max(99).optional().nullable(),
  photoUrl: z.string().trim().url().optional().or(z.literal("")),
  startsAt: z.string().optional(),
  endsAt: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
});

async function authorizeOwnerWithTier(
  userId: string,
  placeId: string,
): Promise<void> {
  const owner = await isOwnerOf(userId, placeId);
  if (!owner) throw new Error("no eres dueño de este local");
  const [hasPromo, hasPremium] = await Promise.all([
    hasActiveTier(placeId, "promo"),
    hasActiveTier(placeId, "premium"),
  ]);
  if (!hasPromo && !hasPremium) {
    throw new Error("requiere sub tier 'promo' o 'premium' activa");
  }
}

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export async function ownerCreatePromotionAction(
  placeId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  await authorizeOwnerWithTier(session.user.id, placeId);

  const parsed = baseSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    discountPct: formData.get("discountPct") || null,
    photoUrl: formData.get("photoUrl") || "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    throw new Error(
      "datos inválidos: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  await createPromotion({
    placeId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    discountPct: parsed.data.discountPct ?? null,
    photoUrl: parsed.data.photoUrl || null,
    startsAt: parseDate(parsed.data.startsAt, new Date()),
    endsAt: parseDate(parsed.data.endsAt, new Date(Date.now() + 30 * 86400 * 1000)),
    // Owner-created → pending. Admin las modera en /admin/ofertas.
    moderationStatus: "pending",
    createdBy: session.user.id,
  });

  revalidateTag("places");
  revalidatePath(`/mi-local/${placeId}/ofertas`);
  redirect(`/mi-local/${placeId}/ofertas`);
}

export async function ownerUpdatePromotionAction(
  placeId: string,
  promoId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  await authorizeOwnerWithTier(session.user.id, placeId);

  // Confirmar que la promo pertenece al place del owner.
  const promo = await getPromotionById(promoId);
  if (!promo || promo.placeId !== placeId) {
    throw new Error("oferta no encontrada");
  }

  const parsed = baseSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    discountPct: formData.get("discountPct") || null,
    photoUrl: formData.get("photoUrl") || "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    throw new Error(
      "datos inválidos: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  await updatePromotion(promoId, {
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    discountPct: parsed.data.discountPct ?? null,
    photoUrl: parsed.data.photoUrl || null,
    startsAt: parseDate(parsed.data.startsAt, new Date()),
    endsAt: parseDate(parsed.data.endsAt, new Date(Date.now() + 30 * 86400 * 1000)),
    isActive: parsed.data.isActive ?? true,
    // Cambios del owner → requieren re-aprobación admin.
    moderationStatus: "pending",
  });

  revalidateTag("places");
  revalidatePath(`/mi-local/${placeId}/ofertas`);
}

export async function ownerDeletePromotionAction(
  placeId: string,
  promoId: string,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  const owner = await isOwnerOf(session.user.id, placeId);
  if (!owner) throw new Error("no eres dueño de este local");

  const promo = await getPromotionById(promoId);
  if (!promo || promo.placeId !== placeId) {
    throw new Error("oferta no encontrada");
  }

  await deletePromotion(promoId);
  revalidateTag("places");
  revalidatePath(`/mi-local/${placeId}/ofertas`);
}
