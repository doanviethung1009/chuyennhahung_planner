-- 0017_place_status — publish state of a place (ADR 0035).
-- Additive. Every existing row becomes 'published' through the column default, so
-- applying this migration hides nothing; code from before it keeps inserting rows
-- that the default also marks published. `published_at` stays NULL for old rows.
-- Rollback: db/rollback/0017_place_status.sql. Never applied by an agent.

ALTER TABLE content_places
  ADD COLUMN status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN published_at timestamptz;
