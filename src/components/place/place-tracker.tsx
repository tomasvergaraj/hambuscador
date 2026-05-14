"use client";

import { useEffect } from "react";

/**
 * Cliente analítico de la ficha del local. Una sola vez por mount:
 *  - Manda evento `view` al montar (dedup por sessionStorage pa evitar
 *    contar 2 veces el mismo viewer en el mismo session si re-monta).
 *  - Listener global `click` que dispara `contact_click` cuando el target
 *    (o ancestor) tiene `data-track-channel`. sendBeacon — sobrevive a
 *    la navegación inmediata del click.
 *
 * Los eventos van a `/api/track/event` que cookies el visitor (hb_v 30d).
 */
export function PlaceTracker({ placeId }: { placeId: string }) {
  useEffect(() => {
    // View dedup por session.
    const viewKey = `hb_view:${placeId}`;
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, "1");
      sendEvent({ placeId, eventType: "view" });
    }

    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-track-channel]") as HTMLElement | null;
      if (!el) return;
      const channel = el.dataset.trackChannel;
      if (!channel) return;
      sendEvent({ placeId, eventType: "contact_click", channel });
    };
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [placeId]);

  return null;
}

function sendEvent(payload: {
  placeId: string;
  eventType: "view" | "contact_click";
  channel?: string;
}) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track/event", blob);
      return;
    }
    fetch("/api/track/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — analytics nunca rompe UX */
  }
}
