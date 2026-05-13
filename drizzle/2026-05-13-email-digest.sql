-- ============================================================================
-- Email digest opt-in — preferencia por usuario + timestamp del último digest.
-- ----------------------------------------------------------------------------
-- Cambios:
--   1. users.email_digest_frequency text DEFAULT 'off' NOT NULL
--      Valores válidos: 'off' | 'daily' | 'weekly' (enforced via CHECK).
--      Default 'off' → ningún user existente recibe digests automático.
--   2. users.last_digest_sent_at timestamptz NULL
--      Sirve para no spamear si el cron corre dos veces en el mismo período
--      y para definir la ventana de "qué notifs incluir desde la última vez".
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DO block para el CHECK constraint
-- (PG no tiene IF NOT EXISTS en ADD CONSTRAINT antes de v9.6 syntax).
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_digest_frequency text NOT NULL DEFAULT 'off';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_digest_frequency_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_digest_frequency_check
      CHECK (email_digest_frequency IN ('off', 'daily', 'weekly'));
  END IF;
END$$;

-- Índice parcial para el cron: solo users opt-in. Las queries del cron
-- filtran por frequency = 'daily' o 'weekly' — el índice los baja a O(N opt-in).
CREATE INDEX IF NOT EXISTS users_email_digest_frequency_idx
  ON users (email_digest_frequency)
  WHERE email_digest_frequency != 'off';
