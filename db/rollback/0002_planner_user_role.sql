-- Manual rollback for 0002_planner_user_role. Never run by the migration
-- runner. DESTRUCTIVE: drops every stored role (users read as `member`).
--   DELETE FROM schema_migrations WHERE name = '0002_planner_user_role.sql';

ALTER TABLE planner_users DROP COLUMN IF EXISTS role;
