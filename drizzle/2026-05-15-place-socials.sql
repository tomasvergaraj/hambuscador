-- 2026-05-15-place-socials.sql
-- Suma redes sociales adicionales + link al menú digital.
-- Idempotente.

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS facebook  text,
  ADD COLUMN IF NOT EXISTS tiktok    text,
  ADD COLUMN IF NOT EXISTS menu_url  text;
