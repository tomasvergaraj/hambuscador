"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { getAllComunas } from "@/lib/data";
import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { createPlace, placeExists } from "@/server/services/places";

// ============================================================================
// Schema de validación del wizard
// ----------------------------------------------------------------------------
// name + comuna + address + lat/lng son obligatorios. Las coords vienen del
// autocomplete (Nominatim) o del pin draggable del mapa — ya no usamos el
// centroide de la comuna como fallback.
// ============================================================================

const cuisineIds = CUISINE_TYPES.map((c) => c.id) as [string, ...string[]];
const priceIds = PRICE_RANGES.map((p) => p.id) as [string, ...string[]];

// Bounding box (laxo) para Chile continental + insular cercana
const CHILE_LAT_MIN = -56;
const CHILE_LAT_MAX = -17;
const CHILE_LNG_MIN = -76;
const CHILE_LNG_MAX = -66;

const placeSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  comunaSlug: z.string().trim().min(1, "Elige una comuna"),
  address: z.string().trim().min(5, "La dirección está muy corta").max(200),
  lat: z.coerce
    .number()
    .min(CHILE_LAT_MIN, "Ubicación fuera de Chile")
    .max(CHILE_LAT_MAX, "Ubicación fuera de Chile"),
  lng: z.coerce
    .number()
    .min(CHILE_LNG_MIN, "Ubicación fuera de Chile")
    .max(CHILE_LNG_MAX, "Ubicación fuera de Chile"),
  cuisines: z.array(z.enum(cuisineIds)).min(1, "Marca al menos un tipo de cocina"),
  priceRange: z.enum(priceIds, { errorMap: () => ({ message: "Elige un rango de precio" }) }),
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
  facebook: z.string().trim().max(120).optional().or(z.literal("")),
  tiktok: z.string().trim().max(60).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(200)
    .url("La URL del sitio web no es válida")
    .optional()
    .or(z.literal("")),
  menuUrl: z
    .string()
    .trim()
    .max(200)
    .url("La URL del menú no es válida")
    .optional()
    .or(z.literal("")),
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
      error: "Modo demo: agregar locales requiere DATABASE_URL. Inicia la DB con pnpm db:up.",
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
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    cuisines: formData.getAll("cuisines"),
    priceRange: formData.get("priceRange"),
    specialty: formData.get("specialty"),
    hoursWeekdays: formData.get("hoursWeekdays"),
    hoursWeekends: formData.get("hoursWeekends"),
    hoursByDay: formData.get("hoursByDay"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    instagram: formData.get("instagram"),
    facebook: formData.get("facebook"),
    tiktok: formData.get("tiktok"),
    website: formData.get("website"),
    menuUrl: formData.get("menuUrl"),
    photos: formData.getAll("photos").filter((v): v is string => typeof v === "string"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const allComunas = await getAllComunas();
  const comuna = allComunas.find((c) => c.slug === parsed.data.comunaSlug);
  if (!comuna) {
    return { error: "Comuna desconocida" };
  }

  try {
    await createPlace({
      name: parsed.data.name,
      comunaSlug: comuna.slug,
      comunaLabel: comuna.label,
      region: comuna.regionLabel,
      address: parsed.data.address,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      cuisines: parsed.data.cuisines,
      priceRange: parsed.data.priceRange,
      specialty: parsed.data.specialty || undefined,
      hoursWeekdays: parsed.data.hoursWeekdays || undefined,
      hoursWeekends: parsed.data.hoursWeekends || undefined,
      hoursByDay: parsed.data.hoursByDay,
      phone: parsed.data.phone || undefined,
      whatsapp: parsed.data.whatsapp || undefined,
      instagram: parsed.data.instagram || undefined,
      facebook: parsed.data.facebook || undefined,
      tiktok: parsed.data.tiktok || undefined,
      website: parsed.data.website || undefined,
      menuUrl: parsed.data.menuUrl || undefined,
      photos: parsed.data.photos,
      submittedBy: session.user.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    // Postgres 23505 = unique_violation (places_comuna_slug_idx)
    if (msg.includes("23505") || msg.toLowerCase().includes("unique")) {
      return {
        error: "Ya existe un local con ese nombre en esa comuna. Intenta uno más específico.",
      };
    }
    throw error;
  }

  revalidateTag("places");
  revalidatePath("/");
  revalidatePath("/buscar");
  redirect("/perfil?nuevo=1");
}

/**
 * Server action liviana para validar nombre+comuna desde el wizard antes
 * de avanzar al paso 2. Devuelve `{ exists }`.
 */
export async function checkPlaceExistsAction(input: {
  name: string;
  comunaSlug: string;
}): Promise<{ exists: boolean }> {
  if (!isDbConfigured()) return { exists: false };
  const name = input.name?.trim();
  const slug = input.comunaSlug?.trim();
  if (!name || name.length < 2 || !slug) return { exists: false };
  const exists = await placeExists(name, slug);
  return { exists };
}
