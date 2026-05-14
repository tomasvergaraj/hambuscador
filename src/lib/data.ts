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
  getActivePicasLists as getActivePicasListsSvc,
  getPicasListBySlugFromDb as getPicasListBySlugFromDbSvc,
} from "@/server/services/picas-lists";
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
import { getRepliesForReviewIds as getRepliesForReviewIdsSvc } from "@/server/services/review-replies";
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
 * Las listas viven en `picas_lists` (DB) y se editan desde /admin/picas.
 * Cache larga porque el set rara vez cambia.
 */
export const getPlacesForPicasList = cache(
  async (slug: string) => {
    const list = await getPicasListBySlugFromDbSvc(slug);
    if (!list) return null;
    const places = await getPlacesForPicasListSvc(list);
    return { list, places };
  },
  ["picas-list-by-slug"],
  { revalidate: 300, tags: ["places", "picas-lists"] },
);

export const getPicasListsWithCounts = cache(
  async () => getPicasListsWithCountsSvc(),
  ["picas-lists-counts"],
  { revalidate: 300, tags: ["places", "picas-lists"] },
);

/**
 * Listas activas del index `/picas` (también usadas por sitemap y suggest).
 * Cache larga — invalidan ediciones del admin vía tag `picas-lists`.
 */
export const getActivePicasLists = cache(
  async () => getActivePicasListsSvc(),
  ["picas-lists-active"],
  { revalidate: 600, tags: ["picas-lists"] },
);

export const getPicasListBySlugFromDb = cache(
  async (slug: string) => getPicasListBySlugFromDbSvc(slug),
  ["picas-list-row-by-slug"],
  { revalidate: 600, tags: ["picas-lists"] },
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
 *
 * Cuando `excludeAuthorId` se pasa, omite la reseña del autor — útil en la
 * detail page cuando "tu reseña" se trae aparte con `getMyReviewWithAuthor`
 * y queremos los "otros" sin contar la propia. La key del cache incluye el
 * exclude para no mezclar resultados entre usuarios.
 */
export const getReviewsByPlaceId = cache(
  async (
    placeId: string,
    opts?: { limit?: number; excludeAuthorId?: string },
  ) => {
    return getReviewsByPlaceIdSvc(placeId, opts);
  },
  ["reviews-by-place"],
  { revalidate: 30, tags: ["reviews"] },
);

/**
 * Replies del owner pa un set de review ids. Cache compartido por reseñas
 * del local — el detail page hace 1 sola query.
 *
 * No cacheamos por reviewIds[] como key (cardinal alto rompe el cache);
 * dejamos sin cache para que el detail page la pida fresh siempre, y
 * confiamos en que la query es barata (pk lookup + index).
 */
export async function getRepliesForReviewIds(reviewIds: string[]) {
  return getRepliesForReviewIdsSvc(reviewIds);
}

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
