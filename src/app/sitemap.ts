import type { MetadataRoute } from "next";

import { getApprovedSlugs } from "@/server/services/places";

// ============================================================================
// Sitemap dinámico — Next.js lo expone en /sitemap.xml.
// Combina rutas estáticas (home, buscar) + ficha pública de cada local
// aprobado. Updates last-modified usando `places.updated_at`.
// ============================================================================

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://hambuscador.cl";

// Refresh fallback: cada hora máximo. El admin approve action invalida
// `/sitemap.xml` on-demand, así que en el camino feliz el sitemap se
// actualiza al instante de aprobar — esto es solo el techo.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getApprovedSlugs();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/buscar`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/agregar`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const placeRoutes: MetadataRoute.Sitemap = slugs.map((p) => ({
    url: `${SITE_URL}/${p.comunaSlug}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...placeRoutes];
}
