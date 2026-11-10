-- 0001_planner — the Planner document as normalised tables (ADR 0008 §3).
-- Rollback: db/rollback/0001_planner.sql. Applied by `npm run db:migrate`,
-- never on app boot. Unqualified names: they land in the connection's
-- search_path schema (public by default).
--
-- `seq` preserves insertion order, so a table reads back in the same sequence
-- the JSON store's arrays had (and export -> import round-trips exactly).

CREATE TABLE planner_users (
  seq                  bigint GENERATED ALWAYS AS IDENTITY,
  id                   text PRIMARY KEY,
  handle               text NOT NULL UNIQUE,
  display_name         text NOT NULL,
  token_hash           text NOT NULL UNIQUE,
  created_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL,
  email                text UNIQUE,
  password_hash        text,
  must_change_password boolean,
  google_sub           text UNIQUE,
  created_via          text CHECK (created_via IN ('operator', 'google'))
);

CREATE TABLE planner_sessions (
  seq          bigint GENERATED ALWAYS AS IDENTITY,
  id           text PRIMARY KEY,
  token_hash   text NOT NULL UNIQUE,
  user_id      text NOT NULL REFERENCES planner_users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  method       text CHECK (method IN ('token', 'password', 'google'))
);
CREATE INDEX planner_sessions_user_id_idx ON planner_sessions (user_id);
CREATE INDEX planner_sessions_expires_at_idx ON planner_sessions (expires_at);

CREATE TABLE planner_oauth_attempts (
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  id            text PRIMARY KEY,
  state_hash    text NOT NULL UNIQUE,
  nonce         text NOT NULL,
  code_verifier text NOT NULL,
  return_to     text NOT NULL,
  locale        text NOT NULL CHECK (locale IN ('vi', 'en')),
  link_user_id  text REFERENCES planner_users (id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL
);
CREATE INDEX planner_oauth_attempts_link_user_id_idx ON planner_oauth_attempts (link_user_id);
CREATE INDEX planner_oauth_attempts_expires_at_idx ON planner_oauth_attempts (expires_at);

-- owner_id: NO ACTION on purpose — the repository refuses to delete a user who
-- still owns trips (deleteUser), and the database says the same.
CREATE TABLE trips (
  seq                     bigint GENERATED ALWAYS AS IDENTITY,
  id                      text PRIMARY KEY,
  owner_id                text NOT NULL REFERENCES planner_users (id),
  title                   text NOT NULL,
  destination_slug        text NOT NULL,
  start_date              date,
  end_date                date,
  duration_days           integer NOT NULL CHECK (duration_days BETWEEN 1 AND 30),
  party_size              integer NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  travel_style            text,
  pace                    text,
  budget_target_total_vnd bigint NOT NULL CHECK (budget_target_total_vnd >= 0),
  note                    text,
  status                  text NOT NULL CHECK (status IN ('active', 'archived')),
  archived_at             timestamptz,
  source_template         jsonb,
  planning_status         text NOT NULL DEFAULT 'draft'
                          CHECK (planning_status IN ('draft', 'planned', 'completed')),
  visibility              text NOT NULL DEFAULT 'private'
                          CHECK (visibility IN ('private', 'unlisted', 'public')),
  share_token             text UNIQUE,
  share_token_created_at  timestamptz,
  duplicated_from_trip_id text,
  version                 integer NOT NULL CHECK (version >= 1),
  created_at              timestamptz NOT NULL,
  updated_at              timestamptz NOT NULL,
  -- Deferred so an import (or a duplicate made in the same transaction as its
  -- source) can insert rows in any order.
  CONSTRAINT trips_duplicated_from_fkey FOREIGN KEY (duplicated_from_trip_id)
    REFERENCES trips (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX trips_owner_id_idx ON trips (owner_id);

CREATE TABLE trip_days (
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  id         text PRIMARY KEY,
  trip_id    text NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  date       date,
  title      text,
  note       text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT trip_days_trip_day_key UNIQUE (trip_id, day_number)
    DEFERRABLE INITIALLY DEFERRED
);

-- "order" is named sort_order here: same meaning, no quoting needed.
CREATE TABLE trip_activities (
  seq                bigint GENERATED ALWAYS AS IDENTITY,
  id                 text PRIMARY KEY,
  trip_id            text NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  day_id             text NOT NULL REFERENCES trip_days (id) ON DELETE CASCADE,
  sort_order         integer NOT NULL CHECK (sort_order >= 0),
  place_slug         text,
  title              text NOT NULL,
  start_time         text,
  duration_minutes   integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  estimated_cost_vnd bigint NOT NULL CHECK (estimated_cost_vnd >= 0),
  cost_scope         text NOT NULL CHECK (cost_scope IN ('group', 'per_person')),
  category           text NOT NULL,
  note               text,
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  -- Deferred, so a reorder that passes through a duplicate commits cleanly.
  CONSTRAINT trip_activities_day_order_key UNIQUE (day_id, sort_order)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX trip_activities_trip_id_idx ON trip_activities (trip_id);

-- Expense foreign keys copy the repository:
--   * deleteActivity sets expense.activityId = null and keeps the expense and
--     its day  ->  activity_id ON DELETE SET NULL.
--   * dropDays (shortening a trip) refuses while a day still holds an expense
--     ->  day_id is NO ACTION (checked at end of statement, so purging a whole
--     trip still works: its expenses go with it).
CREATE TABLE trip_expenses (
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  id          text PRIMARY KEY,
  trip_id     text NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  day_id      text REFERENCES trip_days (id),
  activity_id text REFERENCES trip_activities (id) ON DELETE SET NULL,
  label       text NOT NULL,
  category    text NOT NULL,
  amount_vnd  bigint NOT NULL CHECK (amount_vnd >= 0),
  cost_scope  text NOT NULL CHECK (cost_scope IN ('group', 'per_person')),
  paid_on     date,
  note        text,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);
CREATE INDEX trip_expenses_trip_id_idx ON trip_expenses (trip_id);
CREATE INDEX trip_expenses_day_id_idx ON trip_expenses (day_id);
CREATE INDEX trip_expenses_activity_id_idx ON trip_expenses (activity_id);
