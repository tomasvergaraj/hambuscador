// ============================================================================
// Helpers de búsqueda — tokenización, sinónimos y normalización accent/case.
// ----------------------------------------------------------------------------
// El SQL hace lo mismo del lado server vía f_unaccent(lower(...)). Acá
// replicamos en JS para:
//  1. Mock mode (sin DB) en `pnpm dev` rápido
//  2. Pre-procesamiento del query antes de mandarlo al SQL
// ============================================================================

/**
 * Normaliza para búsqueda: lowercase + strip de tildes/diacríticos.
 * "Ñuñoa" → "nunoa", "Café Brasil" → "cafe brasil".
 *
 * Implementación: NFD descompone "ñ" → "n + tilde combinante", "é" → "e + ´",
 * después la regex elimina la marca combinante. ASCII pasa intacto.
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Stop words es-CL: tokens muy cortos o "ruido" que no aportan a la búsqueda.
 * "burger del cerro" no debería forzar match contra "del" en cada campo.
 */
const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "en",
  "con",
  "para",
  "por",
  "al",
  "un",
  "una",
  "lo",
  "mi",
  "tu",
  "su",
]);

/**
 * Sinónimos: cuando el usuario tipea X, también buscamos los términos
 * extra. Casos motivados por uso real:
 *  - "veggie/vegan" → cuisine ids canónicos
 *  - typos comunes / abreviaciones
 *
 * Las claves y valores deben estar ya normalizados (ASCII lowercase).
 */
const SYNONYMS: Record<string, string[]> = {
  veggie: ["vegetariana"],
  veggies: ["vegetariana"],
  vege: ["vegetariana"],
  vegan: ["vegana"],
  americana: ["clasica"],
  burguer: ["burger"],
  hamburguesa: ["burger"],
  hamburguesas: ["burger"],
  // ñuñoa es un caso común que ya cubre el unaccent, pero alguno escribe "nunhoa"
  nunhoa: ["nunoa"],
};

/**
 * Tokeniza una query libre en GRUPOS de alternativas:
 *  1. Normaliza (lowercase + strip accents)
 *  2. Split por whitespace y puntuación liviana
 *  3. Drop stop words y tokens < 2 chars
 *  4. Cada token original se convierte en un grupo `[token, ...synonyms]`.
 *     Las alternativas dentro del grupo son OR; los grupos son AND.
 *  5. Dedup intra-grupo manteniendo el original primero.
 *
 * Ejemplo: `"smash veggie"` → groups = `[["smash"], ["veggie", "vegetariana"]]`
 *  - WHERE: (matches "smash") AND (matches "veggie" OR matches "vegetariana")
 *  - Score por grupo: max alternative score.
 *
 * Retorna además la "phrase" completa normalizada para boost de match exacto.
 */
export function tokenizeQuery(query: string): {
  groups: string[][];
  phrase: string;
} {
  const phrase = normalizeForSearch(query.trim());
  if (!phrase) return { groups: [], phrase: "" };

  const raw = phrase
    .split(/[\s,.;:!?¿¡()/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const groups: string[][] = [];
  const seenGroups = new Set<string>();
  for (const token of raw) {
    if (seenGroups.has(token)) continue;
    seenGroups.add(token);
    const alts = [token];
    const syns = SYNONYMS[token];
    if (syns) {
      for (const s of syns) {
        if (!alts.includes(s)) alts.push(s);
      }
    }
    groups.push(alts);
  }

  return { groups, phrase };
}
