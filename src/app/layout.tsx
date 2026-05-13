import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";

import { SessionProvider } from "@/components/auth/session-provider";
import { DeferredChrome } from "@/components/pwa/deferred-chrome";
import { auth } from "@/server/auth";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["500", "600", "700"],
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hambuscador — la picá hamburguesera de Chile",
    template: "%s · Hambuscador",
  },
  description:
    "Encuentra, califica y descubre las mejores hamburgueserías de todo Chile. Reseñas reales, fotos del producto y rankings por comuna.",
  // Base absoluta para resolver URLs en metadata (og:image, canonical, etc).
  // Lee de env porque mientras no haya dominio propio el deploy vive en
  // *.vercel.app, y un metadataBase hardcodeado al dominio futuro hace que
  // WhatsApp / scrapers fallen al pedir la og:image (404).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://hambuscador.cl",
  ),
  applicationName: "Hambuscador",
  authors: [{ name: "Hambuscador" }],
  keywords: [
    "hamburguesas",
    "hamburgueserías",
    "Chile",
    "Santiago",
    "smash burger",
    "reseñas",
    "picás",
  ],
  openGraph: {
    title: "Hambuscador",
    description: "La picá hamburguesera de Chile.",
    type: "website",
    locale: "es_CL",
    siteName: "Hambuscador",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hambuscador.cl",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hambuscador",
    description: "La picá hamburguesera de Chile.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#E8A02C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

// Origen del bucket de fotos para emitir preconnect. Sin esto, el browser
// arranca DNS+TLS recién cuando descubre el primer <img> — penaliza el LCP
// de cualquier página con cards (que son casi todas). Con preconnect, el
// handshake corre en paralelo al HTML.
const PHOTOS_ORIGIN = (() => {
  const raw = process.env.R2_PUBLIC_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hidratamos la sesión inicial en el server para que el SessionProvider
  // del cliente no haga un round-trip extra al montar. useSession().update(...)
  // sigue funcionando después de eso para refrescar el JWT.
  const session = await auth();
  return (
    <html lang="es" className={`${bricolage.variable} ${geist.variable}`}>
      <head>
        {PHOTOS_ORIGIN && (
          <>
            <link rel="preconnect" href={PHOTOS_ORIGIN} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={PHOTOS_ORIGIN} />
          </>
        )}
      </head>
      <body>
        <SessionProvider session={session}>
          {children}
          <DeferredChrome />
        </SessionProvider>
      </body>
    </html>
  );
}
