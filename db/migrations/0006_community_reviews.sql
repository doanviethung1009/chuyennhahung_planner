-- 0006_community_reviews — traveller place reviews (ADR 0014, PR 2).
-- No foreign keys (ADR 0013): a guest review has no author row. `seq` keeps
-- insertion order, as in every other table: the store reads with ORDER BY seq.
-- Rollback: db/rollback/0006_community_reviews.sql.

CREATE TABLE community_reviews (
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  id            text PRIMARY KEY,
  source        text NOT NULL CHECK (source IN ('planner', 'homepage')),
  author_id     text,
  place_slug    text NOT NULL,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          text NOT NULL,
  lang          text NOT NULL CHECK (lang IN ('vi', 'en')),
  visited_on    date NOT NULL,
  author_name   text,
  status        text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  guest_key     text,
  decided_at    timestamptz,
  decided_by    text,
  reject_reason text,
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE INDEX community_reviews_place_status ON community_reviews (place_slug, status);
CREATE INDEX community_reviews_author ON community_reviews (author_id) WHERE author_id IS NOT NULL;
