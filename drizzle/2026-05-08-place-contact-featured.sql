-- ============================================================================
-- Migración 2026-05-08 — Hambuscador
-- ----------------------------------------------------------------------------
-- Cambios:
--   1. places.whatsapp text         — número WhatsApp (formato libre, parseo
--                                     en UI a wa.me/<digits>).
--   2. places.is_featured boolean   — local destacado por publicidad. Pin
--                                     diferenciado en mapa. Solo admin lo
--                                     togglea desde /admin/places/[id]/edit.
--
-- Nota: places.website ya existe desde el schema inicial — solo cableamos
-- ahora UI/wizard/admin para mostrarlo y editarlo.
--
-- Aplicar en Neon prod ANTES del push de código (drizzle SELECT * rompe si
-- una columna del schema no existe en DB). Sentencias idempotentes.
-- ============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE places ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
