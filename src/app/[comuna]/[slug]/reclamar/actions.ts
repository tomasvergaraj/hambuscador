"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import {
  createClaim,
  hasPendingClaim,
  isOwnerOf,
} from "@/server/services/claims";
import { getPlaceIdBySlug } from "@/server/services/places";

const claimSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .email("Email inválido")
    .max(120),
  contactPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .max(800)
    .optional()
    .or(z.literal("")),
  proofUrl: z
    .string()
    .trim()
    .url("URL de proof inválida")
    .optional()
    .or(z.literal("")),
});

export type ClaimState = { error?: string; ok?: boolean };

/**
 * Submite un claim de un local. Validaciones:
 *  1. Sesión activa.
 *  2. Place existe + está aprobado.
 *  3. No tiene un claim pending del mismo user.
 *  4. No está claimedBy ya por este mismo user.
 *  5. Schema con zod.
 *
 * Llamar via .bind(null, comunaSlug, slug) desde el form.
 */
export async function submitClaimAction(
  comunaSlug: string,
  slug: string,
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  if (!isDbConfigured()) {
    return { error: "Modo demo: reclamar requiere DATABASE_URL." };
  }
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");

  const placeId = await getPlaceIdBySlug(comunaSlug, slug);
  if (!placeId) return { error: "Local no encontrado" };

  // Si ya es owner, no necesita reclamar otra vez.
  if (await isOwnerOf(session.user.id, placeId)) {
    return { error: "Ya eres el owner verificado de este local" };
  }

  // Bloquea pending duplicado
  if (await hasPendingClaim(placeId, session.user.id)) {
    return {
      error: "Ya tienes una solicitud pendiente sobre este local. Espera la revisión del admin.",
    };
  }

  const parsed = claimSchema.safeParse({
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    message: formData.get("message"),
    proofUrl: formData.get("proofUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await createClaim({
    placeId,
    userId: session.user.id,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone || null,
    message: parsed.data.message || null,
    proofUrl: parsed.data.proofUrl || null,
  });

  revalidateTag("places");
  revalidatePath(`/${comunaSlug}/${slug}`);
  revalidatePath("/admin/claims");

  return { ok: true };
}
