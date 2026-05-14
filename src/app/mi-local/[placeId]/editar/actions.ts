"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { isOwnerOf } from "@/server/services/claims";
import {
  getPlaceByIdForAdmin,
  updatePlace,
} from "@/server/services/places";
import { hasActivePremium } from "@/server/services/subscriptions";

const cuisineIds = CUISINE_TYPES.map((c) => c.id) as [string, ...string[]];
const priceIds = PRICE_RANGES.map((p) => p.id) as [string, ...string[]];

// Owner schema — campos restringidos (no toca name/slug/comuna/coords/flags).
const ownerSchema = z.object({
  cuisines: z.array(z.enum(cuisineIds)).min(1, "Marca al menos un tipo de cocina"),
  priceRange: z.enum(priceIds),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
  hoursWeekdays: z.string().trim().max(50).optional().or(z.literal("")),
  hoursWeekends: z.string().trim().max(50).optional().or(z.literal("")),
  hoursByDay: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, string | null>;
        }
      } catch {
        // ignore
      }
      return undefined;
    }),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(200)
    .url("La URL del sitio web no es válida")
    .optional()
    .or(z.literal("")),
  logo: z.string().trim().url().optional().or(z.literal("")),
  // Cap superior defensivo (premium permite 15). El check de tier se
  // hace en runtime contra la sub activa — acá un cap duro evita abusos.
  photos: z.array(z.string().url()).max(15).default([]),
});

export type OwnerEditState = { error?: string; ok?: boolean };

/**
 * Update parcial de un local desde el owner. Verifica ownership en
 * runtime (admin también puede vía esta ruta — el form restringe los
 * campos sensibles a nivel UI). Bind: .bind(null, placeId).
 */
export async function ownerUpdatePlaceAction(
  placeId: string,
  _prev: OwnerEditState,
  formData: FormData,
): Promise<OwnerEditState> {
  if (!isDbConfigured()) {
    return { error: "Modo demo: editar requiere DATABASE_URL." };
  }
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");

  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const existing = await getPlaceByIdForAdmin(placeId);
  if (!existing) return { error: "Local no encontrado" };

  const parsed = ownerSchema.safeParse({
    cuisines: formData.getAll("cuisines"),
    priceRange: formData.get("priceRange"),
    specialty: formData.get("specialty"),
    hoursWeekdays: formData.get("hoursWeekdays"),
    hoursWeekends: formData.get("hoursWeekends"),
    hoursByDay: formData.get("hoursByDay"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    instagram: formData.get("instagram"),
    website: formData.get("website"),
    logo: formData.get("logo"),
    photos: formData.getAll("photos").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Cap dinámico de fotos por tier: free=6, premium=15.
  if (parsed.data.photos.length > 6 && !(await hasActivePremium(placeId))) {
    return { error: "Subir más de 6 fotos requiere tier premium." };
  }

  await updatePlace(placeId, {
    cuisines: parsed.data.cuisines,
    priceRange: parsed.data.priceRange,
    specialty: parsed.data.specialty || null,
    hoursWeekdays: parsed.data.hoursWeekdays || null,
    hoursWeekends: parsed.data.hoursWeekends || null,
    hoursByDay: parsed.data.hoursByDay ?? null,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    instagram: parsed.data.instagram || null,
    website: parsed.data.website || null,
    logo: parsed.data.logo || null,
    photos: parsed.data.photos,
  });

  revalidateTag("places");
  revalidatePath(`/${existing.comuna}/${existing.slug}`);

  return { ok: true };
}
