-- ============================================================================
-- Migración 2026-05-07 — Hambuscador
-- ----------------------------------------------------------------------------
-- Cambios:
--   1. places.hours_by_day jsonb       — horario por día (lun..dom) capturado
--                                        desde el wizard /agregar.
--   2. users.banned_at timestamptz     — usuario baneado por admin (no puede
--                                        iniciar sesión).
--   3. reviews_created_at_idx          — cursor pagination en /admin/resenas.
--
-- Aplicar en prod (Neon SQL Editor o psql) ANTES del push de código:
--   - Las queries de Drizzle hacen SELECT de TODAS las columnas del schema, así
--     que si las columnas no existen el deploy se rompe.
--   - Todas las sentencias usan `IF NOT EXISTS` → idempotentes, seguras a
--     re-correr.
-- ============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS hours_by_day jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz;

CREATE INDEX IF NOT EXISTS reviews_created_at_idx
  ON reviews (created_at DESC, id DESC);
