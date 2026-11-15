-- Manual rollback for 0006_community_reviews. Never run by the migration runner.
-- DESTRUCTIVE: drops every traveller review.
--   DELETE FROM schema_migrations WHERE name = '0006_community_reviews.sql';

DROP TABLE IF EXISTS community_reviews;
