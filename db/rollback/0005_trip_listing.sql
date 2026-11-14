-- Manual rollback for 0005_trip_listing. Never run by the migration runner.
-- DESTRUCTIVE: drops every listing request and decision (trips read as not listed).
--   DELETE FROM schema_migrations WHERE name = '0005_trip_listing.sql';

ALTER TABLE trips DROP COLUMN IF EXISTS listing;
