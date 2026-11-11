-- 0002_planner_user_role — the user role from ADR 0006 (ADR 0009 §3).
-- Nullable: an absent role reads as `member`, exactly as in the JSON store.
-- Rollback: db/rollback/0002_planner_user_role.sql.

ALTER TABLE planner_users
  ADD COLUMN role text CHECK (role IN ('member', 'editor', 'admin'));
