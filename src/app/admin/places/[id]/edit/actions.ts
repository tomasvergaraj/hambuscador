"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { deletePlace, getPlaceByIdForAdmin, updatePlace } from "@/server/services/places";

const cuisineIds = CUISINE_TYPES.map((c) => c.id) as [string, ...string[]];
const priceIds = PRICE_RANGES.map((p) => p.id) as [string, ...string[]];

const CHILE_LAT_MIN = -56;
const CHILE_LAT_MAX = -17;
const CHILE_LNG_MIN = -76;
const CHILE_LNG_MAX = -66;

const editSchema = z.object({
  name: z.string().trim().min(2).max(100),
  // comunaSlug NO es editable (rompe URLs). Solo el label cambia.
  comunaLabel: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(200),
  lat: z.coerce.number().min(CHILE_LAT_MIN).max(CHILE_LAT_MAX),
  lng: z.coerce.number().min(CHILE_LNG_MIN).max(CHILE_LNG_MAX),
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
  photos: z.array(z.string().url()).max(6).default([]),
  isVerified: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  brandId: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type UpdatePlaceState = { error?: string; ok?: boolean };

/**
 * Update de un local. Admin-only. NO permite cambiar slug ni comunaSlug
 * (rompería URLs). Si se necesita rebatear, mejor desaprobar + recrear.
 *
 * Llamada con bind del placeId desde el form (.bind(null, placeId)).
 */
export async function updatePlaceAction(
  placeId: string,
  _prev: UpdatePlaceState,
  formData: FormData,
): Promise<UpdatePlaceState> {
  if (!isDbConfigured()) {
    return { error: "Modo demo: editar locales requiere DATABASE_URL." };
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  if (session.user.role !== "admin") redirect("/");

  const existing = await getPlaceByIdForAdmin(placeId);
  if (!existing) return { error: "Local no encontrado" };

  const parsed = editSchema.safeParse({
    name: formData.get("name"),
    comunaLabel: formData.get("comunaLabel"),
    region: formData.get("region"),
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
    website: formData.get("website"),
    logo: formData.get("logo"),
    photos: formData.getAll("photos").filter((v): v is string => typeof v === "string"),
    isVerified: formData.get("isVerified") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    brandId: formData.get("brandId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await updatePlace(placeId, {
    name: parsed.data.name,
    comunaLabel: parsed.data.comunaLabel,
    region: parsed.data.region,
    address: parsed.data.address,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
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
    isVerified: parsed.data.isVerified ?? false,
    isFeatured: parsed.data.isFeatured ?? false,
    brandId: parsed.data.brandId || null,
  });

  // Invalidar cache para que el público vea el cambio inmediato.
  revalidateTag("places");
  revalidatePath(`/${existing.comuna}/${existing.slug}`);
  revalidatePath("/admin/places");
  revalidatePath("/sitemap.xml");

  return { ok: true };
}

/**
 * Revoca al owner del local — claim aprobado por error o cambio de
 * dueño. Setea places.claimed_by = NULL. NO toca isVerified (puede
 * estar verified por motivos independientes; admin lo togglea aparte).
 *
 * Bind: .bind(null, placeId).
 */
export async function revokeOwnerAction(placeId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  if (session.user.role !== "admin") redirect("/");

  const existing = await getPlaceByIdForAdmin(placeId);
  if (!existing) return;

  await updatePlace(placeId, { claimedBy: null });

  revalidateTag("places");
  revalidatePath(`/${existing.comuna}/${existing.slug}`);
  revalidatePath("/admin/places");
  revalidatePath(`/admin/places/${placeId}/edit`);
}

/**
 * Borrado definitivo de un local. Acción destructiva — cascada reseñas,
 * favoritos, eventos, claims, replies, subscriptions vía FK ON DELETE
 * CASCADE. El caller debe confirmar con el admin antes (UI con prompt).
 *
 * Bind: .bind(null, placeId). Redirige a /admin/places al terminar.
 */
export async function deletePlaceAction(placeId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  if (session.user.role !== "admin") redirect("/");

  const deleted = await deletePlace(placeId);

  revalidateTag("places");
  revalidatePath("/admin/places");
  revalidatePath("/admin/moderacion");
  revalidatePath("/sitemap.xml");
  if (deleted) {
    revalidatePath(`/${deleted.comuna}/${deleted.slug}`);
  }
  redirect("/admin/places");
}
