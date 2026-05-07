import { ImageResponse } from "next/og";

import { getPlaceBySlug } from "@/lib/data";
import { BrandIconSvg, StarFilledSvg } from "@/lib/og-icons";

// ============================================================================
// OG image dinámico por local. Next.js convención: este archivo, al lado
// de page.tsx, expone automáticamente:
//   - <meta property="og:image"> apuntando a esta ruta (1200x630)
//   - generación on-demand al primer hit (cacheado por Next)
//
// Cuando alguien comparte el link en WhatsApp / IG / Twitter / Slack, el
// preview muestra el local con su foto, rating y comuna en vez de un og
// generic.
// ============================================================================

// Runtime nodejs (default): la DB usa `pg` que no anda en edge runtime.
// Si quisiéramos edge, habría que migrar a un driver compatible (Neon http).
export const alt = "Hambuscador — picá hamburguesera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { comuna: string; slug: string };

const MOSTAZA = "#E8A02C";
const MOSTAZA_DEEP = "#C8862A";
const CARBON = "#1F1B17";
const CARBON_SOFT = "#2A2520";
const CREMA = "#F5EFE6";
const CREMA_DEEP = "#FAF6EE";
const TINTA = "#6E5F4F";
const TOMATE = "#C84B31";

// ============================================================================
// Fonts — Bricolage Grotesque (display) cargado desde Google Fonts CSS API
// con cache fuerte. Solo se baja una vez por process / por revalidate.
// ============================================================================

async function loadDisplayFont(weight: 600 | 700): Promise<ArrayBuffer> {
  // Google Fonts CSS API negocia formato según el User-Agent. Con UAs
  // modernos devuelve woff2 (Satori embebido en next/og NO soporta woff2
  // en runtime node). Con UA vacío devuelve TTF directo, que sí funciona.
  const cssUrl = `https://fonts.googleapis.com/css?family=Bricolage+Grotesque:${weight}`;
  const css = await fetch(cssUrl, {
    headers: { "User-Agent": "" },
    next: { revalidate: 86400 },
  }).then((r) => r.text());

  // Con IE UA, gstatic devuelve `src: url(...)` directo a un endpoint
  // que entrega TTF. No hay `format(...)` en el CSS, basta el primer
  // url(...).
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match || !match[1]) {
    throw new Error("Bricolage URL no encontrada en CSS de Google Fonts");
  }
  const fontUrl = match[1];
  return fetch(fontUrl, { next: { revalidate: 86400 } }).then((r) =>
    r.arrayBuffer(),
  );
}

export default async function OgImage({ params }: { params: Promise<Params> }) {
  const { comuna, slug } = await params;
  const [place, displayBold, displayBlack] = await Promise.all([
    getPlaceBySlug(comuna, slug),
    loadDisplayFont(600).catch(() => null),
    loadDisplayFont(700).catch(() => null),
  ]);

  const fonts = [
    ...(displayBold
      ? [
          {
            name: "Bricolage",
            data: displayBold,
            weight: 600 as const,
            style: "normal" as const,
          },
        ]
      : []),
    ...(displayBlack
      ? [
          {
            name: "Bricolage",
            data: displayBlack,
            weight: 700 as const,
            style: "normal" as const,
          },
        ]
      : []),
  ];

  // Fallback genérico si el place no existe (edge case: url cacheada de un
  // local rechazado/borrado).
  if (!place) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: CREMA,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Bricolage, system-ui, sans-serif",
            fontSize: 96,
            color: CARBON,
            fontWeight: 700,
          }}
        >
          hambuscador
        </div>
      ),
      { ...size, fonts },
    );
  }

  const cuisinesLabel = place.cuisines.slice(0, 3).join(" · ");

  // ⚠️ Decisión: el hero SIEMPRE es el gradient con watermark, NUNCA la foto
  // del local. Razón: next/og emite PNG y las fotos rasterizadas a PNG pesan
  // ~600 KB+ por sí solas, lo que nos saca del límite recomendado de WhatsApp
  // (<600 KB). El gradient comprime a ~80-150 KB con PNG.
  // La foto del local queda como protagonista en la ficha real (/[comuna]/[slug]).
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CREMA,
          fontFamily: "Bricolage, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            height: 320,
            width: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
            background: `linear-gradient(135deg, ${MOSTAZA} 0%, ${MOSTAZA_DEEP} 100%)`,
          }}
        >
          <NoPhotoHero name={place.name} />

          {/* Pill rating */}
          {place.rating > 0 && (
            <div
              style={{
                position: "absolute",
                top: 24,
                right: 24,
                background: CARBON,
                color: CREMA,
                padding: "10px 20px",
                borderRadius: 999,
                fontSize: 28,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <StarFilledSvg size={26} color="#FFC107" />
              {place.rating.toFixed(1)}
              <span style={{ fontSize: 18, color: CREMA_DEEP, fontWeight: 600 }}>
                · {place.reviewCount.toLocaleString("es-CL")}{" "}
                {place.reviewCount === 1 ? "reseña" : "reseñas"}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "40px 48px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 18,
                color: TOMATE,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
                display: "flex",
              }}
            >
              {place.comunaLabel} · {place.priceRange}
            </div>
            <div
              style={{
                fontSize: 76,
                color: CARBON,
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: 16,
                display: "flex",
                letterSpacing: -1,
              }}
            >
              {place.name}
            </div>
            {cuisinesLabel ? (
              <div
                style={{
                  fontSize: 28,
                  color: TINTA,
                  display: "flex",
                  fontWeight: 600,
                }}
              >
                {cuisinesLabel}
              </div>
            ) : null}
          </div>

          {/* Footer brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <BrandIconSvg size={56} />
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: CARBON,
                  display: "flex",
                }}
              >
                hambuscador
              </div>
            </div>
            <div
              style={{
                fontSize: 22,
                color: TINTA,
                display: "flex",
                fontWeight: 600,
              }}
            >
              la picá hamburguesera de Chile
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

// ============================================================================
// Hero fallback cuando no hay foto: gradient mostaza con nombre BIG semi
// transparente como marca de agua + 🍔 grande y patrón sutil de puntos.
// ============================================================================

function NoPhotoHero({ name }: { name: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Patrón sutil — círculos translúcidos */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -120,
          width: 400,
          height: 400,
          borderRadius: 9999,
          background: "rgba(255, 255, 255, 0.08)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: 9999,
          background: "rgba(255, 255, 255, 0.06)",
          display: "flex",
        }}
      />

      {/* Watermark del nombre */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 48,
          right: 48,
          fontSize: 200,
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.18)",
          lineHeight: 1,
          letterSpacing: -4,
          display: "flex",
          overflow: "hidden",
          height: 240,
        }}
      >
        {name}
      </div>

      {/* Brand icon central grande (replicando el bun del logo) */}
      <div
        style={{
          display: "flex",
          filter: "drop-shadow(0 8px 24px rgba(31, 27, 23, 0.35))",
        }}
      >
        <BrandIconSvg size={220} />
      </div>

      {/* Tira inferior tipo cinta carbon */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          background: `linear-gradient(90deg, ${CARBON} 0%, ${CARBON_SOFT} 50%, ${CARBON} 100%)`,
          display: "flex",
        }}
      />
    </div>
  );
}
