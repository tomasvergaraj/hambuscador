-- ============================================================================
-- Migración 2026-05-08 — Hambuscador
-- ----------------------------------------------------------------------------
-- Cambio:
--   1. places.logo text  — URL pública del logo de marca del local (R2).
--                          Cuando está presente, la PlaceCard compact lo usa
--                          como thumbnail en vez del crop de la primera
--                          foto. Hero del detail / featured card siguen
--                          usando la galería `photos` (primera foto).
--                          Solo admin puede setearlo desde
--                          /admin/places/[id]/edit (típicamente para
--                          locales reclamados / con publicidad).
--
-- Aplicar en Neon prod ANTES del push de código (drizzle SELECT * rompe si
-- una columna del schema no existe en DB). Sentencia idempotente.
-- ============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS logo text;
