-- 0007_review_hold — staff can hold a review and ask its author (ADR 0015, PR 1).
-- Widens the status CHECK of community_reviews with 'held'. Additive: no row changes.
-- The constraint is the default name Postgres gave the inline CHECK in 0006.
-- Rollback: db/rollback/0007_review_hold.sql.

ALTER TABLE community_reviews DROP CONSTRAINT IF EXISTS community_reviews_status_check;
ALTER TABLE community_reviews
  ADD CONSTRAINT community_reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'held'));
