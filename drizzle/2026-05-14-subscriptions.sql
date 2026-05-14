-- 2026-05-14-subscriptions.sql
-- Suscripciones de publicidad pagada (MVP monetización Fase 1).
-- Tier `featured` mapea 1-a-1 con places.is_featured. Cron diario expira
-- las que vencen y revierte is_featured.
--
-- Idempotente: re-correr no rompe nada (IF NOT EXISTS en todo).

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id              uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tier                  text NOT NULL CHECK (tier IN ('featured')),
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','canceled')),
  amount_clp            integer NOT NULL,
  provider              text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','khipu','stripe')),
  external_id           text,
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz NOT NULL,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  notes                 text,
  canceled_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Lookup por local (perfil owner, "mis subs", admin detail).
CREATE INDEX IF NOT EXISTS subscriptions_place_idx
  ON subscriptions (place_id);

-- Cron de expiración: scan barato por (status, period_end).
CREATE INDEX IF NOT EXISTS subscriptions_status_end_idx
  ON subscriptions (status, current_period_end);

-- Invariante: máximo UNA active por (place, tier). Renovaciones requieren
-- transicionar la vieja a expired/canceled antes.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_place_tier_idx
  ON subscriptions (place_id, tier)
  WHERE status = 'active';
