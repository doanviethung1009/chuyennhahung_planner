-- 0013_reports — reader reports of community trips and reviews (batch 10.5, ADR 0019).
-- Guests and members may report; staff resolve in the admin queue. `client_key` is
-- the hashed guest key (never returned by any API); `reporter_id` is set for a member.
-- target_id is the trip id or review id (the public share token is never stored).
-- No foreign keys (ADR 0013). `seq` keeps insertion order for the store.
-- Personal data: a user id or a hashed key, and a free-text note (<= 500).
-- Rollback: db/rollback/0013_reports.sql.

CREATE TABLE reports (
  seq            bigint GENERATED ALWAYS AS IDENTITY,
  id             text PRIMARY KEY,
  reporter_id    text,
  client_key     text,
  target_kind    text NOT NULL CHECK (target_kind IN ('trip', 'review')),
  target_id      text NOT NULL,
  reason         text NOT NULL CHECK (reason IN ('spam', 'harassment', 'personal_data', 'copyright', 'misleading', 'other')),
  note           text CHECK (note IS NULL OR char_length(note) <= 500),
  status         text NOT NULL CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at     timestamptz NOT NULL,
  handled_at     timestamptz,
  handled_by     text,
  handler_reason text CHECK (handler_reason IS NULL OR char_length(handler_reason) <= 500)
);

CREATE INDEX reports_status_created ON reports (status, created_at);
