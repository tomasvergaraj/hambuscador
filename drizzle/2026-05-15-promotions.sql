-- 2026-05-15-promotions.sql
-- Promociones de contenido (% descuento, producto destacado, combo).
-- Tier 'promo' en subscriptions habilita publicar. Carousel home filtra
-- por región. Pin map con ring tomate cuando hay promo active.
-- Idempotente.

-- 1. Expandir tier enum: sumar 'promo'.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('featured','premium','promo'));

-- 2. Tabla promotions.
CREATE TABLE IF NOT EXISTS promotions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id          uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('percent_discount','featured_product','combo')),
  title             text NOT NULL,
  description       text,
  discount_pct      integer CHECK (discount_pct IS NULL OR (discount_pct BETWEEN 1 AND 99)),
  photo_url         text,
  region_label      text,
  starts_at         timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_place_idx
  ON promotions (place_id);

-- Carousel home: filter por (region, active, approved) + sort por ends_at.
CREATE INDEX IF NOT EXISTS promotions_home_idx
  ON promotions (region_label, is_active, ends_at);

-- Cron expire / cleanup retention.
CREATE INDEX IF NOT EXISTS promotions_ends_at_idx
  ON promotions (ends_at);
