import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  brands,
  places,
  type DbBrand,
  type NewDbBrand,
} from "@/server/db/schema";

// ============================================================================
// brands service — CRUD de cadenas + asignación de places.
//
// Las brands no tienen modo demo (no aparecen en mock). Si no hay DB,
// retornan vacío y los pins del mapa caen al render default.
// ============================================================================

export type BrandWithCount = DbBrand & { placeCount: number };

export async function getAllBrands(opts?: {
  query?: string;
  includeInactive?: boolean;
}): Promise<BrandWithCount[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const q = opts?.query?.trim();

  const conditions = [];
  if (q) conditions.push(ilike(brands.name, `%${q}%`));
  if (!opts?.includeInactive) conditions.push(eq(brands.isActive, true));

  const rows = await db
    .select({
      brand: brands,
      placeCount: sql<number>`count(${places.id})::int`,
    })
    .from(brands)
    .leftJoin(places, eq(places.brandId, brands.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(brands.id)
    .orderBy(asc(brands.name));

  return rows.map((r) => ({ ...r.brand, placeCount: r.placeCount }));
}

export async function getBrandById(id: string): Promise<DbBrand | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return row ?? null;
}

export async function getBrandBySlug(slug: string): Promise<DbBrand | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * Map placeId → brand (resuelto). Pa que el render del mapa una sola
 * pasada cargue todas las brands relevantes.
 */
export async function getBrandsForPlaceIds(
  placeIds: string[],
): Promise<Map<string, DbBrand>> {
  if (!isDbConfigured() || placeIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      placeId: places.id,
      brand: brands,
    })
    .from(places)
    .innerJoin(brands, eq(brands.id, places.brandId))
    .where(
      and(
        sql`${places.id} = ANY(${placeIds})`,
        eq(brands.isActive, true),
      ),
    );
  return new Map(rows.map((r) => [r.placeId, r.brand]));
}

export async function createBrand(input: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  website?: string | null;
}): Promise<DbBrand> {
  if (!isDbConfigured()) throw new Error("createBrand requiere DATABASE_URL");
  const db = getDb();
  const insert: NewDbBrand = {
    slug: input.slug,
    name: input.name,
    logoUrl: input.logoUrl ?? null,
    color: input.color ?? null,
    website: input.website ?? null,
  };
  const [row] = await db.insert(brands).values(insert).returning();
  if (!row) throw new Error("createBrand: no row");
  return row;
}

export async function updateBrand(
  id: string,
  patch: {
    name?: string;
    logoUrl?: string | null;
    color?: string | null;
    website?: string | null;
    isActive?: boolean;
  },
): Promise<void> {
  if (!isDbConfigured()) throw new Error("updateBrand requiere DATABASE_URL");
  const db = getDb();
  const updates: Partial<NewDbBrand> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.logoUrl !== undefined) updates.logoUrl = patch.logoUrl;
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.website !== undefined) updates.website = patch.website;
  if (patch.isActive !== undefined) updates.isActive = patch.isActive;
  await db.update(brands).set(updates).where(eq(brands.id, id));
}

/**
 * Borra una brand. Los places quedan huérfanos vía FK ON DELETE SET NULL.
 * Usar con cuidado — si la brand tiene subs activas (futuro tier brand),
 * el caller debe cancelarlas antes.
 */
export async function deleteBrand(id: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db.delete(brands).where(eq(brands.id, id));
}

/**
 * Asigna `brandId` a un place (o desasigna si null). Llamado desde el
 * place edit form del admin.
 */
export async function setBrandForPlace(
  placeId: string,
  brandId: string | null,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(places)
    .set({ brandId, updatedAt: new Date() })
    .where(eq(places.id, placeId));
}

/**
 * Lista de places asignados a una brand (pa pantalla brand detail / mass ops).
 */
export async function getPlacesForBrand(brandId: string): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    comunaSlug: string;
    comunaLabel: string;
    moderationStatus: string;
  }>
> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({
      id: places.id,
      name: places.name,
      slug: places.slug,
      comunaSlug: places.comunaSlug,
      comunaLabel: places.comunaLabel,
      moderationStatus: places.moderationStatus,
    })
    .from(places)
    .where(eq(places.brandId, brandId))
    .orderBy(asc(places.name));
}

/**
 * Cuenta de places sin brand asignada (admin lo necesita pa "huérfanos" tab).
 */
export async function countUnbrandedPlaces(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(places)
    .where(isNull(places.brandId));
  return row?.count ?? 0;
}
