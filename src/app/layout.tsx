import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
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
  metadataBase: new URL("https://hambuscador.cl"),
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
    url: "https://hambuscador.cl",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${bricolage.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
