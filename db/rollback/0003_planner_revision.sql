-- Manual rollback for 0003_planner_revision. Never run by the migration
-- runner. Stop every app instance first: the cache code needs this table.
--   DELETE FROM schema_migrations WHERE name = '0003_planner_revision.sql';

DROP TABLE IF EXISTS planner_revision;
