-- 0008_review_restrictions — staff can switch off a review author (ADR 0015, PR 2).
-- No foreign keys (ADR 0013). `seq` keeps insertion order. Rows are never deleted
-- by the app: lifting sets lifted_at, so the table is the audit trail.
-- guest_key is pseudonymous personal data: never returned by any API.
-- Rollback: db/rollback/0008_review_restrictions.sql.

CREATE TABLE review_restrictions (
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  id         text PRIMARY KEY,
  subject    text NOT NULL CHECK (subject IN ('user', 'guest')),
  author_id  text,
  guest_key  text,
  place_slug text,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  expires_at timestamptz,
  lifted_at  timestamptz,
  lifted_by  text,
  CHECK ((subject = 'user' AND author_id IS NOT NULL) OR (subject = 'guest' AND guest_key IS NOT NULL))
);

CREATE INDEX review_restrictions_author ON review_restrictions (author_id) WHERE author_id IS NOT NULL;
CREATE INDEX review_restrictions_guest ON review_restrictions (guest_key) WHERE guest_key IS NOT NULL;
