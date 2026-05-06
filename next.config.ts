import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // El proyecto se sirve solo en español (Chile) por ahora
  // TODO Fase 4: agregar metadata.alternates si llegamos a soportar locales
  images: {
    // TODO Fase 2: cuando integremos S3/R2/Supabase Storage agregar el dominio aquí
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
};

export default nextConfig;
