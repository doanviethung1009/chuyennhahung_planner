-- Manual rollback for 0011_rate_limit_counters. Never run by the migration runner.
-- Revert the review routes and `instance.ts` to the in-memory limiters first.
-- Dropping loses only counters, which expire within an hour anyway.
--   DELETE FROM schema_migrations WHERE name = '0011_rate_limit_counters.sql';

DROP TABLE IF EXISTS rate_limit_counters;
