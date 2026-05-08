-- ============================================================================
-- search_logs — registro de queries de /buscar para informar mejoras (sinónimos
-- nuevos, gaps de catálogo, queries populares).
-- ----------------------------------------------------------------------------
-- Patrón: una fila por visita a /buscar?q=… (no por keystroke). Se loguea con
-- `next/after()` después de mandar la respuesta — no bloquea el render.
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized_query text NOT NULL,
  result_count int NOT NULL,
  used_fuzzy boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_logs_normalized_idx
  ON search_logs (normalized_query);
CREATE INDEX IF NOT EXISTS search_logs_created_at_idx
  ON search_logs (created_at DESC);
-- Partial index para reportes de "sin resultados" (mucho más chico que el
-- índice completo en datasets sanos donde la mayoría de queries pegan).
CREATE INDEX IF NOT EXISTS search_logs_zero_hit_idx
  ON search_logs (created_at DESC) WHERE result_count = 0;
