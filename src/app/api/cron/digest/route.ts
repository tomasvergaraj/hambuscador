import type { NextRequest } from "next/server";

import { sendDigestsForFrequency } from "@/server/services/email-digest";
import { deleteOldPlaceEvents } from "@/server/services/place-events";
import { expireDuePromotions } from "@/server/services/promotions";
import { expireDueSubscriptions } from "@/server/services/subscriptions";
import { deleteOldWebVitals } from "@/server/services/web-vitals";

/**
 * Endpoint del cron de email digest. Lo invoca Vercel Cron con dos schedules
 * (ver vercel.json):
 *   - daily:  todos los días 12:00 UTC (≈ 09:00 -03 Chile no-DST)
 *   - weekly: lunes 12:00 UTC
 *
 * Protección: header `Authorization: Bearer ${CRON_SECRET}`. Vercel agrega
 * este header automáticamente cuando dispara el cron — pa el resto del mundo
 * el endpoint responde 401.
 *
 * Query param `freq=daily|weekly` discrimina cuál batch correr.
 *
 * 200 con summary JSON pa que los logs muestren qué pasó (visible en Vercel
 * function logs filtrando "[cron/digest]"). Errores granulares quedan dentro
 * de sendDigestsForFrequency (no falla todo el cron por un user roto).
 */

const ALLOWED_FREQ = new Set(["daily", "weekly"] as const);

export const dynamic = "force-dynamic";
export const maxDuration = 60; // segundos — Hobby allow up to 60s

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  if (!secret || authz !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const freqParam = req.nextUrl.searchParams.get("freq") ?? "daily";
  if (!ALLOWED_FREQ.has(freqParam as "daily" | "weekly")) {
    return new Response("invalid freq", { status: 400 });
  }
  const frequency = freqParam as "daily" | "weekly";

  const summary = await sendDigestsForFrequency(frequency);
  console.log(
    "[cron/digest]",
    frequency,
    "candidates=",
    summary.candidates,
    "sent=",
    summary.sent,
    "skipped=",
    summary.skippedNoNotifs,
    "failed=",
    summary.failed,
  );

  // Piggyback expiración de subscriptions en el run daily — Hobby tier nos
  // limita a 2 crons. Las subs vencidas pasan a `expired` y revertimos
  // `places.is_featured` para que dejen de boostearse.
  let subscriptions: { expired: number } | null = null;
  let promotionsExpired: { expired: number } | null = null;
  if (frequency === "daily") {
    try {
      subscriptions = await expireDueSubscriptions();
      console.log("[cron/subscriptions] expired=", subscriptions.expired);
    } catch (err) {
      console.error("[cron/subscriptions] failed:", err);
      subscriptions = { expired: 0 };
    }
    // Promos vencidas — set is_active=false. Filter queries del público
    // ya gatean por ends_at > now, pero apagar la flag mantiene los index
    // baratos y consistencia con la moderation_status pipeline.
    try {
      promotionsExpired = await expireDuePromotions();
      console.log("[cron/promotions] expired=", promotionsExpired.expired);
    } catch (err) {
      console.error("[cron/promotions] failed:", err);
      promotionsExpired = { expired: 0 };
    }
  }

  // Piggyback maintenance en el run weekly — el lunes 12:00 UTC también
  // limpia tablas analytics viejas para que queries P75/P95/stats sigan
  // baratos. Retention controlable via env.
  let maintenance: {
    webVitalsDeleted: number;
    placeEventsDeleted: number;
  } | null = null;
  if (frequency === "weekly") {
    const cwvRetention = Number(process.env.CWV_RETENTION_DAYS) || 90;
    const placeEventsRetention =
      Number(process.env.PLACE_EVENTS_RETENTION_DAYS) || 90;
    const [webVitalsDeleted, placeEventsDeleted] = await Promise.all([
      deleteOldWebVitals({ days: cwvRetention }),
      deleteOldPlaceEvents({ days: placeEventsRetention }),
    ]);
    maintenance = { webVitalsDeleted, placeEventsDeleted };
    console.log(
      "[cron/maintenance] web_vitals=",
      webVitalsDeleted,
      "(", cwvRetention, "d) place_events=",
      placeEventsDeleted,
      "(", placeEventsRetention, "d)",
    );
  }

  return Response.json({
    ...summary,
    subscriptions,
    promotions: promotionsExpired,
    maintenance,
  });
}
