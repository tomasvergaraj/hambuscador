-- ============================================================================
-- Migración 2026-05-08 — Hambuscador
-- ----------------------------------------------------------------------------
-- Cambio:
--   1. Tabla place_claims  — solicitudes de un usuario para reclamar un
--                            local. Admin aprueba/rechaza desde
--                            /admin/claims. Aprobar setea
--                            places.claimed_by + places.is_verified=true.
--
-- Aplicar en Neon prod ANTES del push de código (drizzle SELECT * rompe si
-- una tabla del schema no existe en DB). Sentencia idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS place_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  proof_url text,
  message text,
  contact_email text NOT NULL,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason text
);

CREATE INDEX IF NOT EXISTS place_claims_place_idx ON place_claims(place_id);
CREATE INDEX IF NOT EXISTS place_claims_status_idx ON place_claims(status);
CREATE INDEX IF NOT EXISTS place_claims_user_idx ON place_claims(user_id);
