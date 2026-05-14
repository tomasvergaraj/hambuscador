import { and, desc, eq, lte, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
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

export type SubscriptionWithPlace = DbSubscription & {
  placeName: string;
  placeSlug: string;
  comunaSlug: string;
  comunaLabel: string;
};

/**
 * Crea una sub `active` y setea `places.is_featured = true` en la misma tx.
 * Falla si ya existe una sub active para (place, tier) — el unique partial
 * index lo garantiza. El caller debe cancelar/expirar la vieja antes.
 *
 * Retorna la sub creada.
 */
export async function createSubscription(input: {
  placeId: string;
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
  const db = getDb();

  const tier: SubscriptionTier = input.tier ?? "featured";
  const now = new Date();
  const periodEnd = new Date(now.getTime() + input.periodDays * 24 * 60 * 60 * 1000);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(subscriptions)
      .values({
        placeId: input.placeId,
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

    // Premium incluye el boost de featured (es un superset). Cualquiera de
    // los dos tiers active prende la flag.
    await tx
      .update(places)
      .set({ isFeatured: true, updatedAt: new Date() })
      .where(eq(places.id, input.placeId));
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

    await maybeUnsetFeaturedFlag(tx, sub.placeId, sub.tier);
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
      .select({ id: subscriptions.id, placeId: subscriptions.placeId, tier: subscriptions.tier })
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

    // Revertir flags por place afectado (en serie — el N esperado es bajo).
    for (const row of due) {
      await maybeUnsetFeaturedFlag(tx, row.placeId, row.tier);
    }
    return due;
  });

  return { expired: expired.length };
}

/**
 * Setea `places.is_featured = false` SOLO si ya no quedan subs active de
 * NINGÚN tier para ese place. Ambos featured y premium prenden la flag,
 * así que la flag se mantiene mientras quede al menos una sub viva.
 */
async function maybeUnsetFeaturedFlag(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  placeId: string,
  _tier: SubscriptionTier,
): Promise<void> {
  const [stillActive] = await tx
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.placeId, placeId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);
  if (!stillActive) {
    await tx
      .update(places)
      .set({ isFeatured: false, updatedAt: new Date() })
      .where(eq(places.id, placeId));
  }
}

/**
 * Lista de subs paginada para /admin/promociones. Join lazy con places.
 * Default: todas las active primero, después las más recientes de cualquier estado.
 */
export async function listSubscriptionsForAdmin(opts?: {
  status?: "active" | "expired" | "canceled" | "all";
  limit?: number;
}): Promise<SubscriptionWithPlace[]> {
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
    })
    .from(subscriptions)
    .innerJoin(places, eq(places.id, subscriptions.placeId))
    .where(status === "all" ? undefined : eq(subscriptions.status, status))
    .orderBy(
      // active arriba, después por created_at desc
      sql`CASE WHEN ${subscriptions.status} = 'active' THEN 0 ELSE 1 END`,
      desc(subscriptions.createdAt),
    )
    .limit(limit);

  return rows.map((r) => ({
    ...r.sub,
    placeName: r.placeName,
    placeSlug: r.placeSlug,
    comunaSlug: r.comunaSlug,
    comunaLabel: r.comunaLabel,
  }));
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
 * True si el local tiene una sub `active` del tier solicitado (y vigente
 * por período). Usado como gate de features premium: stats, replies, +fotos.
 */
export async function hasActiveTier(
  placeId: string,
  tier: SubscriptionTier,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.placeId, placeId),
        eq(subscriptions.tier, tier),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);
  return !!row;
}

export const hasActivePremium = (placeId: string) => hasActiveTier(placeId, "premium");
