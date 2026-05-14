import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  places,
  promotions,
  type DbPromotion,
  type NewDbPromotion,
  type PromotionKind,
} from "@/server/db/schema";

// ============================================================================
// promotions service — promociones de contenido (% descuento, producto, combo).
// Place tiene sub `promo` o `premium` active → puede crear N. Active visibility:
// is_active AND moderation_status='approved' AND ends_at > now.
// ============================================================================

export type PromotionWithPlace = DbPromotion & {
  placeName: string;
  placeSlug: string;
  comunaSlug: string;
  comunaLabel: string;
  placeRegion: string;
};

/** Pa el home: top N activas filtradas por región. Si regionLabel no provee
 * o no hay match, devuelve top N nacionales. */
export async function getActivePromotionsForHome(opts: {
  regionLabel?: string | null;
  limit?: number;
}): Promise<PromotionWithPlace[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const limit = opts.limit ?? 10;
  const now = new Date();

  const baseConditions = [
    eq(promotions.isActive, true),
    eq(promotions.moderationStatus, "approved"),
    gt(promotions.endsAt, now),
  ];

  const tryRegion = async () => {
    if (!opts.regionLabel) return [];
    return await db
      .select({
        promo: promotions,
        placeName: places.name,
        placeSlug: places.slug,
        comunaSlug: places.comunaSlug,
        comunaLabel: places.comunaLabel,
        placeRegion: places.region,
      })
      .from(promotions)
      .innerJoin(places, eq(places.id, promotions.placeId))
      .where(
        and(
          ...baseConditions,
          eq(promotions.regionLabel, opts.regionLabel),
        ),
      )
      .orderBy(asc(promotions.endsAt))
      .limit(limit);
  };

  let rows = await tryRegion();
  if (rows.length < Math.min(3, limit) && opts.regionLabel) {
    // Fallback: si la región tiene poco inventario, completar con nacionales.
    const fillLimit = limit - rows.length;
    const fill = await db
      .select({
        promo: promotions,
        placeName: places.name,
        placeSlug: places.slug,
        comunaSlug: places.comunaSlug,
        comunaLabel: places.comunaLabel,
        placeRegion: places.region,
      })
      .from(promotions)
      .innerJoin(places, eq(places.id, promotions.placeId))
      .where(and(...baseConditions))
      .orderBy(asc(promotions.endsAt))
      .limit(fillLimit + rows.length);
    const seen = new Set(rows.map((r) => r.promo.id));
    for (const r of fill) {
      if (rows.length >= limit) break;
      if (!seen.has(r.promo.id)) rows.push(r);
    }
  } else if (!opts.regionLabel) {
    rows = await db
      .select({
        promo: promotions,
        placeName: places.name,
        placeSlug: places.slug,
        comunaSlug: places.comunaSlug,
        comunaLabel: places.comunaLabel,
        placeRegion: places.region,
      })
      .from(promotions)
      .innerJoin(places, eq(places.id, promotions.placeId))
      .where(and(...baseConditions))
      .orderBy(asc(promotions.endsAt))
      .limit(limit);
  }

  return rows.map((r) => ({
    ...r.promo,
    placeName: r.placeName,
    placeSlug: r.placeSlug,
    comunaSlug: r.comunaSlug,
    comunaLabel: r.comunaLabel,
    placeRegion: r.placeRegion,
  }));
}

/** Active del local pa render en ficha + pin del mapa. Cache cortita. */
export async function getActivePromotionsForPlace(
  placeId: string,
): Promise<DbPromotion[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.placeId, placeId),
        eq(promotions.isActive, true),
        eq(promotions.moderationStatus, "approved"),
        gt(promotions.endsAt, new Date()),
      ),
    )
    .orderBy(desc(promotions.startsAt));
}

/** Set de placeIds que tienen al menos una promo activa — usado pa filter
 * el pin ring del mapa con un solo query batch. */
export async function getPlaceIdsWithActivePromotions(
  placeIds: string[],
): Promise<Set<string>> {
  if (!isDbConfigured() || placeIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ placeId: promotions.placeId })
    .from(promotions)
    .where(
      and(
        inArray(promotions.placeId, placeIds),
        eq(promotions.isActive, true),
        eq(promotions.moderationStatus, "approved"),
        gt(promotions.endsAt, new Date()),
      ),
    );
  return new Set(rows.map((r) => r.placeId));
}

/** Lista pa admin. Incluye expiradas e inactivas. */
export async function listPromotionsForAdmin(opts?: {
  limit?: number;
}): Promise<PromotionWithPlace[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const limit = opts?.limit ?? 100;

  const rows = await db
    .select({
      promo: promotions,
      placeName: places.name,
      placeSlug: places.slug,
      comunaSlug: places.comunaSlug,
      comunaLabel: places.comunaLabel,
      placeRegion: places.region,
    })
    .from(promotions)
    .innerJoin(places, eq(places.id, promotions.placeId))
    .orderBy(desc(promotions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r.promo,
    placeName: r.placeName,
    placeSlug: r.placeSlug,
    comunaSlug: r.comunaSlug,
    comunaLabel: r.comunaLabel,
    placeRegion: r.placeRegion,
  }));
}

export async function getPromotionsForPlaceAdmin(
  placeId: string,
): Promise<DbPromotion[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(promotions)
    .where(eq(promotions.placeId, placeId))
    .orderBy(desc(promotions.createdAt));
}

export async function getPromotionById(id: string): Promise<DbPromotion | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(promotions)
    .where(eq(promotions.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPromotion(input: {
  placeId: string;
  kind: PromotionKind;
  title: string;
  description?: string | null;
  discountPct?: number | null;
  photoUrl?: string | null;
  startsAt?: Date;
  endsAt: Date;
  moderationStatus?: "pending" | "approved" | "rejected";
  createdBy?: string | null;
}): Promise<DbPromotion> {
  if (!isDbConfigured()) throw new Error("createPromotion requiere DATABASE_URL");
  const db = getDb();

  // Pre-fetch region pa denormalizar.
  const [place] = await db
    .select({ region: places.region })
    .from(places)
    .where(eq(places.id, input.placeId))
    .limit(1);
  if (!place) throw new Error("place no encontrado");

  const values: NewDbPromotion = {
    placeId: input.placeId,
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    discountPct: input.discountPct ?? null,
    photoUrl: input.photoUrl ?? null,
    regionLabel: place.region,
    startsAt: input.startsAt ?? new Date(),
    endsAt: input.endsAt,
    isActive: true,
    moderationStatus: input.moderationStatus ?? "approved",
    createdBy: input.createdBy ?? null,
  };

  const [row] = await db.insert(promotions).values(values).returning();
  if (!row) throw new Error("createPromotion: no row");
  return row;
}

export async function updatePromotion(
  id: string,
  patch: Partial<{
    kind: PromotionKind;
    title: string;
    description: string | null;
    discountPct: number | null;
    photoUrl: string | null;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
    moderationStatus: "pending" | "approved" | "rejected";
  }>,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(promotions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(promotions.id, id));
}

export async function deletePromotion(id: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db.delete(promotions).where(eq(promotions.id, id));
}

/** Cuando admin cambia places.region, propagar a sus promociones. Llamado
 * desde updatePlace si region cambió (futuro). Por ahora sin trigger. */
export async function syncPromotionsRegion(
  placeId: string,
  regionLabel: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(promotions)
    .set({ regionLabel, updatedAt: new Date() })
    .where(eq(promotions.placeId, placeId));
}

/** Cuenta promos owner-created esperando moderación. Pa badge admin nav. */
export async function countPendingPromotions(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promotions)
    .where(
      and(
        eq(promotions.moderationStatus, "pending"),
        gt(promotions.endsAt, new Date()),
      ),
    );
  return row?.count ?? 0;
}

export async function countActivePromotions(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promotions)
    .where(
      and(
        eq(promotions.isActive, true),
        eq(promotions.moderationStatus, "approved"),
        gt(promotions.endsAt, new Date()),
      ),
    );
  return row?.count ?? 0;
}

