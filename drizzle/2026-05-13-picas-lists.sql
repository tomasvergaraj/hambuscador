-- ============================================================================
-- picas_lists — tabla de listas curadas editables desde /admin/picas.
-- ----------------------------------------------------------------------------
-- Antes vivían hardcoded en `src/lib/picas.ts` (PICAS_LISTS). Esa data sigue
-- como SEED inicial (corre `pnpm db:seed-picas` después de aplicar este SQL)
-- y como FALLBACK para modo demo sin DATABASE_URL.
--
-- `slug` es PK e inmutable después de crear (rompería URLs y SEO si cambiase).
-- `criteria` es jsonb con la shape de `PicasListCriteria` (lib/picas.ts).
-- `is_active = false` oculta la lista del index público y del sitemap, sin
-- borrarla — útil para retirar una lista estacional sin perder historial.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS picas_lists (
  slug text PRIMARY KEY,
  title text NOT NULL,
  hook text NOT NULL,
  intro text NOT NULL,
  icon text NOT NULL,
  max_items integer NOT NULL DEFAULT 10,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'picas_lists_icon_check'
  ) THEN
    ALTER TABLE picas_lists
      ADD CONSTRAINT picas_lists_icon_check
      CHECK (icon IN ('flame', 'leaf', 'coin', 'sparkles', 'map-pin'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS picas_lists_active_sort_idx
  ON picas_lists (is_active, sort_order);
