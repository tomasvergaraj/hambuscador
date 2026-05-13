-- ============================================================================
-- Diagnóstico de migraciones aplicadas en Neon prod.
-- Pegá en SQL editor de Neon. Devuelve una fila por migration con `applied`
-- (true/false) y `detail`. NO modifica nada — solo SELECTs.
-- ============================================================================

WITH checks AS (
  -- 1. hours-by-day-banned-cursor (2026-05-07)
  SELECT
    '2026-05-07-hours-by-day-banned-cursor' AS migration,
    (
      EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_name='places' AND column_name='hours_by_day')
      AND EXISTS(SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='banned_at')
      AND EXISTS(SELECT 1 FROM pg_indexes
                 WHERE indexname='reviews_created_at_idx')
    ) AS applied,
    'places.hours_by_day + users.banned_at + reviews_created_at_idx' AS detail
  UNION ALL
  -- 2. search-unaccent (2026-05-07)
  SELECT
    '2026-05-07-search-unaccent',
    (
      EXISTS(SELECT 1 FROM pg_extension WHERE extname='unaccent')
      AND EXISTS(SELECT 1 FROM pg_proc WHERE proname='f_unaccent')
    ),
    'extension unaccent + función f_unaccent'
  UNION ALL
  -- 3. comunas table (2026-05-08)
  SELECT
    '2026-05-08-comunas',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='comunas'),
    'tabla comunas (346 oficiales)'
  UNION ALL
  -- 4. place-claims (2026-05-08)
  SELECT
    '2026-05-08-place-claims',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='place_claims'),
    'tabla place_claims'
  UNION ALL
  -- 5. place-contact-featured (2026-05-08)
  SELECT
    '2026-05-08-place-contact-featured',
    (
      EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_name='places' AND column_name='whatsapp')
      AND EXISTS(SELECT 1 FROM information_schema.columns
                 WHERE table_name='places' AND column_name='is_featured')
    ),
    'places.whatsapp + places.is_featured'
  UNION ALL
  -- 6. place-logo (2026-05-08)
  SELECT
    '2026-05-08-place-logo',
    EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_name='places' AND column_name='logo'),
    'places.logo'
  UNION ALL
  -- 7. regions (2026-05-08)
  SELECT
    '2026-05-08-regions',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='regions'),
    'tabla regions (16 oficiales)'
  UNION ALL
  -- 8. search-logs (2026-05-08)
  SELECT
    '2026-05-08-search-logs',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='search_logs'),
    'tabla search_logs'
  UNION ALL
  -- 9. password-reset-tokens (2026-05-09)
  SELECT
    '2026-05-09-password-reset-tokens',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='password_reset_tokens'),
    'tabla password_reset_tokens'
  UNION ALL
  -- 10. follows (2026-05-12)
  SELECT
    '2026-05-12-follows',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='follows'),
    'tabla follows'
  UNION ALL
  -- 11. notifications (2026-05-12)
  SELECT
    '2026-05-12-notifications',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='notifications'),
    'tabla notifications'
  UNION ALL
  -- 12. push-subscriptions (2026-05-12)
  SELECT
    '2026-05-12-push-subscriptions',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='push_subscriptions'),
    'tabla push_subscriptions'
  UNION ALL
  -- 13. resync-photo-urls (one-shot 2026-05-12)
  --   applied = no quedan URLs del host viejo en ningún campo
  SELECT
    '2026-05-12-resync-photo-urls (one-shot)',
    (
      NOT EXISTS(
        SELECT 1 FROM places
        WHERE EXISTS (
          SELECT 1 FROM unnest(COALESCE(photos, ARRAY[]::text[])) p
          WHERE p LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
        )
        OR logo LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
      )
      AND NOT EXISTS(
        SELECT 1 FROM reviews
        WHERE EXISTS (
          SELECT 1 FROM unnest(COALESCE(photos, ARRAY[]::text[])) p
          WHERE p LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
        )
      )
      AND NOT EXISTS(
        SELECT 1 FROM place_claims
        WHERE proof_url LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
      )
      AND NOT EXISTS(
        SELECT 1 FROM users
        WHERE image LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
      )
    ),
    'no quedan URLs del host viejo pub-fbbb…r2.dev'
  -- NOTA: 2026-05-08-resync-aggregates es one-shot UPDATE recompute, no
  -- detectable post-hoc — confiar en el changelog. Se asume aplicada.
)
SELECT
  CASE WHEN applied THEN 'OK  ✓' ELSE 'FALTA ✗' END AS estado,
  migration,
  detail
FROM checks
ORDER BY applied, migration;
