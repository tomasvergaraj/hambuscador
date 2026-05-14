import { and, eq, gte, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  placeEvents,
  type PlaceEventChannel,
  type PlaceEventType,
} from "@/server/db/schema";

// ============================================================================
// place-events service — analytics por local (views + contact_clicks).
//
// Consumido por `/mi-local/[id]/stats` (owner premium) y `/admin/places/[id]`.
// Inserts vienen desde `/api/track/event` con sendBeacon (fire-and-forget).
// ============================================================================

/**
 * Inserta un evento. Fire-and-forget: nunca throws — los errores se logean.
 * Volumen acotado por lazy insert (sin batch). 1 view por page-load, 1 click
 * por botón presionado.
 */
export async function trackPlaceEvent(input: {
  placeId: string;
  eventType: PlaceEventType;
  channel?: PlaceEventChannel | null;
  visitorId?: string | null;
}): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const db = getDb();
    await db.insert(placeEvents).values({
      placeId: input.placeId,
      eventType: input.eventType,
      channel: input.channel ?? null,
      visitorId: input.visitorId ?? null,
    });
  } catch (err) {
    console.error("[place-events] trackPlaceEvent failed:", err);
  }
}

export type PlaceStatsSummary = {
  rangeDays: number;
  views: { total: number; uniqueVisitors: number };
  clicks: {
    total: number;
    byChannel: Record<PlaceEventChannel, number>;
  };
  /** Buckets por día (orden ASC), pa el sparkline. */
  viewsByDay: Array<{ day: string; views: number }>;
};

const EMPTY_CHANNELS: Record<PlaceEventChannel, number> = {
  whatsapp: 0,
  instagram: 0,
  website: 0,
  maps: 0,
  phone: 0,
};

/**
 * Agregados de eventos para un local en los últimos `rangeDays`. Una sola
 * pasada por la tabla — todo en SQL para evitar pull de filas crudas.
 */
export async function getStatsForPlace(
  placeId: string,
  rangeDays = 30,
): Promise<PlaceStatsSummary> {
  if (!isDbConfigured()) {
    return {
      rangeDays,
      views: { total: 0, uniqueVisitors: 0 },
      clicks: { total: 0, byChannel: { ...EMPTY_CHANNELS } },
      viewsByDay: [],
    };
  }
  const db = getDb();
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  // Totales: counts agregados con FILTER pa evitar 3 queries.
  const [totals] = await db
    .select({
      views: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'view')::int`,
      uniqueViews: sql<number>`count(distinct ${placeEvents.visitorId}) filter (where ${placeEvents.eventType} = 'view' and ${placeEvents.visitorId} is not null)::int`,
      clicks: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click')::int`,
      whatsapp: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click' and ${placeEvents.channel} = 'whatsapp')::int`,
      instagram: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click' and ${placeEvents.channel} = 'instagram')::int`,
      website: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click' and ${placeEvents.channel} = 'website')::int`,
      maps: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click' and ${placeEvents.channel} = 'maps')::int`,
      phone: sql<number>`count(*) filter (where ${placeEvents.eventType} = 'contact_click' and ${placeEvents.channel} = 'phone')::int`,
    })
    .from(placeEvents)
    .where(and(eq(placeEvents.placeId, placeId), gte(placeEvents.createdAt, since)));

  // Buckets diarios pa el sparkline. date_trunc en UTC — suficiente para MVP.
  const buckets = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${placeEvents.createdAt}), 'YYYY-MM-DD')`,
      views: sql<number>`count(*)::int`,
    })
    .from(placeEvents)
    .where(
      and(
        eq(placeEvents.placeId, placeId),
        eq(placeEvents.eventType, "view"),
        gte(placeEvents.createdAt, since),
      ),
    )
    .groupBy(sql`date_trunc('day', ${placeEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${placeEvents.createdAt}) ASC`);

  return {
    rangeDays,
    views: {
      total: totals?.views ?? 0,
      uniqueVisitors: totals?.uniqueViews ?? 0,
    },
    clicks: {
      total: totals?.clicks ?? 0,
      byChannel: {
        whatsapp: totals?.whatsapp ?? 0,
        instagram: totals?.instagram ?? 0,
        website: totals?.website ?? 0,
        maps: totals?.maps ?? 0,
        phone: totals?.phone ?? 0,
      },
    },
    viewsByDay: buckets,
  };
}

/**
 * Cleanup retention — borra eventos > N días. Piggyback en cron weekly.
 */
export async function deleteOldPlaceEvents(opts?: {
  days?: number;
}): Promise<number> {
  if (!isDbConfigured()) return 0;
  const days = opts?.days ?? 90;
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(placeEvents)
    .where(sql`${placeEvents.createdAt} < ${cutoff}`)
    .returning({ id: placeEvents.id });
  return result.length;
}

// Re-export pa que los callers usen el tipo desde acá si quieren.
export type { PlaceEventChannel, PlaceEventType };
