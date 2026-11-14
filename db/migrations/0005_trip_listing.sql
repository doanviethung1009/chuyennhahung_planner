-- 0005_trip_listing — a trip's place on the community gallery (ADR 0014).
-- Nullable JSONB: an absent value reads as "not listed", exactly as in the
-- JSON store, so existing rows need no backfill.
-- Rollback: db/rollback/0005_trip_listing.sql.

ALTER TABLE trips
  ADD COLUMN listing jsonb;
