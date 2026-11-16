-- 0012_terms_acceptances — which member accepted which version of the Creator
-- Terms (ADR 0019 §4, batch 10.4). Community writes need the current version.
-- `seq` keeps insertion order (the store reads every table ORDER BY seq).
-- Natural key is (user_id, version); `id` is the row key the store engine uses.
-- Personal data: a user id and a time. No IP address, no user agent. No foreign
-- keys (ADR 0013); the app deletes a user's rows when the account is deleted.
-- Rollback: db/rollback/0012_terms_acceptances.sql.

CREATE TABLE terms_acceptances (
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  id          text PRIMARY KEY,
  user_id     text NOT NULL,
  version     text NOT NULL CHECK (char_length(version) <= 40),
  accepted_at timestamptz NOT NULL,
  lang        text NOT NULL CHECK (lang IN ('vi', 'en')),
  UNIQUE (user_id, version)
);
