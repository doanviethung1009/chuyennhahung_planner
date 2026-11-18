-- 0015_audit_admin_events — admin audit viewer (P07-13).
-- Adds the 'story' target kind (publish / unpublish / archive) next to trip, review
-- and user, and two indexes for the /admin/audit filters. Additive: no row changes.
-- Rollback: db/rollback/0015_audit_admin_events.sql.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'audit_events'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%target_kind%'
  LOOP
    EXECUTE format('ALTER TABLE audit_events DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_target_kind_check
  CHECK (target_kind IN ('trip', 'review', 'user', 'story'));

CREATE INDEX audit_events_created ON audit_events (created_at DESC, id DESC);
CREATE INDEX audit_events_actor ON audit_events (actor_id, created_at DESC);
