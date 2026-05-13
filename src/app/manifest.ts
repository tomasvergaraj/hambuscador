import type { MetadataRoute } from "next";

/**
 * Web App Manifest dinámico. Convención Next 15: este archivo se sirve
 * automáticamente en `/manifest.webmanifest`. Beneficio sobre el archivo
 * estático: puede leer env vars (siteUrl absoluto, feature flags) y mantener
 * el contenido tipado.
 *
 * NOTA: el handler PWA share_target POST sigue siendo interceptado por el
 * Service Worker (public/sw.js) que stashes los Files en IDB y redirige a
 * `/agregar?share=1`. El server endpoint `/api/share` es solo fallback.
 */
export default function manifest(): MetadataRoute.Manifest {
  const startUrl = "/";
  return {
    name: "Hambuscador",
    short_name: "Hambuscador",
    description:
      "La picá hamburguesera de Chile. Buscador, registro y rating de hamburgueserías a lo largo de todo Chile.",
    start_url: startUrl,
    display: "standalone",
    background_color: "#F5EFE6",
    theme_color: "#E8A02C",
    lang: "es-CL",
    dir: "ltr",
    scope: "/",
    categories: ["food", "lifestyle", "travel"],
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/app-icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/api/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "photos",
            accept: ["image/jpeg", "image/png", "image/webp"],
          },
        ],
      },
    },
    shortcuts: [
      {
        name: "Buscar picás",
        short_name: "Buscar",
        description: "Buscar hamburgueserías por barrio o nombre",
        url: "/buscar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Agregar local",
        short_name: "Agregar",
        description: "Sumar una hamburguesería al directorio",
        url: "/agregar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Mi perfil",
        short_name: "Perfil",
        description: "Tus reseñas, favoritos y aportes",
        url: "/perfil",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
