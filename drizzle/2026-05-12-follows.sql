-- Sistema de seguidores user → user. PK compuesto evita duplicados;
-- CHECK constraint impide auto-follow. Índice followee_id cubre el caso
-- "¿quiénes me siguen?" (la PK ya cubre lookups por follower_id).
-- Idempotente.

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);
