-- Manual rollback for 0010_audit_events. Never run by the migration runner.
-- DESTRUCTIVE: drops the whole community audit log. Remove the appendEvent calls
-- and the events route first (older code does not know the table or the JSON key).
--   DELETE FROM schema_migrations WHERE name = '0010_audit_events.sql';

DROP TABLE IF EXISTS audit_events;
