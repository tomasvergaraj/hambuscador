-- ============================================================================
-- Hambuscador — PostGIS setup
-- ----------------------------------------------------------------------------
-- Drizzle no modela columnas generadas ni índices GIST nativamente. Este
-- archivo se corre después de `drizzle-kit push` (que crea las tablas) para
-- agregar el "geo magic" sobre la tabla `places`.
--
-- Idempotente: se puede correr cuantas veces quieras.
--
-- Cómo se ejecuta:
--   pnpm db:postgis       (script en package.json)
--   psql $DATABASE_URL -f drizzle/postgis.sql
-- ============================================================================

-- 1. Extensiones --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Columna geográfica generada en `places` --------------------------------
-- Almacena el punto en SRID 4326 (WGS84) para que ST_DWithin acepte metros.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'places' AND column_name = 'location'
    ) THEN
        ALTER TABLE places
            ADD COLUMN location geography(Point, 4326)
            GENERATED ALWAYS AS (
                ST_SetSRID(
                    ST_MakePoint(lng::double precision, lat::double precision),
                    4326
                )::geography
            ) STORED;
    END IF;
END
$$;

-- 3. Índices ------------------------------------------------------------------
-- GIST para queries espaciales (ST_DWithin, KNN <->)
CREATE INDEX IF NOT EXISTS places_location_gix
    ON places USING GIST (location);

-- Trigram para búsqueda fuzzy por nombre ("strret" → "Streat")
CREATE INDEX IF NOT EXISTS places_name_trgm_idx
    ON places USING GIN (name gin_trgm_ops);

-- ============================================================================
-- Verificación rápida — debería retornar al menos 0 filas, sin errores
-- ============================================================================
SELECT
    'extensions' as check_name,
    string_agg(extname, ', ') as result
FROM pg_extension
WHERE extname IN ('postgis', 'pg_trgm')

UNION ALL

SELECT
    'places.location column' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'places' AND column_name = 'location'
        ) THEN 'OK'
        ELSE 'MISSING'
    END as result;
