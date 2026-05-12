import type { NextRequest } from "next/server";

/**
 * Recibe métricas de Web Vitals desde el client (sendBeacon o fetch keepalive).
 * Las logueamos estructurado pa que aparezcan en Vercel function logs. Después
 * se puede grepear/exportar. Cuando justifique, persistir en una tabla
 * `web_vitals` o forwardear a un servicio externo.
 *
 * 204 No Content — beacons no esperan body. Cap defensivo de payload pa no
 * llenar logs con basura si alguien intenta abusar el endpoint.
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
    // Logging mínimo. Format: vitals | name | value | rating | path
    console.log(
      "[vitals]",
      parsed.name,
      typeof parsed.value === "number" ? Math.round(parsed.value) : parsed.value,
      parsed.rating ?? "?",
      parsed.path ?? "?",
    );
  } catch {
    /* ignorar — no quemar latencia respondiendo errores estructurados */
  }
  return new Response(null, { status: 204 });
}
