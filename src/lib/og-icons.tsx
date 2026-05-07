// ============================================================================
// SVG inline para usar dentro de `next/og` ImageResponse.
// ----------------------------------------------------------------------------
// Satori renderiza SVG simple — no soporta React components arbitrarios bien,
// así que mantenemos estos como funciones puras que retornan JSX SVG.
// ----------------------------------------------------------------------------
// Paths extraídos de @tabler/icons v3 para mantener consistencia con la UI.
// ============================================================================

import type { PicaIconName } from "./picas";

// Brand colors (replicados acá para no importar otros módulos).
const BRAND_MOSTAZA = "#E8A02C";
const BRAND_MOSTAZA_DEEP = "#C8862A";
const BRAND_CREMA_DEEP = "#FAF6EE";
const BRAND_LECHUGA = "#6B8E4E";
const BRAND_CARBON = "#3E2723";

/**
 * Logo de Hambuscador en formato OG (icon-only). Usa los mismos paths que
 * `public/icon.svg` para que el preview social tenga el mismo branding.
 */
export function BrandIconSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "flex" }}
    >
      <path
        d="M6,30 C6,14 18,6 32,6 C46,6 58,14 58,30 Z"
        fill={BRAND_MOSTAZA}
      />
      <ellipse cx="22" cy="20" rx="1.4" ry="1.9" fill={BRAND_CREMA_DEEP} />
      <ellipse cx="32" cy="15" rx="1.4" ry="1.9" fill={BRAND_CREMA_DEEP} />
      <ellipse cx="42" cy="20" rx="1.4" ry="1.9" fill={BRAND_CREMA_DEEP} />
      <path
        d="M4,30 L60,30 L60,34 Q56,37 52,34 Q48,37 44,34 Q40,37 36,34 Q32,37 28,34 Q24,37 20,34 Q16,37 12,34 Q8,37 4,34 Z"
        fill={BRAND_LECHUGA}
      />
      <rect x="4" y="36" width="56" height="10" rx="2.5" fill={BRAND_CARBON} />
      <path
        d="M6,46 L58,46 L58,50 C58,55 46,58 32,58 C18,58 6,55 6,50 Z"
        fill={BRAND_MOSTAZA_DEEP}
      />
    </svg>
  );
}

/**
 * Estrella rellena para el rating pill del OG (reemplaza el emoji ⭐).
 * Path de Tabler IconStarFilled.
 */
export function StarFilledSvg({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "flex" }}
    >
      <path
        d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Iconos de listas curadas. Paths extraídos de Tabler v3:
 *  - flame   → IconFlameFilled
 *  - leaf    → IconLeaf (outline)
 *  - coin    → IconCoin (outline)
 *  - sparkles → IconSparkles (outline)
 *  - map-pin → IconMapPinFilled
 */
export function PicaIconSvg({
  name,
  size,
  color,
}: {
  name: PicaIconName;
  size: number;
  color: string;
}) {
  const filled = name === "flame" || name === "map-pin";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "flex" }}
    >
      {iconPaths(name)}
    </svg>
  );
}

function iconPaths(name: PicaIconName) {
  switch (name) {
    case "flame":
      return (
        <path d="M10 2c0 -.88 1.056 -1.331 1.692 -.722c1.958 1.876 3.096 5.995 1.75 9.12l-.08 .174l.012 .003c.625 .133 1.203 -.43 2.303 -2.173l.14 -.224a1 1 0 0 1 1.582 -.153c1.334 1.435 2.601 4.377 2.601 6.27c0 4.265 -3.591 7.705 -8 7.705s-8 -3.44 -8 -7.706c0 -2.252 1.022 -4.716 2.632 -6.301l.605 -.589c.241 -.236 .434 -.43 .618 -.624c1.43 -1.512 2.145 -2.924 2.145 -4.78" />
      );
    case "leaf":
      return (
        <>
          <path d="M5 21c.5 -4.5 2.5 -8 7 -10" />
          <path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0" />
        </>
      );
    case "coin":
      return (
        <>
          <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
          <path d="M12 7v10" />
        </>
      );
    case "sparkles":
      return (
        <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6" />
      );
    case "map-pin":
      return (
        <path d="M18.364 4.636a9 9 0 0 1 .203 12.519l-.203 .21l-4.243 4.242a3 3 0 0 1 -4.097 .135l-.144 -.135l-4.244 -4.243a9 9 0 0 1 12.728 -12.728zm-6.364 3.364a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" />
      );
  }
}
