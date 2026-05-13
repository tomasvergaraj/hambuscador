import { after } from "next/server";
import type { NextRequest } from "next/server";

import { logVital } from "@/server/services/web-vitals";

/**
 * Recibe métricas de Web Vitals desde el client (sendBeacon o fetch keepalive).
 * Las persiste en `web_vitals` vía next/after() para no bloquear el 204, y
 * además logea estructurado para Vercel function logs (grepeable como `[vitals]`).
 *
 * 204 No Content — beacons no esperan body. Cap defensivo de payload pa no
 * llenar logs/DB con basura si alguien intenta abusar el endpoint.
 */

const MAX_BYTES = 1024;

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) {
      return new Response(null, { status: 413 });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400 });
    }
    const name = typeof parsed.name === "string" ? parsed.name : "?";
    const value =
      typeof parsed.value === "number" ? parsed.value : Number(parsed.value);
    const rating = typeof parsed.rating === "string" ? parsed.rating : null;
    const path = typeof parsed.path === "string" ? parsed.path : null;
    const metricId = typeof parsed.id === "string" ? parsed.id : null;
    const navType =
      typeof parsed.navigationType === "string" ? parsed.navigationType : null;

    // Log inmediato — visible en Vercel logs aún si la DB falla.
    console.log(
      "[vitals]",
      name,
      Number.isFinite(value) ? Math.round(value) : value,
      rating ?? "?",
      path ?? "?",
    );

    // Persistir fire-and-forget — el 204 no espera la insert.
    if (Number.isFinite(value)) {
      after(
        logVital({
          metric: name,
          value,
          rating,
          path,
          metricId,
          navType,
        }),
      );
    }
  } catch {
    /* ignorar — no quemar latencia respondiendo errores estructurados */
  }
  return new Response(null, { status: 204 });
}
