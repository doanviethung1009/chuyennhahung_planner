-- 0004_content — Travel Content as normalised tables (ADR 0013).
-- Rollback: db/rollback/0004_content.sql. Applied by `npm run db:migrate` and by
-- the app at startup, like every file here. Unqualified names: they land in the
-- connection's search_path schema.
--
-- Scalars are columns; structure that is read and written as a unit (localised
-- {vi, en} text, story blocks, SEO, template days) is jsonb; slug lists are
-- text[]. `seq` keeps insertion order so a table reads back in the order the
-- JSON file's arrays had. There are deliberately no foreign keys between
-- content entities (ADR 0013 §5): the repository has no "still referenced" rule.

CREATE TABLE content_places (
  seq               bigint GENERATED ALWAYS AS IDENTITY,
  slug              text PRIMARY KEY,
  name              jsonb NOT NULL,
  destination_slug  text NOT NULL,
  location          jsonb NOT NULL,
  lat               double precision NOT NULL,
  lng               double precision NOT NULL,
  category          text NOT NULL CHECK (category IN
                      ('cafe', 'restaurant', 'street-food', 'viewpoint', 'stay', 'market',
                       'museum', 'nature', 'activity', 'transport')),
  images            jsonb NOT NULL,
  description       jsonb NOT NULL,
  suggested_minutes integer NOT NULL,
  estimated_cost_vnd bigint NOT NULL CHECK (estimated_cost_vnd >= 0),
  rating            double precision CHECK (rating BETWEEN 1 AND 5),
  personal_note     jsonb,
  affiliate_links   jsonb NOT NULL,
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL
);
CREATE INDEX content_places_destination_idx ON content_places (destination_slug);

CREATE TABLE content_reviews (
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  id            text PRIMARY KEY,
  subject_kind  text NOT NULL CHECK (subject_kind IN ('place', 'destination', 'itinerary')),
  subject_ref   text NOT NULL,
  title         jsonb NOT NULL,
  rating        double precision NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          jsonb NOT NULL,
  pros          jsonb NOT NULL,
  cons          jsonb NOT NULL,
  visited_on    date NOT NULL,
  cost_vnd      bigint CHECK (cost_vnd >= 0),
  author        text NOT NULL,
  status        text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);
CREATE INDEX content_reviews_subject_idx ON content_reviews (subject_kind, subject_ref);

CREATE TABLE content_stories (
  seq                     bigint GENERATED ALWAYS AS IDENTITY,
  slug                    text PRIMARY KEY,
  title                   jsonb NOT NULL,
  excerpt                 jsonb NOT NULL,
  content                 jsonb NOT NULL,
  cover                   text NOT NULL,
  gallery                 jsonb NOT NULL,
  destination_slug        text,
  planner_template_slug   text,
  travel_start            date NOT NULL,
  travel_end              date NOT NULL,
  actual_cost             jsonb,
  place_slugs             text[] NOT NULL,
  review_ids              text[] NOT NULL,
  itinerary_slugs         text[] NOT NULL,
  travel_style            text CHECK (travel_style IN
                            ('romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed')),
  reading_minutes         integer NOT NULL,
  seo                     jsonb NOT NULL,
  status                  text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at            timestamptz,
  actual_cost_total_vnd   bigint CHECK (actual_cost_total_vnd >= 0),
  created_at              timestamptz NOT NULL,
  updated_at              timestamptz NOT NULL
);
CREATE INDEX content_stories_status_idx ON content_stories (status, published_at);
CREATE INDEX content_stories_destination_idx ON content_stories (destination_slug);

CREATE TABLE content_collections (
  seq               bigint GENERATED ALWAYS AS IDENTITY,
  slug              text PRIMARY KEY,
  title             jsonb NOT NULL,
  tagline           jsonb NOT NULL,
  description       jsonb NOT NULL,
  cover             text NOT NULL,
  destination_slugs text[] NOT NULL,
  story_slugs       text[] NOT NULL,
  place_slugs       text[] NOT NULL,
  seo               jsonb NOT NULL,
  status            text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at      timestamptz,
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL
);

CREATE TABLE content_templates (
  seq                 bigint GENERATED ALWAYS AS IDENTITY,
  slug                text PRIMARY KEY,
  source_story_slug   text NOT NULL,
  title               jsonb NOT NULL,
  summary             jsonb NOT NULL,
  travel_style        text NOT NULL CHECK (travel_style IN
                        ('romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed')),
  pace                text NOT NULL CHECK (pace IN ('relaxed', 'balanced', 'active')),
  group_size          jsonb NOT NULL,
  itinerary_slugs     text[] NOT NULL,
  days                jsonb NOT NULL,
  visibility          text NOT NULL CHECK (visibility IN ('private', 'public')),
  duration_days       integer NOT NULL CHECK (duration_days BETWEEN 1 AND 30),
  place_slugs         text[] NOT NULL,
  estimated_total_vnd bigint NOT NULL CHECK (estimated_total_vnd >= 0),
  version             integer NOT NULL CHECK (version >= 1),
  source_snapshot     jsonb NOT NULL,
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL
);
CREATE INDEX content_templates_visibility_idx ON content_templates (visibility);

-- The change counter behind the per-instance cache (ADR 0009 §2, ADR 0013 §8).
CREATE TABLE content_revision (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  revision bigint NOT NULL DEFAULT 0
);

INSERT INTO content_revision (id, revision) VALUES (true, 0);
