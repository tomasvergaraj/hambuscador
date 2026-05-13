"use client";

import dynamic from "next/dynamic";

// Chunks pesados pero no críticos: registro del SW + UI del install prompt,
// y reporter de Web Vitals. Los sacamos del bundle inicial del layout para
// que el TTI/INP de la primera vista no cargue con código que solo corre
// después de `window.load` o en `useReportWebVitals`.
//
// `ssr: false` evita el render server-side (innecesario, no producen
// markup) y permite que Next los emita como chunks separados que se
// hidratan post-paint.
const PwaInstaller = dynamic(
  () => import("./pwa-installer").then((m) => ({ default: m.PwaInstaller })),
  { ssr: false },
);
const WebVitals = dynamic(
  () =>
    import("@/components/perf/web-vitals").then((m) => ({ default: m.WebVitals })),
  { ssr: false },
);

export function DeferredChrome() {
  return (
    <>
      <PwaInstaller />
      <WebVitals />
    </>
  );
}
