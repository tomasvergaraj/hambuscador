// ============================================================================
// Listas curadas ("/picas/[slug]") — entry points de discovery + share-bait.
// ----------------------------------------------------------------------------
// Cada lista tiene un criterio de filtrado (cuisines/precio/comuna) y se
// resuelve dinámicamente contra la DB ordenada por popularidad (bayes rating).
// MVP: listas hardcoded acá. Cuando el catálogo crezca y queramos editorial
// fluido, mover a una tabla `picas_lists` con CRUD desde /admin.
// ============================================================================

import type { CuisineId, PriceRangeId } from "./constants";

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
  /** Filtro estricto por comuna (slug en DB; ya no atado al registry seed). */
  comunaSlug?: string;
  /** Filtro estricto por región (match exacto al label, ej. "Región Metropolitana"). */
  regionLabel?: string;
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
  // ── temáticas nacionales ─────────────────────────────────────────────────
  {
    slug: "top-de-chile",
    title: "top de Chile",
    hook: "el ranking nacional, sin secretos",
    intro:
      "las picás mejor calificadas de todo Chile, de Arica a Punta Arenas. acá está el podio nacional — si te gusta hamburguesa, esta lista es obligatoria.",
    icon: "sparkles",
    maxItems: 15,
    criteria: {
      minRating: 4.5,
    },
  },
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

  // ── regionales (las 16 regiones de Chile) ────────────────────────────────
  // listas que devuelven 0 places se ocultan en el index `/picas` vía
  // getPicasListsWithCounts(). así no escalamos solo donde hay seed.
  {
    slug: "lo-mejor-de-arica-y-parinacota",
    title: "lo mejor de Arica y Parinacota",
    hook: "el norte extremo también tiene su escena",
    intro:
      "Arica y Parinacota es la región más al norte de Chile. estas son las picás imperdibles para descubrir cuando andas por ahí.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Arica y Parinacota" },
  },
  {
    slug: "lo-mejor-de-tarapaca",
    title: "lo mejor de Tarapacá",
    hook: "Iquique, Alto Hospicio y el desierto",
    intro:
      "Tarapacá tiene calor, playa y una escena hamburguesera que vale la pena explorar. estas son las picás que la comunidad recomienda.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Tarapacá" },
  },
  {
    slug: "lo-mejor-de-antofagasta",
    title: "lo mejor de Antofagasta",
    hook: "del desierto al mar, hamburguesas serias",
    intro:
      "Antofagasta y Calama tienen una escena hamburguesera respaldada por buen rating. estas son las imperdibles del norte grande.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Antofagasta" },
  },
  {
    slug: "lo-mejor-de-atacama",
    title: "lo mejor de Atacama",
    hook: "Copiapó y Caldera en el mapa",
    intro:
      "la región de Atacama tiene picás que crecen tranquilas. acá las mejores para hacer ruta o probar de a poco.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Atacama" },
  },
  {
    slug: "lo-mejor-de-coquimbo",
    title: "lo mejor de Coquimbo",
    hook: "La Serena, Coquimbo y el valle del Elqui",
    intro:
      "entre playa y cordillera, la región de Coquimbo esconde picás imperdibles. estas son las mejor calificadas por la comunidad.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Coquimbo" },
  },
  {
    slug: "lo-mejor-de-valparaiso",
    title: "lo mejor de Valparaíso",
    hook: "del puerto a la playa, con Quillota en el medio",
    intro:
      "Valpo, Viña, Concón, Quillota: la región V tiene una escena hamburguesera que no se queda atrás. estas son las que hay que cruzar la cuesta para probar.",
    icon: "map-pin",
    maxItems: 12,
    criteria: { regionLabel: "Región de Valparaíso" },
  },
  {
    slug: "lo-mejor-de-santiago",
    title: "lo mejor de Santiago",
    hook: "la capital tiene picás para parar el día",
    intro:
      "la Región Metropolitana concentra la mayor escena hamburguesera del país. desde smash de barrio hasta gourmet de Las Condes — acá están las que valen el viaje.",
    icon: "map-pin",
    maxItems: 15,
    criteria: { regionLabel: "Región Metropolitana" },
  },
  {
    slug: "lo-mejor-de-ohiggins",
    title: "lo mejor de O'Higgins",
    hook: "Rancagua, San Fernando y alrededores",
    intro:
      "entre la RM y el Maule, la región de O'Higgins esconde picás que vale la pena descubrir. acá las mejores según los reviews de la comunidad.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de O'Higgins" },
  },
  {
    slug: "lo-mejor-del-maule",
    title: "lo mejor del Maule",
    hook: "Talca, Curicó y Linares en la mira",
    intro:
      "la región del Maule tiene una escena hamburguesera que crece silenciosa. estas son las picás imperdibles cuando andas por ahí.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región del Maule" },
  },
  {
    slug: "lo-mejor-de-nuble",
    title: "lo mejor de Ñuble",
    hook: "Chillán y el corazón rural de Chile",
    intro:
      "Ñuble es la región más joven de Chile pero tiene una identidad hamburguesera propia. acá las mejores picás de Chillán y alrededores.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Ñuble" },
  },
  {
    slug: "lo-mejor-del-biobio",
    title: "lo mejor del Biobío",
    hook: "Concepción, Talcahuano y Los Ángeles",
    intro:
      "el sur también sabe de hamburguesas. estas picás de la región del Biobío demuestran que la escena se mueve más allá de Santiago.",
    icon: "map-pin",
    maxItems: 12,
    criteria: { regionLabel: "Región del Biobío" },
  },
  {
    slug: "lo-mejor-de-la-araucania",
    title: "lo mejor de La Araucanía",
    hook: "Temuco, Pucón y la cordillera al lado",
    intro:
      "entre lagos y volcanes, La Araucanía tiene picás que valen el desvío. acá las mejor rankeadas por la comunidad.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de La Araucanía" },
  },
  {
    slug: "lo-mejor-de-los-rios",
    title: "lo mejor de Los Ríos",
    hook: "Valdivia, cerveza artesanal y burgers",
    intro:
      "la región de Los Ríos combina escena cervecera con hamburguesera. estas son las picás imperdibles cuando estás en Valdivia.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Los Ríos" },
  },
  {
    slug: "lo-mejor-de-los-lagos",
    title: "lo mejor de Los Lagos",
    hook: "Puerto Montt, Chiloé y el sur profundo",
    intro:
      "del sur de Chile salen picás que te hacen el viaje memorable. estas son las mejor calificadas en Los Lagos.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Los Lagos" },
  },
  {
    slug: "lo-mejor-de-aysen",
    title: "lo mejor de Aysén",
    hook: "Coyhaique y la patagonia chilena",
    intro:
      "Aysén es remoto pero no escaso de buena comida. acá las picás imperdibles del extremo sur.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Aysén" },
  },
  {
    slug: "lo-mejor-de-magallanes",
    title: "lo mejor de Magallanes",
    hook: "Punta Arenas y el fin del mundo",
    intro:
      "en el extremo más austral, Magallanes tiene picás que vale la pena cruzar todo Chile para probar. estas son las mejor rankeadas.",
    icon: "map-pin",
    maxItems: 10,
    criteria: { regionLabel: "Región de Magallanes" },
  },
];

export function getPicasListBySlug(slug: string): PicasList | undefined {
  return PICAS_LISTS.find((l) => l.slug === slug);
}
