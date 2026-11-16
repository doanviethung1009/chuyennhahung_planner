-- 0010_audit_events — append-only log of community actions (ADR 0019 §2, batch 10.2).
-- Written in the same transaction as the change it describes. No foreign keys
-- (ADR 0013). `seq` keeps insertion order. The app never updates or deletes a
-- row; only the one-year retention sweep removes them.
-- Personal data: actor ids and reasons that may quote user text. No email, no guest key.
-- Rollback: db/rollback/0010_audit_events.sql.

CREATE TABLE audit_events (
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  id          text PRIMARY KEY,
  target_kind text NOT NULL CHECK (target_kind IN ('trip', 'review', 'user')),
  target_id   text NOT NULL,
  actor_id    text NOT NULL,
  actor_kind  text NOT NULL CHECK (actor_kind IN ('user', 'service')),
  action      text NOT NULL,
  from_status text,
  to_status   text,
  reason      text CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at  timestamptz NOT NULL
);

CREATE INDEX audit_events_target ON audit_events (target_id, created_at);
