-- Manual rollback of 0004_content (ADR 0013). Export first:
--   npm run content:export -- travel-content.json
-- then unset CONTENT_DATABASE_URL. This drops the content tables and removes
-- the migration record, so 0004 can be applied again later.

DROP TABLE IF EXISTS content_revision;
DROP TABLE IF EXISTS content_templates;
DROP TABLE IF EXISTS content_collections;
DROP TABLE IF EXISTS content_stories;
DROP TABLE IF EXISTS content_reviews;
DROP TABLE IF EXISTS content_places;
DELETE FROM schema_migrations WHERE name = '0004_content.sql';
