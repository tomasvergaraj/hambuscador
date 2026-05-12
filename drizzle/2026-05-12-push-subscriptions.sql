-- Web Push API subscriptions por usuario. Un user puede tener varias subs
-- (mobile + desktop, distintos browsers). endpoint UNIQUE globalmente para
-- upsert; ON DELETE CASCADE en user_id para limpiar cuando borran cuenta.
-- Idempotente.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
