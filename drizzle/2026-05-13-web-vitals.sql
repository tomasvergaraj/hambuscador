-- ============================================================================
-- web_vitals — métricas de Core Web Vitals reportadas desde el cliente.
-- ----------------------------------------------------------------------------
-- Patrón: una fila por evento del lib web-vitals (CLS/LCP/INP/FCP/TTFB/FID).
-- El cliente postea a /api/vitals con sendBeacon; el endpoint inserta vía
-- next/after() para no agregar latencia.
--
-- Volumen alto pero acotado: ~5 métricas por page-load. Mantener retention
-- corto (90d sugerido) para que P75/P95 sigan baratos. Cleanup futuro:
--   DELETE FROM web_vitals WHERE created_at < NOW() - INTERVAL '90 days';
--
-- Idempotente (IF NOT EXISTS). Aplicar en Neon antes del próximo push.
-- ============================================================================

CREATE TABLE IF NOT EXISTS web_vitals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric      text NOT NULL,
  value       real NOT NULL,
  rating      text,
  path        text,
  metric_id   text,
  nav_type    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- (metric, created_at DESC): trending y P75 por métrica en el tiempo.
CREATE INDEX IF NOT EXISTS web_vitals_metric_created_idx
  ON web_vitals (metric, created_at DESC);

-- (path, metric): P75 por path (ej. peor LCP por ruta).
CREATE INDEX IF NOT EXISTS web_vitals_path_metric_idx
  ON web_vitals (path, metric);

-- created_at DESC: retention sweeps.
CREATE INDEX IF NOT EXISTS web_vitals_created_at_idx
  ON web_vitals (created_at DESC);
