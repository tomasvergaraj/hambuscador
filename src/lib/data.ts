// ============================================================================
// Data layer (public API que consumen las pages)
// ----------------------------------------------------------------------------
// Este archivo es la fachada que usan las pages. Internamente delega en los
// services del server (`src/server/services/*`), que a su vez consultan la
// DB cuando DATABASE_URL está seteado o caen al mock cuando no.
//
// Las pages importan de aquí (no de `@/server/services/*`) porque acá podemos
// poner caching de Next.js, revalidation tags, etc. en una sola capa.
//
// Convención: TODAS las funciones son async — incluso las que internamente
// no necesitan await en modo mock — para mantener una API uniforme.
// ============================================================================

import { unstable_cache as cache } from "next/cache";

import {
  getPlaceBySlug as getPlaceBySlugSvc,
  getPlacesNearby as getPlacesNearbySvc,
  getRecentlyApprovedPlaces as getRecentlyApprovedPlacesSvc,
  searchPlaces as searchPlacesSvc,
} from "@/server/services/places";
import {
  getPlacesForPicasList as getPlacesForPicasListSvc,
  getPicasListsWithCounts as getPicasListsWithCountsSvc,
} from "@/server/services/picas";
import {
  getActiveComunas as getActiveComunasSvc,
  getAllComunas as getAllComunasSvc,
} from "@/server/services/comunas";
import { getActiveRegions as getActiveRegionsSvc } from "@/server/services/regions";
import { searchPublicUsers as searchPublicUsersSvc } from "@/server/services/users";
import {
  getReviewById as getReviewByIdSvc,
  getReviewsByPlaceId as getReviewsByPlaceIdSvc,
} from "@/server/services/reviews";
import {
  MOCK_PLACES,
  MOCK_REVIEWS,
  getPlaceBySlugMock,
  getPlacesNearbyMock,
  getReviewsByPlaceIdMock,
  searchPlacesMock,
} from "@/server/services/mock";

// ============================================================================
// Wrappers públicos (lo que las pages importan)
// ============================================================================

/**
 * Locales cerca del usuario, ordenados por distancia.
 * Cuando no hay coords del usuario aún, ordena por rating.
 */
export const getPlacesNearby = cache(
  async (opts?: { lat?: number; lng?: number; radiusM?: number; limit?: number }) => {
    return getPlacesNearbySvc(opts);
  },
  ["places-nearby"],
  { revalidate: 60, tags: ["places"] },
);

/**
 * Ficha pública por (comuna, slug). El "endpoint" de SEO.
 */
export const getPlaceBySlug = cache(
  async (comuna: string, slug: string) => {
    return getPlaceBySlugSvc(comuna, slug);
  },
  ["place-by-slug"],
  { revalidate: 300, tags: ["places"] },
);

/**
 * Búsqueda con texto libre + filtros. Retorna `{ items, usedFuzzy }`.
 * Caching más corto porque el query space es grande.
 */
export const searchPlaces = cache(
  async (
    query: string,
    filters?: {
      cuisines?: string[];
      priceRanges?: string[];
      comunaSlug?: string;
      openNow?: boolean;
      sort?: "rating" | "recent" | "distance";
      userCoords?: { lat: number; lng: number };
      /** Default 30 (lista). El mapa pide más para ver todos los pins. */
      limit?: number;
    },
  ) => {
    return searchPlacesSvc({
      query,
      cuisines: filters?.cuisines,
      priceRanges: filters?.priceRanges,
      comunaSlug: filters?.comunaSlug,
      openNow: filters?.openNow,
      sort: filters?.sort,
      userCoords: filters?.userCoords,
      limit: filters?.limit,
    });
  },
  ["places-search"],
  { revalidate: 30, tags: ["places"] },
);

/**
 * Locales recién aprobados (default últimos 14d). Para sección "recién agregadas"
 * en el home. Cache corta porque el set rota seguido.
 */
export const getRecentlyApprovedPlaces = cache(
  async (limit?: number) => {
    return getRecentlyApprovedPlacesSvc({ limit });
  },
  ["places-recent"],
  { revalidate: 120, tags: ["places"] },
);

/**
 * Picás (listas curadas) — resolución de criteria → places ordenados por popularidad.
 * Cache larga porque las listas son hardcoded y los places cambian poco.
 */
export const getPlacesForPicasList = cache(
  async (slug: string) => {
    const { getPicasListBySlug } = await import("@/lib/picas");
    const list = getPicasListBySlug(slug);
    if (!list) return null;
    const places = await getPlacesForPicasListSvc(list);
    return { list, places };
  },
  ["picas-list-by-slug"],
  { revalidate: 300, tags: ["places"] },
);

export const getPicasListsWithCounts = cache(
  async () => getPicasListsWithCountsSvc(),
  ["picas-lists-counts"],
  { revalidate: 300, tags: ["places"] },
);

/**
 * Regiones de Chile con ≥1 place aprobado. Cache larga porque cambia rara vez
 * (solo cuando llega la primera picá de una región nueva). Se invalida con el
 * tag `places` que ya disparan aprobaciones / creates.
 */
export const getActiveRegions = cache(
  async () => getActiveRegionsSvc(),
  ["regions-active"],
  { revalidate: 600, tags: ["places"] },
);

/**
 * Comunas con ≥1 place aprobado — para el dropdown de sugerencias y filtros.
 * Cache moderada porque el set crece cuando aprueban un local en una comuna
 * nueva. Tag `places` la invalida con cada aprobación.
 */
export const getActiveComunas = cache(
  async () => getActiveComunasSvc(),
  ["comunas-active"],
  { revalidate: 600, tags: ["places"] },
);

/**
 * Las 346 comunas oficiales. Para el wizard `/agregar` (autocomplete sobre
 * todo el país). Cache larga porque cambia rara vez (creación de regiones/
 * comunas es proceso legal de años).
 */
export const getAllComunas = cache(
  async () => getAllComunasSvc(),
  ["comunas-all"],
  { revalidate: 86400 },
);

/**
 * Sugerencias de perfiles públicos para el dropdown global. Cache corto —
 * la activity (review_count) cambia con cada review que postean.
 */
export const searchPublicUsers = cache(
  async (q: string) => searchPublicUsersSvc(q),
  ["users-public-search"],
  { revalidate: 60, tags: ["users"] },
);

/**
 * Reseñas de un local, más recientes primero.
 */
export const getReviewsByPlaceId = cache(
  async (placeId: string) => {
    return getReviewsByPlaceIdSvc(placeId);
  },
  ["reviews-by-place"],
  { revalidate: 30, tags: ["reviews"] },
);

/**
 * Reseña pública por id (con autor y local), para `/r/[id]` y su OG.
 */
export const getReviewById = cache(
  async (reviewId: string) => getReviewByIdSvc(reviewId),
  ["review-by-id"],
  { revalidate: 60, tags: ["reviews"] },
);

// ============================================================================
// Re-exportar mocks para tests / seed / debugging
// ============================================================================

export {
  MOCK_PLACES,
  MOCK_REVIEWS,
  getPlacesNearbyMock,
  getPlaceBySlugMock,
  getReviewsByPlaceIdMock,
  searchPlacesMock,
};
