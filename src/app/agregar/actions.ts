"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { COMUNAS_REGISTRY, CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { createPlace } from "@/server/services/places";

// ============================================================================
// Schema de validación del wizard
// ----------------------------------------------------------------------------
// Lo mantenemos liviano: name + comuna + address son obligatorios; lat/lng
// vienen del centroide de la comuna (geocoding real es Fase 3); cuisines y
// priceRange son requeridos para que la ficha sea útil.
// ============================================================================

const cuisineIds = CUISINE_TYPES.map((c) => c.id) as [string, ...string[]];
const priceIds = PRICE_RANGES.map((p) => p.id) as [string, ...string[]];
const comunaSlugs = COMUNAS_REGISTRY.map((c) => c.slug) as [string, ...string[]];

const placeSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  comunaSlug: z.enum(comunaSlugs, { errorMap: () => ({ message: "Elige una comuna" }) }),
  address: z.string().trim().min(5, "La dirección está muy corta").max(200),
  cuisines: z.array(z.enum(cuisineIds)).min(1, "Marca al menos un tipo de cocina"),
  priceRange: z.enum(priceIds, { errorMap: () => ({ message: "Elige un rango de precio" }) }),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
  hoursWeekdays: z.string().trim().max(50).optional().or(z.literal("")),
  hoursWeekends: z.string().trim().max(50).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  photos: z.array(z.string().url()).max(4, "Máximo 4 fotos").default([]),
});

export type CreatePlaceState = {
  error?: string;
};

/**
 * Crea un local en estado `pending` (esperando moderación). El submitter
 * gana puntos cuando se aprueba (TODO Fase 5).
 *
 * Validaciones:
 * 1. DB configurada (modo demo no escribe).
 * 2. Sesión activa (sino redirect a login).
 * 3. Schema con zod (errores en formato user-friendly).
 *
 * En éxito: revalida home + búsqueda + detalle, redirige a `/perfil`.
 */
export async function createPlaceAction(
  _prev: CreatePlaceState,
  formData: FormData,
): Promise<CreatePlaceState> {
  if (!isDbConfigured()) {
    return {
      error: "Modo demo: agregar locales requiere DATABASE_URL. Levantá la DB con pnpm db:up.",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const parsed = placeSchema.safeParse({
    name: formData.get("name"),
    comunaSlug: formData.get("comunaSlug"),
    address: formData.get("address"),
    cuisines: formData.getAll("cuisines"),
    priceRange: formData.get("priceRange"),
    specialty: formData.get("specialty"),
    hoursWeekdays: formData.get("hoursWeekdays"),
    hoursWeekends: formData.get("hoursWeekends"),
    phone: formData.get("phone"),
    instagram: formData.get("instagram"),
    photos: formData.getAll("photos").filter((v): v is string => typeof v === "string"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const comuna = COMUNAS_REGISTRY.find((c) => c.slug === parsed.data.comunaSlug);
  if (!comuna) {
    return { error: "Comuna desconocida" };
  }

  try {
    await createPlace({
      name: parsed.data.name,
      comunaSlug: comuna.slug,
      comunaLabel: comuna.label,
      region: comuna.region,
      address: parsed.data.address,
      lat: comuna.lat,
      lng: comuna.lng,
      cuisines: parsed.data.cuisines,
      priceRange: parsed.data.priceRange,
      specialty: parsed.data.specialty || undefined,
      hoursWeekdays: parsed.data.hoursWeekdays || undefined,
      hoursWeekends: parsed.data.hoursWeekends || undefined,
      phone: parsed.data.phone || undefined,
      instagram: parsed.data.instagram || undefined,
      photos: parsed.data.photos,
      submittedBy: session.user.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    // Postgres 23505 = unique_violation (places_comuna_slug_idx)
    if (msg.includes("23505") || msg.toLowerCase().includes("unique")) {
      return {
        error: "Ya existe un local con ese nombre en esa comuna. Probá un nombre más específico.",
      };
    }
    throw error;
  }

  revalidateTag("places");
  revalidatePath("/");
  revalidatePath("/buscar");
  redirect("/perfil?nuevo=1");
}
