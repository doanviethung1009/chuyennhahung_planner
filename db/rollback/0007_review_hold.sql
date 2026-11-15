-- Manual rollback for 0007_review_hold. Never run by the migration runner.
-- Held rows would violate the narrower CHECK, so move them first. Restoring
-- them to 'approved' republishes content staff had hidden: use 'removed' to keep it down.
--   DELETE FROM schema_migrations WHERE name = '0007_review_hold.sql';

UPDATE community_reviews SET status = 'removed' WHERE status = 'held';
ALTER TABLE community_reviews DROP CONSTRAINT IF EXISTS community_reviews_status_check;
ALTER TABLE community_reviews
  ADD CONSTRAINT community_reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed'));
