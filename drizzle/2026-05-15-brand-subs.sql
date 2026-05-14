-- 2026-05-15-brand-subs.sql
-- Subscriptions a nivel de cadena. Una sub a brand_id propaga is_featured
-- a todos los places de esa brand. Reusa los tiers existentes.
-- Idempotente.

ALTER TABLE subscriptions
  ALTER COLUMN place_id DROP NOT NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;

-- Exactly-one-target check: place_id XOR brand_id seteado.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_target_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_target_check
  CHECK ((place_id IS NULL) <> (brand_id IS NULL));

-- Reemplazar el partial unique de place pa que sea explícito.
DROP INDEX IF EXISTS subscriptions_active_place_tier_idx;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_place_tier_idx
  ON subscriptions (place_id, tier)
  WHERE status = 'active' AND place_id IS NOT NULL;

-- Mismo invariante pa brand: máximo UNA active por (brand, tier).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_brand_tier_idx
  ON subscriptions (brand_id, tier)
  WHERE status = 'active' AND brand_id IS NOT NULL;

-- Lookup por brand pa cron y service.
CREATE INDEX IF NOT EXISTS subscriptions_brand_idx ON subscriptions (brand_id);
