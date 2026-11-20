-- Manual rollback for 0016_member_map_shares. Never run by the migration runner.
-- DESTRUCTIVE: drops every member's map-sharing setting, so every issued share
-- link dies. Before running it, revoke all tokens or disable /shared-map/[token]
-- so old links answer 404 (older code does not know the table or the JSON key).
--   DELETE FROM schema_migrations WHERE name = '0016_member_map_shares.sql';

DROP TABLE IF EXISTS member_map_shares;
