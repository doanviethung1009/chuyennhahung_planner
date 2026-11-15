-- Manual rollback for 0009_super_admin_and_account_state. Never run by the
-- migration runner. DESTRUCTIVE: drops every ban and soft-delete mark, and the
-- CHECK cannot be restored while a 'super_admin' row exists, so demote those
-- accounts first:
--   UPDATE planner_users SET role = 'admin' WHERE role = 'super_admin';
--   DELETE FROM schema_migrations WHERE name = '0009_super_admin_and_account_state.sql';

ALTER TABLE planner_users
  DROP COLUMN IF EXISTS banned_at,
  DROP COLUMN IF EXISTS banned_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE planner_users DROP CONSTRAINT IF EXISTS planner_users_role_check;
ALTER TABLE planner_users
  ADD CONSTRAINT planner_users_role_check
  CHECK (role IN ('member', 'editor', 'admin'));
