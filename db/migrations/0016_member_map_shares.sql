-- 0016_member_map_shares — one member's map-sharing setting (ADR 0030 §1, slice 2a).
-- `seq` keeps insertion order (the store reads every table ORDER BY seq).
-- 1:1 on user_id. `token_digest` is the SHA-256 hex of the share token — the token
-- itself is never stored. NULL means "not shared". Default is private + anonymous,
-- so applying this migration publishes nothing. No foreign keys (ADR 0013); the app
-- deletes a user's row when the account is deleted. Personal data: a user id, a
-- digest and a time. No name, no IP address, no destination.
-- Rollback: db/rollback/0016_member_map_shares.sql. Never applied by an agent.

CREATE TABLE member_map_shares (
  seq          bigint GENERATED ALWAYS AS IDENTITY,
  id           text PRIMARY KEY,
  user_id      text NOT NULL UNIQUE,
  token_digest text UNIQUE CHECK (token_digest IS NULL OR token_digest ~ '^[0-9a-f]{64}$'),
  share_name   text NOT NULL DEFAULT 'anonymous' CHECK (share_name IN ('anonymous', 'name')),
  created_at   timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL
);
