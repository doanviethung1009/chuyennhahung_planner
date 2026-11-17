-- Manual rollback for 0014_guest_key_privacy. Never run by the migration runner.
-- DOES NOT RESTORE DATA: the guest keys cleared by 0014 (community_reviews.guest_key,
-- reports.client_key, review_restrictions.guest_key) and the guest restrictions it
-- lifted ('privacy migration') are gone for good. This only puts the 0008 CHECK back.
-- Deploy code from before ADR 0024 first (it expects a key on every guest restriction).
-- Cleared restriction keys get the placeholder 'cleared' so the old CHECK holds; the
-- rows are already lifted, so the placeholder matches nobody.
--   DELETE FROM schema_migrations WHERE name = '0014_guest_key_privacy.sql';

ALTER TABLE review_restrictions DROP CONSTRAINT IF EXISTS review_restrictions_subject_key_check;
UPDATE review_restrictions SET guest_key = 'cleared' WHERE subject = 'guest' AND guest_key IS NULL;
ALTER TABLE review_restrictions ADD CONSTRAINT review_restrictions_check CHECK (
  (subject = 'user' AND author_id IS NOT NULL) OR (subject = 'guest' AND guest_key IS NOT NULL)
);
