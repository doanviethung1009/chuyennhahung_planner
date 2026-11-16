-- Manual rollback for 0012_terms_acceptances. Never run by the migration runner.
-- DESTRUCTIVE: drops every recorded Terms acceptance. Remove the terms gate and
-- route first (older code does not know the table or the JSON key), or members
-- are simply asked to accept again once the table is restored.
--   DELETE FROM schema_migrations WHERE name = '0012_terms_acceptances.sql';

DROP TABLE IF EXISTS terms_acceptances;
