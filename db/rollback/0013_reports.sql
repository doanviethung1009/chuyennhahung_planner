-- Manual rollback for 0013_reports. Never run by the migration runner.
-- DESTRUCTIVE: drops every report, open or resolved. Remove the Report control and
-- the /api/community/reports and /api/admin/community/reports routes first (older
-- code does not know the table or the JSON key `reports`). Audit events written by
-- resolving a report stay (they target the trip or review).
--   DELETE FROM schema_migrations WHERE name = '0013_reports.sql';

DROP TABLE IF EXISTS reports;
