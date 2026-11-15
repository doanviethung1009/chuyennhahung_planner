-- 0009_super_admin_and_account_state — ADR 0017.
-- Widens the role CHECK of planner_users with 'super_admin' (the inline CHECK of
-- 0002 has the default name planner_users_role_check) and adds the ban / soft
-- delete columns. All nullable: an absent value means active, as in the JSON
-- store. Additive: no row changes.
-- Rollback: db/rollback/0009_super_admin_and_account_state.sql.

ALTER TABLE planner_users DROP CONSTRAINT IF EXISTS planner_users_role_check;
ALTER TABLE planner_users
  ADD CONSTRAINT planner_users_role_check
  CHECK (role IN ('member', 'editor', 'admin', 'super_admin'));

ALTER TABLE planner_users
  ADD COLUMN IF NOT EXISTS banned_at  timestamptz,
  ADD COLUMN IF NOT EXISTS banned_by  text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;
