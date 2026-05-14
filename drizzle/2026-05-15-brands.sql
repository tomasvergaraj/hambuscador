-- 2026-05-15-brands.sql
-- Cadenas (McDonald's, BK, Streat Burger). Agrupa varios places bajo marca.
-- Cuando la brand tiene logo_url, el pin del mapa de sus places lo usa.
-- Idempotente.

CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  logo_url    text,
  color       text,
  website     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- places.brand_id — FK opcional. ON DELETE SET NULL: borrar la brand
-- deja los places huérfanos (siguen funcionando con pin default).
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS brand_id uuid
    REFERENCES brands(id) ON DELETE SET NULL;

-- Lookup por brand: mass actions en admin + render del mapa con logo.
CREATE INDEX IF NOT EXISTS places_brand_idx ON places (brand_id);
