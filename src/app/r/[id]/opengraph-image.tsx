import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getReviewById } from "@/lib/data";
import { BrandIconSvg, StarFilledSvg } from "@/lib/og-icons";

// ============================================================================
// OG image dinámica de una reseña individual. Compartir /r/[id] muestra el
// rating, snippet del texto, autor y nombre del local. Si el reviewer subió
// foto, va como background del top band con overlay carbon — más auténtico
// que el gradient. Sin foto cae al gradient mostaza original.
// Pasamos por sharp (mozjpeg q70) para mantener <200KB con foto incrustada.
// ============================================================================

export const alt = "Reseña en Hambuscador";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

const JPEG_QUALITY = 70;

async function respondJpeg(og: ImageResponse): Promise<Response> {
  const pngBuf = Buffer.from(await og.arrayBuffer());
  const jpegBuf = await sharp(pngBuf)
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Response(jpegBuf as unknown as BodyInit, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, immutable, no-transform, max-age=86400",
    },
  });
}

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
  if (!match || !match[1]) {
    throw new Error("Bricolage URL no encontrada en CSS de Google Fonts");
  }
  return fetch(match[1], { next: { revalidate: 86400 } }).then((r) =>
    r.arrayBuffer(),
  );
}

function truncateForOg(text: string | null, max: number): string {
  if (!text) return "";
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

export default async function ReviewOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [review, displayBold, displayBlack] = await Promise.all([
    getReviewById(id),
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

  if (!review) {
    return respondJpeg(
      new ImageResponse(
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
      ),
    );
  }

  const snippet = truncateForOg(review.text, 220);
  const heroPhoto = review.photos?.[0] ?? null;

  return respondJpeg(
    new ImageResponse(
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
          {/* Top band: rating + autor sobre foto (si hay) o gradient */}
          <div
            style={{
              height: 200,
              width: "100%",
              display: "flex",
              position: "relative",
              overflow: "hidden",
              background: `linear-gradient(135deg, ${MOSTAZA} 0%, ${MOSTAZA_DEEP} 100%)`,
              padding: "32px 48px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {heroPhoto ? (
              <>
                <img
                  src={heroPhoto}
                  alt=""
                  width={1200}
                  height={200}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: 1200,
                    height: 200,
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    background:
                      "linear-gradient(180deg, rgba(31,27,23,0.55) 0%, rgba(31,27,23,0.30) 50%, rgba(31,27,23,0.65) 100%)",
                  }}
                />
              </>
            ) : null}
            {/* Stars — contraste según haya foto (dark overlay) o gradient */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                position: "relative",
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i < review.rating;
                const color = heroPhoto
                  ? filled
                    ? CREMA
                    : "rgba(245,239,230,0.30)"
                  : filled
                    ? CARBON
                    : "rgba(31,27,23,0.18)";
                return <StarFilledSvg key={i} size={56} color={color} />;
              })}
            </div>

          {/* Autor pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: CARBON,
              color: CREMA,
              padding: "12px 20px 12px 12px",
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: MOSTAZA,
                color: CARBON,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {review.author.initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 24, fontWeight: 700, display: "flex" }}>
                {review.author.name}
              </div>
              {review.author.username ? (
                <div
                  style={{
                    fontSize: 16,
                    color: CREMA_DEEP,
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  @{review.author.username}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Body: snippet + place */}
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
                fontSize: 16,
                color: TOMATE,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 12,
                display: "flex",
              }}
            >
              reseña en hambuscador
            </div>
            {snippet ? (
              <div
                style={{
                  fontSize: 38,
                  color: CARBON,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  display: "flex",
                  letterSpacing: -0.5,
                }}
              >
                {`"${snippet}"`}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 44,
                  color: CARBON,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  display: "flex",
                  letterSpacing: -0.5,
                }}
              >
                {review.author.name} le puso{" "}
                {review.rating === 5 ? "5 estrellas " : `${review.rating} estrellas `}
                a {review.place.name}.
              </div>
            )}
          </div>

          {/* Footer: place + brand */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              borderTop: `2px solid ${CREMA_DEEP}`,
              paddingTop: 20,
              marginTop: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 720,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: TINTA,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  display: "flex",
                  marginBottom: 4,
                }}
              >
                sobre la picá
              </div>
              <div
                style={{
                  fontSize: 36,
                  color: CARBON,
                  fontWeight: 700,
                  display: "flex",
                  letterSpacing: -0.5,
                }}
              >
                {review.place.name}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: TINTA,
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {review.place.comunaLabel}, {review.place.region}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <BrandIconSvg size={44} />
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: CARBON,
                  display: "flex",
                }}
              >
                hambuscador
              </div>
            </div>
          </div>
        </div>
        </div>
      ),
      { ...size, fonts },
    ),
  );
}
