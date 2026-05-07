// ============================================================================
// Listas curadas ("/picas/[slug]") — entry points de discovery + share-bait.
// ----------------------------------------------------------------------------
// Cada lista tiene un criterio de filtrado (cuisines/precio/comuna) y se
// resuelve dinámicamente contra la DB ordenada por popularidad (bayes rating).
// MVP: listas hardcoded acá. Cuando el catálogo crezca y queramos editorial
// fluido, mover a una tabla `picas_lists` con CRUD desde /admin.
// ============================================================================

import type { CuisineId, PriceRangeId, ComunaSlug } from "./constants";

/**
 * Iconos disponibles para una lista. Cada uno mapea a un componente Tabler en
 * la UI y a un path SVG inline en el OG image (ver `pica-icon.tsx`).
 */
export type PicaIconName = "flame" | "leaf" | "coin" | "sparkles" | "map-pin";

export type PicasListCriteria = {
  /** OR entre cuisines (lista tiene cualquiera). */
  cuisines?: CuisineId[];
  /** OR entre rangos. */
  priceRanges?: PriceRangeId[];
  /** Filtro estricto por comuna. */
  comunaSlug?: ComunaSlug;
  /** Cota mínima de rating bayesiano. */
  minRating?: number;
  /** Días hacia atrás (filtro `approved_at >= NOW() - X days`). */
  approvedWithinDays?: number;
};

export type PicasList = {
  slug: string;
  /** Título principal — voz chilena, lowercase. */
  title: string;
  /** Subtítulo / hook para preview de la tarjeta y para el OG image. */
  hook: string;
  /** Descripción larga que vive arriba de la lista. */
  intro: string;
  icon: PicaIconName;
  /** Cuántos items mostrar. Si retorna menos, mostramos los que haya. */
  maxItems: number;
  criteria: PicasListCriteria;
};

export const PICAS_LISTS: PicasList[] = [
  {
    slug: "los-mejores-smash",
    title: "los mejores smash",
    hook: "patty fina, cheddar derretido, bun tostado",
    intro:
      "el smash es el rey discreto: sin tomates raros, sin lechuga adornando — patty bien aplastada, costras crujientes y cheddar para que quede legendaria. esta es la selección.",
    icon: "flame",
    maxItems: 10,
    criteria: {
      cuisines: ["smash"],
    },
  },
  {
    slug: "veggie-y-vegana",
    title: "veggie y vegana",
    hook: "sin carne, con sabor",
    intro:
      "que no es solo lechuga con pan: estas picás se la juegan con porotos negros, hongos, garbanzos y mucho amor. ideales si tú no comes carne o estás invitando a alguien que no.",
    icon: "leaf",
    maxItems: 10,
    criteria: {
      cuisines: ["vegetariana", "vegana"],
    },
  },
  {
    slug: "barata-y-buena",
    title: "barata y buena",
    hook: "para cuando la cartera anda flaca",
    intro:
      "no porque sea barata es mediocre. estas son las picás que se la juegan calidad / precio: comes bien, no te endeudas, y vuelves.",
    icon: "coin",
    maxItems: 10,
    criteria: {
      priceRanges: ["$", "$$"],
      minRating: 4.0,
    },
  },
  {
    slug: "para-celebrar",
    title: "para celebrar",
    hook: "cuando el plan es romper la chanchita",
    intro:
      "cumpleaños, asado de oficina, después de un mes pesado: estas picás valen el viaje y la cuenta. ingredientes serios, atención fina, y burgers que se acuerdan.",
    icon: "sparkles",
    maxItems: 8,
    criteria: {
      priceRanges: ["$$$", "$$$$"],
      minRating: 4.5,
    },
  },
  {
    slug: "lo-mejor-de-quillota",
    title: "lo mejor de Quillota",
    hook: "la capital de la palta también sabe de hamburguesa",
    intro:
      "Quillota tiene una escena hamburguesera que no te imaginas. estas son las imperdibles para hacer ruta o probar de a poco.",
    icon: "map-pin",
    maxItems: 10,
    criteria: {
      comunaSlug: "quillota",
    },
  },
];

export function getPicasListBySlug(slug: string): PicasList | undefined {
  return PICAS_LISTS.find((l) => l.slug === slug);
}
