-- Notificaciones in-app por usuario destinatario (pull-based).
-- type discrimina el shape del payload jsonb. read_at null = sin leer.
-- Índice por (user_id, created_at DESC) cubre el feed paginado.
-- Índice parcial WHERE read_at IS NULL cubre el badge count (queda muy chico
-- una vez que el user marca leídas, así el COUNT(*) es O(unread)).
-- Idempotente.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;
