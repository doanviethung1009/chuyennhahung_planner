-- Manual rollback for 0017_place_status. Never run by the migration runner.
-- DESTRUCTIVE: drops each place's publish state. Every draft or archived place
-- becomes visible to visitors again under older code, so publish or delete the
-- drafts you do not want public first.
--   DELETE FROM schema_migrations WHERE name = '0017_place_status.sql';

ALTER TABLE content_places DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS published_at;
