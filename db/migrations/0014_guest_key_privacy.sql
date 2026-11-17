-- 0014_guest_key_privacy — ADR 0024 (guest identity and privacy, D4).
-- Guest keys move from an unsalted SHA-256 prefix to HMAC-SHA256 under a server
-- secret (GUEST_KEY_SECRET). A stored key cannot be re-keyed (the address is not
-- stored), so every existing key is cleared and active guest restrictions end.
-- IRREVERSIBLE: the cleared keys cannot be restored. Review text, report content
-- and the restriction rows themselves stay. Rollback: db/rollback/0014_guest_key_privacy.sql.

-- 1. The 0008 CHECK demanded a key on every guest restriction. Find it by shape
--    (its generated name is not guaranteed) and replace it below.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'review_restrictions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%guest_key%'
  LOOP
    EXECUTE format('ALTER TABLE review_restrictions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 2. End guest restrictions: still active -> 'privacy migration'; already past
--    their expiry but never marked lifted -> 'key expired' (as the sweep does).
UPDATE review_restrictions
   SET lifted_at = now(), lifted_by = 'privacy migration'
 WHERE subject = 'guest' AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now());
UPDATE review_restrictions
   SET lifted_at = expires_at, lifted_by = 'key expired'
 WHERE subject = 'guest' AND lifted_at IS NULL;

-- 3. Clear every existing guest key.
UPDATE review_restrictions SET guest_key = NULL WHERE subject = 'guest' AND guest_key IS NOT NULL;
UPDATE community_reviews   SET guest_key = NULL WHERE guest_key IS NOT NULL;
UPDATE reports             SET client_key = NULL WHERE client_key IS NOT NULL;

-- 4. A guest restriction needs its key only while it is live.
ALTER TABLE review_restrictions ADD CONSTRAINT review_restrictions_subject_key_check CHECK (
  (subject = 'user' AND author_id IS NOT NULL)
  OR (subject = 'guest' AND (guest_key IS NOT NULL OR lifted_at IS NOT NULL))
);
