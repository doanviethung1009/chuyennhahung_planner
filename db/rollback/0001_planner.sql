-- Rollback for db/migrations/0001_planner.sql. DESTROYS all Planner data:
-- run `npm run planner:export -- <file>` first. Never run by the migrate
-- runner; apply by hand with psql, then:
--   DELETE FROM schema_migrations WHERE name = '0001_planner.sql';
DROP TABLE IF EXISTS trip_expenses;
DROP TABLE IF EXISTS trip_activities;
DROP TABLE IF EXISTS trip_days;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS planner_oauth_attempts;
DROP TABLE IF EXISTS planner_sessions;
DROP TABLE IF EXISTS planner_users;
