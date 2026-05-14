"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import {
  createPromotion,
  deletePromotion,
  updatePromotion,
} from "@/server/services/promotions";

const kinds = ["percent_discount", "featured_product", "combo"] as const;

const baseSchema = z.object({
  kind: z.enum(kinds),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  discountPct: z.coerce.number().int().min(1).max(99).optional().nullable(),
  photoUrl: z.string().trim().url().optional().or(z.literal("")),
  startsAt: z.string().optional(),
  endsAt: z.string().min(1, "fecha de término requerida"),
  isActive: z.coerce.boolean().optional(),
});

const createSchema = baseSchema.extend({
  placeId: z.string().uuid("local requerido"),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("no autorizado");
  }
  return session.user.id;
}

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export async function createPromotionAction(formData: FormData) {
  const adminId = await requireAdmin();
  const parsed = createSchema.safeParse({
    placeId: formData.get("placeId"),
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

  if (parsed.data.kind === "percent_discount" && !parsed.data.discountPct) {
    throw new Error("descuento % requiere valor");
  }

  await createPromotion({
    placeId: parsed.data.placeId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    discountPct: parsed.data.discountPct ?? null,
    photoUrl: parsed.data.photoUrl || null,
    startsAt: parseDate(parsed.data.startsAt, new Date()),
    endsAt: parseDate(parsed.data.endsAt, new Date(Date.now() + 30 * 86400 * 1000)),
    moderationStatus: "approved",
    createdBy: adminId,
  });

  revalidateTag("places");
  revalidatePath("/admin/ofertas");
  revalidatePath("/");
  redirect("/admin/ofertas");
}

export async function updatePromotionAction(
  promoId: string,
  formData: FormData,
) {
  await requireAdmin();
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
  });

  revalidateTag("places");
  revalidatePath("/admin/ofertas");
  revalidatePath(`/admin/ofertas/${promoId}`);
  revalidatePath("/");
}

export async function deletePromotionAction(promoId: string) {
  await requireAdmin();
  await deletePromotion(promoId);
  revalidateTag("places");
  revalidatePath("/admin/ofertas");
  revalidatePath("/");
  redirect("/admin/ofertas");
}
