-- ============================================================================
-- Tabla `regions` — catálogo de las 16 regiones de Chile con centroide + zoom.
-- ----------------------------------------------------------------------------
-- Aplicar en Neon prod antes del próximo push (drizzle-kit no corre en Vercel
-- build). Idempotente: usa IF NOT EXISTS y ON CONFLICT DO NOTHING.
--
-- Centroides aproximados (capital o centroide geográfico). Zoom sugerido por
-- tamaño N-S de la región: norte/sur extremos cubren grandes superficies y
-- piden zoom más bajo, RM y Valpo más zoom porque son chicas y densas.
--
-- IMPORTANTE: el `label` debe matchear EXACTO con lo que `places.region`
-- tiene almacenado para que `getActiveRegions()` devuelva resultados.
-- ============================================================================

CREATE TABLE IF NOT EXISTS regions (
  slug  text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  lat   numeric(10, 7) NOT NULL,
  lng   numeric(10, 7) NOT NULL,
  zoom  integer NOT NULL
);

INSERT INTO regions (slug, label, lat, lng, zoom) VALUES
  ('arica-parinacota',  'Región de Arica y Parinacota',   -18.4783, -70.3126, 9),
  ('tarapaca',          'Región de Tarapacá',             -20.2208, -70.1431, 8),
  ('antofagasta',       'Región de Antofagasta',          -23.6509, -70.3975, 7),
  ('atacama',           'Región de Atacama',              -27.3668, -70.3322, 7),
  ('coquimbo',          'Región de Coquimbo',             -29.9533, -71.3436, 8),
  ('valparaiso',        'Región de Valparaíso',           -33.0458, -71.6197, 9),
  ('metropolitana',     'Región Metropolitana',           -33.4500, -70.6500, 9),
  ('ohiggins',          'Región de O''Higgins',           -34.5708, -70.9870, 8),
  ('maule',             'Región del Maule',               -35.4264, -71.6553, 8),
  ('nuble',             'Región de Ñuble',                -36.6066, -72.1027, 9),
  ('biobio',            'Región del Biobío',              -36.8270, -73.0498, 8),
  ('araucania',         'Región de La Araucanía',         -38.7359, -72.5904, 8),
  ('los-rios',          'Región de Los Ríos',             -39.8142, -73.2459, 9),
  ('los-lagos',         'Región de Los Lagos',            -41.4717, -72.9369, 7),
  ('aysen',             'Región de Aysén',                -45.5752, -72.0662, 6),
  ('magallanes',        'Región de Magallanes',           -53.1638, -70.9171, 5)
ON CONFLICT (slug) DO NOTHING;
