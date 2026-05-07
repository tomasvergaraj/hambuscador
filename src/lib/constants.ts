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
 * Registry de comunas soportadas. Mientras no haya geocoding real (Fase 3
 * con autocomplete de direcciones), usamos el centroide aproximado de la
 * comuna como fallback de lat/lng al crear un local nuevo desde `/agregar`.
 *
 * El campo `slug` es la clave pública (URL: `/[comuna]/...`). `label` y
 * `region` se denormalizan en la tabla `places` al crear.
 */
export const COMUNAS_REGISTRY = [
  { slug: "providencia",  label: "Providencia",     region: "Región Metropolitana", lat: -33.4262, lng: -70.6166 },
  { slug: "nunoa",        label: "Ñuñoa",           region: "Región Metropolitana", lat: -33.4569, lng: -70.5933 },
  { slug: "las-condes",   label: "Las Condes",      region: "Región Metropolitana", lat: -33.4142, lng: -70.5728 },
  { slug: "santiago",     label: "Santiago",        region: "Región Metropolitana", lat: -33.4489, lng: -70.6693 },
  { slug: "vitacura",     label: "Vitacura",        region: "Región Metropolitana", lat: -33.3823, lng: -70.5917 },
  { slug: "lo-barnechea", label: "Lo Barnechea",    region: "Región Metropolitana", lat: -33.3567, lng: -70.5167 },
  { slug: "la-reina",     label: "La Reina",        region: "Región Metropolitana", lat: -33.4458, lng: -70.5333 },
  { slug: "macul",        label: "Macul",           region: "Región Metropolitana", lat: -33.4925, lng: -70.5908 },
  { slug: "valparaiso",   label: "Valparaíso",      region: "Región de Valparaíso", lat: -33.0458, lng: -71.6197 },
  { slug: "vina-del-mar", label: "Viña del Mar",    region: "Región de Valparaíso", lat: -33.0153, lng: -71.5500 },
  { slug: "concon",       label: "Concón",          region: "Región de Valparaíso", lat: -32.9314, lng: -71.5267 },
  { slug: "quillota",     label: "Quillota",        region: "Región de Valparaíso", lat: -32.8806, lng: -71.2486 },
] as const;

export type ComunaSlug = (typeof COMUNAS_REGISTRY)[number]["slug"];

/** Slugs solamente — útil para el seed o validaciones. */
export const SEED_COMUNAS = COMUNAS_REGISTRY.map((c) => c.slug);

/**
 * Días de la semana para el horario por día (storage en `places.hours_by_day`).
 * Orden importa: arranca en lunes, termina en domingo (estilo es-CL).
 */
export const DAY_KEYS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_LABEL: Record<DayKey, string> = {
  lun: "lun",
  mar: "mar",
  mie: "mié",
  jue: "jue",
  vie: "vie",
  sab: "sáb",
  dom: "dom",
};
export const DAY_FULL_LABEL: Record<DayKey, string> = {
  lun: "lunes",
  mar: "martes",
  mie: "miércoles",
  jue: "jueves",
  vie: "viernes",
  sab: "sábado",
  dom: "domingo",
};

/**
 * Tabs del bottom navigation. Orden importa.
 */
export const BOTTOM_NAV_TABS = [
  { id: "inicio", label: "inicio", href: "/", icon: "home" },
  { id: "buscar", label: "buscar", href: "/buscar", icon: "search" },
  { id: "mapa", label: "mapa", href: "/buscar?vista=mapa", icon: "map" },
  { id: "perfil", label: "perfil", href: "/perfil", icon: "user" },
] as const;
