-- 0003_planner_revision — the change counter behind the per-instance cache
-- (ADR 0009 §2). One row; every committing Planner transaction increments it
-- under the Planner advisory lock, so a replica can tell in one cheap query
-- whether its cached copy of the tables is still current.
-- Rollback: db/rollback/0003_planner_revision.sql.

CREATE TABLE planner_revision (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  revision bigint NOT NULL DEFAULT 0
);

INSERT INTO planner_revision (id, revision) VALUES (true, 0);
