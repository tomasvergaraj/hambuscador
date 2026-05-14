import { and, desc, eq, lte, or, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  brands,
  places,
  subscriptions,
  type DbSubscription,
  type SubscriptionProvider,
  type SubscriptionTier,
} from "@/server/db/schema";

// ============================================================================
// Subscriptions service — publicidad pagada por local.
//
// MVP solo tier `featured` (mapea 1-a-1 con places.is_featured).
// Provider `manual` por default — el admin cobra fuera de banda (transferencia
// o Khipu directo) y registra acá. Cron diario expira las que vencen y
// revierte is_featured.
//
// Modo demo (sin DATABASE_URL): todas las fns son no-op o retornan vacío.
// ============================================================================

export type SubscriptionWithTarget = DbSubscription & {
  /** Cuando place_id está seteado. */
  placeName: string | null;
  placeSlug: string | null;
  comunaSlug: string | null;
  comunaLabel: string | null;
  /** Cuando brand_id está seteado. */
  brandName: string | null;
  brandSlug: string | null;
  brandLogoUrl: string | null;
  /** Resumen pa display. */
  targetType: "place" | "brand";
  targetLabel: string;
};

/**
 * Crea una sub `active` y setea `places.is_featured = true` en la misma tx.
 * Falla si ya existe una sub active para (place, tier) — el unique partial
 * index lo garantiza. El caller debe cancelar/expirar la vieja antes.
 *
 * Retorna la sub creada.
 */
export async function createSubscription(input: {
  /** Exactamente uno entre placeId / brandId. */
  placeId?: string | null;
  brandId?: string | null;
  tier?: SubscriptionTier;
  amountClp: number;
  periodDays: number;
  provider?: SubscriptionProvider;
  externalId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<DbSubscription> {
  if (!isDbConfigured()) {
    throw new Error("createSubscription requiere DATABASE_URL");
  }
  const placeId = input.placeId ?? null;
  const brandId = input.brandId ?? null;
  if ((placeId === null) === (brandId === null)) {
    throw new Error(
      "createSubscription: exactamente uno entre placeId y brandId",
    );
  }
  // Tier 'promo' es por local — no soporta target brand.
  if (brandId && input.tier === "promo") {
    throw new Error(
      "createSubscription: tier 'promo' no aplica a cadenas",
    );
  }
  const db = getDb();

  const tier: SubscriptionTier = input.tier ?? "featured";
  const now = new Date();
  const periodEnd = new Date(now.getTime() + input.periodDays * 24 * 60 * 60 * 1000);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(subscriptions)
      .values({
        placeId,
        brandId,
        tier,
        status: "active",
        amountClp: input.amountClp,
        provider: input.provider ?? "manual",
        externalId: input.externalId ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        createdBy: input.createdBy ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (!row) throw new Error("createSubscription: insert returned no row");

    // Sub a place: prende solo ese place. Sub a brand: prende todos los
    // places de la cadena. Premium es superset de featured — ambos tiers
    // prenden la flag.
    if (placeId) {
      await tx
        .update(places)
        .set({ isFeatured: true, updatedAt: new Date() })
        .where(eq(places.id, placeId));
    } else if (brandId) {
      await tx
        .update(places)
        .set({ isFeatured: true, updatedAt: new Date() })
        .where(eq(places.brandId, brandId));
    }
    return row;
  });

  return created;
}

/**
 * Cancela manualmente una sub (admin la baja antes de su período). Si no
 * quedan otras subs active del mismo tier para ese place, revierte la flag.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();

  await db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    if (!sub) return;
    if (sub.status !== "active") return;

    await tx
      .update(subscriptions)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));

    if (sub.placeId) {
      await maybeUnsetFeaturedFlagForPlace(tx, sub.placeId);
    } else if (sub.brandId) {
      await maybeUnsetFeaturedFlagForBrand(tx, sub.brandId);
    }
  });
}

/**
 * Expira en batch todas las subs `active` cuyo `current_period_end <= NOW()`.
 * Devuelve el conteo de expiradas. Idempotente: re-correr no toca nada que ya
 * esté expired.
 *
 * Llamado por el cron diario (piggyback en /api/cron/digest).
 */
export async function expireDueSubscriptions(): Promise<{ expired: number }> {
  if (!isDbConfigured()) return { expired: 0 };
  const db = getDb();

  const expired = await db.transaction(async (tx) => {
    const due = await tx
      .select({
        id: subscriptions.id,
        placeId: subscriptions.placeId,
        brandId: subscriptions.brandId,
        tier: subscriptions.tier,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          lte(subscriptions.currentPeriodEnd, new Date()),
        ),
      );

    if (due.length === 0) return [];

    await tx
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.status, "active"),
          lte(subscriptions.currentPeriodEnd, new Date()),
        ),
      );

    // Revertir flags por target afectado. Brand subs pueden tocar varios
    // places — la fn brand recorre todos los hijos.
    for (const row of due) {
      if (row.placeId) {
        await maybeUnsetFeaturedFlagForPlace(tx, row.placeId);
      } else if (row.brandId) {
        await maybeUnsetFeaturedFlagForBrand(tx, row.brandId);
      }
    }
    return due;
  });

  return { expired: expired.length };
}

/**
 * Setea `places.is_featured = false` SOLO si ya no quedan subs active
 * (directas al place NI a su brand) que justifiquen el boost.
 */
async function maybeUnsetFeaturedFlagForPlace(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  placeId: string,
): Promise<void> {
  // ¿Place tiene brand? Si sí, ver si la brand tiene sub active.
  const [placeRow] = await tx
    .select({ brandId: places.brandId })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  const directActive = tx
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.placeId, placeId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);
  const brandActive = placeRow?.brandId
    ? tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.brandId, placeRow.brandId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1)
    : Promise.resolve([] as Array<{ id: string }>);

  const [direct, brand] = await Promise.all([directActive, brandActive]);
  if (direct.length === 0 && brand.length === 0) {
    await tx
      .update(places)
      .set({ isFeatured: false, updatedAt: new Date() })
      .where(eq(places.id, placeId));
  }
}

/**
 * Cuando una sub a nivel brand expira/cancela, recorremos todos sus places
 * y revertimos la flag a quienes no tengan otra sub justificándola.
 */
async function maybeUnsetFeaturedFlagForBrand(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  brandId: string,
): Promise<void> {
  const brandPlaces = await tx
    .select({ id: places.id })
    .from(places)
    .where(eq(places.brandId, brandId));
  for (const p of brandPlaces) {
    await maybeUnsetFeaturedFlagForPlace(tx, p.id);
  }
}

/**
 * Lista de subs paginada para /admin/promociones. LEFT JOIN con places y
 * brands ya que una sub apunta a uno u otro.
 */
export async function listSubscriptionsForAdmin(opts?: {
  status?: "active" | "expired" | "canceled" | "all";
  limit?: number;
}): Promise<SubscriptionWithTarget[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const limit = opts?.limit ?? 100;
  const status = opts?.status ?? "all";

  const rows = await db
    .select({
      sub: subscriptions,
      placeName: places.name,
      placeSlug: places.slug,
      comunaSlug: places.comunaSlug,
      comunaLabel: places.comunaLabel,
      brandName: brands.name,
      brandSlug: brands.slug,
      brandLogoUrl: brands.logoUrl,
    })
    .from(subscriptions)
    .leftJoin(places, eq(places.id, subscriptions.placeId))
    .leftJoin(brands, eq(brands.id, subscriptions.brandId))
    .where(status === "all" ? undefined : eq(subscriptions.status, status))
    .orderBy(
      sql`CASE WHEN ${subscriptions.status} = 'active' THEN 0 ELSE 1 END`,
      desc(subscriptions.createdAt),
    )
    .limit(limit);

  return rows.map((r) => {
    const isBrand = !!r.sub.brandId;
    return {
      ...r.sub,
      placeName: r.placeName,
      placeSlug: r.placeSlug,
      comunaSlug: r.comunaSlug,
      comunaLabel: r.comunaLabel,
      brandName: r.brandName,
      brandSlug: r.brandSlug,
      brandLogoUrl: r.brandLogoUrl,
      targetType: (isBrand ? "brand" : "place") as "brand" | "place",
      targetLabel: isBrand
        ? (r.brandName ?? "(cadena)")
        : (r.placeName ?? "(local)"),
    };
  });
}

export async function getSubscriptionsForPlace(placeId: string): Promise<DbSubscription[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.placeId, placeId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function countActiveSubscriptions(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
  return row?.count ?? 0;
}

/**
 * True si el local tiene una sub `active` del tier solicitado, ya sea
 * directa al place o heredada por su brand. Gate de features premium:
 * stats, replies, +fotos.
 */
export async function hasActiveTier(
  placeId: string,
  tier: SubscriptionTier,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();

  // Place tiene brand? Hacemos un solo round-trip con OR.
  const [placeRow] = await db
    .select({ brandId: places.brandId })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  const brandId = placeRow?.brandId ?? null;

  const targetMatch = brandId
    ? or(eq(subscriptions.placeId, placeId), eq(subscriptions.brandId, brandId))
    : eq(subscriptions.placeId, placeId);

  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        targetMatch,
        eq(subscriptions.tier, tier),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);
  return !!row;
}

export const hasActivePremium = (placeId: string) => hasActiveTier(placeId, "premium");
