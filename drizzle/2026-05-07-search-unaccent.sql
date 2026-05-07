-- ============================================================================
-- Hambuscador — search-unaccent migration
-- ----------------------------------------------------------------------------
-- Habilita búsqueda accent-insensitive (ñ → n, é → e) y reindexa los
-- trigrams sobre la versión normalizada para que las queries acelere por
-- índice incluso con f_unaccent(lower(...)).
--
-- APLICAR EN PROD (Neon) ANTES DE PUSHEAR, sino las queries del search nuevo
-- van a fallar:
--
--   1. Conectarse a Neon (SQL editor o psql)
--   2. Pegar este archivo entero y ejecutar
--   3. Pushear el código
--
-- En dev local: `pnpm db:postgis` ya incluye estos cambios.
-- ============================================================================

-- 1. Extensión ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Wrapper IMMUTABLE -------------------------------------------------------
-- unaccent() es STABLE por default; este wrapper lo congela como IMMUTABLE
-- para que pueda usarse en expression indexes sin que PG se queje.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    PARALLEL SAFE
    STRICT
AS $func$
SELECT public.unaccent('public.unaccent', $1);
$func$;

-- 3. Reemplazar índice trigram en `name` ------------------------------------
-- Drop del viejo (era sobre `name` raw, no aceleraba queries normalizadas)
-- y create del nuevo sobre f_unaccent(lower(name)).
DROP INDEX IF EXISTS places_name_trgm_idx;
CREATE INDEX places_name_trgm_idx
    ON places USING GIN (f_unaccent(lower(name)) gin_trgm_ops);

-- 4. Trigram en otros campos buscables --------------------------------------
CREATE INDEX IF NOT EXISTS places_comuna_trgm_idx
    ON places USING GIN (f_unaccent(lower(comuna_label)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS places_specialty_trgm_idx
    ON places USING GIN (f_unaccent(lower(specialty)) gin_trgm_ops);

-- 5. Verificación -----------------------------------------------------------
SELECT 'unaccent enabled' AS check_name,
       (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') IS NOT NULL AS ok;
SELECT 'f_unaccent works' AS check_name, f_unaccent('Ñuñoa') = 'Nunoa' AS ok;
SELECT 'indexes' AS check_name,
       string_agg(indexname, ', ') AS result
FROM pg_indexes
WHERE indexname IN (
    'places_name_trgm_idx',
    'places_comuna_trgm_idx',
    'places_specialty_trgm_idx'
);
