-- 2026-05-14-premium-tier.sql
-- Premium tier de monetización: stats por local + responder reseñas + +fotos.
-- Idempotente: re-correr es seguro.

-- 1. Expandir tier enum en subscriptions: agregar 'premium'.
-- Postgres no permite ALTER CHECK in-place; drop + recreate. Defensive
-- contra DDL parcial: si la constraint no existe, ALTER DROP IF EXISTS la
-- toma como no-op.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('featured','premium'));

-- 2. Tabla de eventos analíticos por local (views + contact_clicks).
CREATE TABLE IF NOT EXISTS place_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('view','contact_click')),
  channel     text CHECK (channel IS NULL OR channel IN ('whatsapp','instagram','website','maps','phone')),
  visitor_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup principal: dashboard owner consulta por (place, rango fechas).
CREATE INDEX IF NOT EXISTS place_events_place_created_idx
  ON place_events (place_id, created_at DESC);

-- Cleanup retention global (DELETE WHERE created_at < now() - INTERVAL '90 days').
CREATE INDEX IF NOT EXISTS place_events_created_at_idx
  ON place_events (created_at DESC);

-- 3. Respuestas del owner a reseñas. PK = review_id (max 1 reply por review).
CREATE TABLE IF NOT EXISTS review_replies (
  review_id   uuid PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_replies_place_idx
  ON review_replies (place_id);
