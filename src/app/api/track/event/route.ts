import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { after, type NextRequest } from "next/server";

import { trackPlaceEvent } from "@/server/services/place-events";

/**
 * Recibe eventos analíticos de la ficha pública (view + contact_click).
 * Diseñado pa `navigator.sendBeacon` — body chico, fire-and-forget, 204.
 *
 * Cookie `hb_v` (30d, HttpOnly false porque la setea el server pa que el
 * client la mande, SameSite=Lax) identifica visitantes únicos. No tiene
 * datos personales — solo random uuid. Se setea on first view si no existe.
 *
 * Sin auth: cualquiera puede emitir eventos. Cap defensivo de payload
 * + validación estricta. Rate-limit por IP es Cloudflare's job si llega
 * spam (no implementado en MVP).
 */

const MAX_BYTES = 512;
const ALLOWED_EVENTS = new Set(["view", "contact_click"]);
const ALLOWED_CHANNELS = new Set(["whatsapp", "instagram", "website", "maps", "phone"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const placeId = typeof parsed.placeId === "string" ? parsed.placeId : "";
    const eventType =
      typeof parsed.eventType === "string" ? parsed.eventType : "";
    const channelRaw = typeof parsed.channel === "string" ? parsed.channel : null;

    if (!UUID_RE.test(placeId)) return new Response(null, { status: 400 });
    if (!ALLOWED_EVENTS.has(eventType)) return new Response(null, { status: 400 });
    if (channelRaw && !ALLOWED_CHANNELS.has(channelRaw)) {
      return new Response(null, { status: 400 });
    }
    if (eventType === "contact_click" && !channelRaw) {
      return new Response(null, { status: 400 });
    }

    // visitor_id cookie — set si no existe.
    const cookieStore = await cookies();
    let visitorId = cookieStore.get("hb_v")?.value ?? null;
    const res = new Response(null, { status: 204 });
    if (!visitorId) {
      visitorId = randomUUID();
      // 30 días, lax, no httpOnly (no es sensible — solo dedup).
      res.headers.append(
        "set-cookie",
        `hb_v=${visitorId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
      );
    }

    after(
      trackPlaceEvent({
        placeId,
        eventType: eventType as "view" | "contact_click",
        channel: channelRaw as
          | "whatsapp"
          | "instagram"
          | "website"
          | "maps"
          | "phone"
          | null,
        visitorId,
      }).catch((err) => console.error("[track/event] trackPlaceEvent:", err)),
    );

    return res;
  } catch (err) {
    console.error("[track/event] handler:", err);
    return new Response(null, { status: 500 });
  }
}
