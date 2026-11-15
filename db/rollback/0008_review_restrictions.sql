-- Manual rollback for 0008_review_restrictions. Never run by the migration runner.
-- DESTRUCTIVE: drops every restriction and the audit trail with it. Authors and
-- guests muted by staff can write and be read again afterwards.
--   DELETE FROM schema_migrations WHERE name = '0008_review_restrictions.sql';

DROP TABLE IF EXISTS review_restrictions;
