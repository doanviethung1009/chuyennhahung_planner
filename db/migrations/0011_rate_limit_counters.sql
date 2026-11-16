-- 0011_rate_limit_counters — shared fixed-window counters for write rate limits
-- (ADR 0019 §3, batch 10.3). One row per (hashed key, window); the app does a
-- single atomic upsert per check and sweeps rows older than 24 hours.
-- `key` is a SHA-256 hex of limiter name + caller key: no address or user id in the clear.
-- `window_start` is the window's start in epoch milliseconds. No foreign keys (ADR 0013).
-- Rollback: db/rollback/0011_rate_limit_counters.sql.

CREATE TABLE rate_limit_counters (
  key          text   NOT NULL CHECK (char_length(key) <= 64),
  window_start bigint NOT NULL,
  count        integer NOT NULL CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);

-- The sweep deletes by age.
CREATE INDEX rate_limit_counters_window_idx ON rate_limit_counters (window_start);
