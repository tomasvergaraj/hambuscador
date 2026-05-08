import type { NextConfig } from "next";

// Para next/image: parsea R2_PUBLIC_URL y agrega su hostname a remotePatterns.
// Acepta http o https; si la var no está, no agrega nada (modo demo).
function r2RemotePattern() {
  const raw = process.env.R2_PUBLIC_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
}

const r2Pattern = r2RemotePattern();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(r2Pattern ? [r2Pattern] : []),
    ],
  },
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
  // Atajo viral: hambuscador.cl/@camila → /u/camila. Internal rewrite, la
  // URL en la barra del navegador queda con @ (más memorable, estilo Twitter).
  async rewrites() {
    return [
      {
        source: "/@:username",
        destination: "/u/:username",
      },
    ];
  },
};

export default nextConfig;
