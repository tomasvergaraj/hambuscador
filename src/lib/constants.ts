// ============================================================================
// Constantes del dominio
// ============================================================================

/**
 * Tipos de cocina soportados. Multi-select cuando se filtra/registra.
 */
export const CUISINE_TYPES = [
  { id: "smash", label: "smash" },
  { id: "artesanal", label: "artesanal" },
  { id: "clasica", label: "clásica" },
  { id: "gourmet", label: "gourmet" },
  { id: "vegetariana", label: "vegetariana" },
  { id: "vegana", label: "vegana" },
  { id: "sin-gluten", label: "sin gluten" },
  { id: "fast-food", label: "fast food" },
] as const;

export type CuisineId = (typeof CUISINE_TYPES)[number]["id"];

/**
 * Rangos de precio. Cortes pensados en CLP por persona, comidas hamburguesa+papas+bebida.
 */
export const PRICE_RANGES = [
  { id: "$", label: "$", description: "hasta $7.000" },
  { id: "$$", label: "$$", description: "$7.000 — $12.000" },
  { id: "$$$", label: "$$$", description: "$12.000 — $20.000" },
  { id: "$$$$", label: "$$$$", description: "más de $20.000" },
] as const;

export type PriceRangeId = (typeof PRICE_RANGES)[number]["id"];

/**
 * Estado de apertura del local en este momento. Calculado on-the-fly desde
 * el horario y la hora actual.
 */
export const PLACE_STATUSES = {
  open: { label: "abierto", color: "lechuga" },
  "closing-soon": { label: "cierra pronto", color: "tomate" },
  closed: { label: "cerrado", color: "tinta-suave" },
} as const;

export type PlaceStatus = keyof typeof PLACE_STATUSES;

/**
 * Aspectos calificables en una reseña. Cada uno suma al rating ponderado
 * y alimenta los `aggregateRating` por aspecto en el JSON-LD.
 */
export const REVIEW_ASPECTS = [
  { id: "comida", label: "comida" },
  { id: "atencion", label: "atención" },
  { id: "ambiente", label: "ambiente" },
] as const;

export type ReviewAspectId = (typeof REVIEW_ASPECTS)[number]["id"];

/**
 * Comunas con seed inicial de hamburgueserías. Esta lista se expandirá
 * a medida que se agreguen locales en otras comunas. La fuente de verdad
 * en producción será la DB.
 */
export const SEED_COMUNAS = [
  "providencia",
  "nunoa",
  "las-condes",
  "santiago",
  "vitacura",
  "lo-barnechea",
  "la-reina",
  "macul",
  "valparaiso",
  "vina-del-mar",
  "concon",
  "quillota",
] as const;

/**
 * Tabs del bottom navigation. Orden importa.
 */
export const BOTTOM_NAV_TABS = [
  { id: "inicio", label: "inicio", href: "/", icon: "home" },
  { id: "buscar", label: "buscar", href: "/buscar", icon: "search" },
  { id: "mapa", label: "mapa", href: "/buscar?vista=mapa", icon: "map" },
  { id: "perfil", label: "perfil", href: "/perfil", icon: "user" },
] as const;
