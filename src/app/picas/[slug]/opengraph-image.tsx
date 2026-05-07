import { ImageResponse } from "next/og";

import { BrandIconSvg, PicaIconSvg } from "@/lib/og-icons";
import { getPicasListBySlug } from "@/lib/picas";

export const alt = "Hambuscador — picá curada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { slug: string };

const MOSTAZA = "#E8A02C";
const MOSTAZA_DEEP = "#C8862A";
const CARBON = "#1F1B17";
const CREMA = "#F5EFE6";
const CREMA_DEEP = "#FAF6EE";
const TINTA = "#6E5F4F";
const TOMATE = "#C84B31";

async function loadDisplayFont(weight: 600 | 700): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css?family=Bricolage+Grotesque:${weight}`;
  const css = await fetch(cssUrl, {
    headers: { "User-Agent": "" },
    next: { revalidate: 86400 },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match || !match[1]) throw new Error("Bricolage URL no encontrada");
  return fetch(match[1], { next: { revalidate: 86400 } }).then((r) =>
    r.arrayBuffer(),
  );
}

export default async function OgImage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const list = getPicasListBySlug(slug);
  const [displayBold, displayBlack] = await Promise.all([
    loadDisplayFont(600).catch(() => null),
    loadDisplayFont(700).catch(() => null),
  ]);

  const fonts = [
    ...(displayBold
      ? [{ name: "Bricolage", data: displayBold, weight: 600 as const, style: "normal" as const }]
      : []),
    ...(displayBlack
      ? [{ name: "Bricolage", data: displayBlack, weight: 700 as const, style: "normal" as const }]
      : []),
  ];

  if (!list) {
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
        {/* Banda hero con gradient mostaza + emoji XL */}
        <div
          style={{
            height: 360,
            width: "100%",
            display: "flex",
            position: "relative",
            background: `linear-gradient(135deg, ${MOSTAZA} 0%, ${MOSTAZA_DEEP} 100%)`,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Patrón decorativo */}
          <div
            style={{
              position: "absolute",
              top: -80,
              left: -80,
              width: 320,
              height: 320,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.10)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -120,
              right: -80,
              width: 420,
              height: 420,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.06)",
              display: "flex",
            }}
          />
          {/* Icono gigante (SVG inline, ver paths abajo) */}
          <div
            style={{
              display: "flex",
              filter: "drop-shadow(0 8px 24px rgba(31,27,23,0.35))",
            }}
          >
            <PicaIconSvg name={list.icon} size={220} color={CARBON} />
          </div>
          {/* Pill superior con tipo de lista */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 28,
              background: CARBON,
              color: CREMA,
              padding: "10px 20px",
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            picá curada
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "36px 48px",
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
              hambuscador · listas
            </div>
            <div
              style={{
                fontSize: 76,
                color: CARBON,
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: 14,
                display: "flex",
                letterSpacing: -1,
              }}
            >
              {list.title}
            </div>
            <div
              style={{
                fontSize: 28,
                color: TINTA,
                display: "flex",
                fontWeight: 600,
              }}
            >
              {list.hook}
            </div>
          </div>

          {/* Footer brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandIconSvg size={48} />
              <div
                style={{
                  fontSize: 28,
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
                color: CREMA_DEEP,
                background: CARBON,
                padding: "8px 16px",
                borderRadius: 999,
                display: "flex",
                fontWeight: 600,
              }}
            >
              hasta {list.maxItems} picás
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
