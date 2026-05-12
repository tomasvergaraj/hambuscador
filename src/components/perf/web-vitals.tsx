"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Reporter de Web Vitals (CLS, LCP, INP, FCP, TTFB, FID). Cada métrica que
 * Next mide la mandamos al endpoint `/api/vitals` con sendBeacon (no bloquea
 * unload). El endpoint hoy logea estructurado a stdout — leíble desde Vercel
 * function logs. Cuando se justifique, persistir en una tabla o redirigir a
 * un servicio (Plausible custom events, Datadog RUM, etc.).
 *
 * Solo activa en prod para no contaminar el dev con ruido del HMR.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;

    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType,
      path: typeof window !== "undefined" ? window.location.pathname : null,
    });

    const url = "/api/vitals";
    const sent =
      typeof navigator !== "undefined" && "sendBeacon" in navigator
        ? navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
        : false;

    if (!sent) {
      // Fallback: fetch keepalive — sobrevive al unload en browsers modernos.
      void fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        /* silent — métricas no son críticas */
      });
    }
  });

  return null;
}
