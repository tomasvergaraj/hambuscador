"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import {
  cancelSubscription,
  createSubscription,
} from "@/server/services/subscriptions";

const createSchema = z.object({
  placeId: z.string().uuid("placeId inválido"),
  tier: z.enum(["featured", "premium"]).default("featured"),
  amountClp: z.coerce.number().int().nonnegative().max(10_000_000),
  periodDays: z.coerce.number().int().min(1).max(365),
  notes: z.string().trim().max(500).optional().nullable(),
  externalId: z.string().trim().max(120).optional().nullable(),
});

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("no autorizado");
  }
  return session.user.id;
}

export async function createSubscriptionAction(formData: FormData) {
  const adminId = await requireAdmin();

  const parsed = createSchema.safeParse({
    placeId: formData.get("placeId"),
    tier: formData.get("tier") || "featured",
    amountClp: formData.get("amountClp"),
    periodDays: formData.get("periodDays"),
    notes: formData.get("notes") || null,
    externalId: formData.get("externalId") || null,
  });
  if (!parsed.success) {
    throw new Error(
      "datos inválidos: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  await createSubscription({
    placeId: parsed.data.placeId,
    tier: parsed.data.tier,
    amountClp: parsed.data.amountClp,
    periodDays: parsed.data.periodDays,
    provider: "manual",
    externalId: parsed.data.externalId ?? null,
    notes: parsed.data.notes ?? null,
    createdBy: adminId,
  });

  // El cambio en is_featured afecta sorts, mapa y placeCard — invalidamos amplio.
  revalidatePath("/admin/promociones");
  revalidatePath("/buscar");
  revalidatePath("/");

  redirect("/admin/promociones");
}

export async function cancelSubscriptionAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("subscriptionId");
  if (typeof id !== "string" || !id) throw new Error("subscriptionId requerido");

  await cancelSubscription(id);
  revalidatePath("/admin/promociones");
  revalidatePath("/buscar");
  revalidatePath("/");
}
