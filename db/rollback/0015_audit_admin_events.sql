-- Manual rollback for 0015_audit_admin_events. Never run by the migration runner.
-- Remove story events first (older code rejects 'story'), then drop the indexes:
--   DELETE FROM audit_events WHERE target_kind = 'story';
--   DELETE FROM schema_migrations WHERE name = '0015_audit_admin_events.sql';

DROP INDEX IF EXISTS audit_events_actor;
DROP INDEX IF EXISTS audit_events_created;
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_target_kind_check;
ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_target_kind_check CHECK (target_kind IN ('trip', 'review', 'user'));
