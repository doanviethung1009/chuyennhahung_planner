import {
  collectionSchema,
  placeSchema,
  reviewSchema,
  storySchema,
  templateSchema,
} from '@/server/content/schemas';
import type { ContentData } from '@/server/content/store';
import type { Column, TableSpec } from './planner-rows';

/**
 * The Travel Content half of the table engine (ADR 0013 §1–§3): which table
 * holds which collection and which column holds which field. The record <-> row
 * mapping, the diff and the transaction protocol are `planner-rows.ts` and
 * `postgres-planner-store.ts`, shared with the Planner.
 *
 * Every column maps one field of the zod schemas in `src/server/content/
 * schemas.ts`. A field that has no column here would be dropped on write — so
 * `tests/content-rows.test.ts` round-trips every collection and fails when the
 * schema grows a field this list does not know.
 */

type Type = Column['type'];
type Mode = Column['mode'];
type Rec = Record<string, unknown>;

const col = (field: string, column: string, type: Type, mode: Mode = 'required'): Column => ({
  field,
  column,
  type,
  mode,
});

/** A column that reads one key of a nested object field (`coords.lat`). */
const nested = (
  field: string,
  key: string,
  column: string,
  type: Type,
  mode: Mode = 'required',
): Column => ({
  field,
  column,
  type,
  mode,
  get: (record) => (record[field] as Rec | null | undefined)?.[key],
  set: (record, value) => {
    record[field] = { ...((record[field] as Rec | undefined) ?? {}), [key]: value };
  },
});

const stamps = [
  col('createdAt', 'created_at', 'timestamptz'),
  col('updatedAt', 'updated_at', 'timestamptz'),
];

const lifecycle = [
  col('status', 'status', 'text'),
  col('publishedAt', 'published_at', 'timestamptz', 'nullable'),
];

const SLUG_KEY = { field: 'slug', column: 'slug' };

export const CONTENT_TABLES: readonly TableSpec<keyof ContentData>[] = [
  {
    collection: 'places',
    table: 'content_places',
    key: SLUG_KEY,
    parse: (r) => placeSchema.parse(r) as unknown as Rec,
    columns: [
      col('slug', 'slug', 'text'),
      col('name', 'name', 'jsonb'),
      col('destinationSlug', 'destination_slug', 'text'),
      col('location', 'location', 'jsonb'),
      nested('coords', 'lat', 'lat', 'float'),
      nested('coords', 'lng', 'lng', 'float'),
      col('category', 'category', 'text'),
      col('images', 'images', 'jsonb'),
      col('description', 'description', 'jsonb'),
      col('suggestedMinutes', 'suggested_minutes', 'int'),
      col('estimatedCostVnd', 'estimated_cost_vnd', 'bigint'),
      col('rating', 'rating', 'float', 'nullable'),
      col('personalNote', 'personal_note', 'jsonb', 'nullable'),
      col('affiliateLinks', 'affiliate_links', 'jsonb'),
      ...lifecycle,
      ...stamps,
    ],
  },
  {
    collection: 'reviews',
    table: 'content_reviews',
    parse: (r) => reviewSchema.parse(r) as unknown as Rec,
    columns: [
      col('id', 'id', 'text'),
      nested('subject', 'kind', 'subject_kind', 'text'),
      nested('subject', 'ref', 'subject_ref', 'text'),
      col('title', 'title', 'jsonb'),
      col('rating', 'rating', 'float'),
      col('body', 'body', 'jsonb'),
      col('pros', 'pros', 'jsonb'),
      col('cons', 'cons', 'jsonb'),
      col('visitedOn', 'visited_on', 'date'),
      col('costVnd', 'cost_vnd', 'bigint', 'nullable'),
      col('author', 'author', 'text'),
      ...lifecycle,
      ...stamps,
    ],
  },
  {
    collection: 'stories',
    table: 'content_stories',
    key: SLUG_KEY,
    parse: (r) => storySchema.parse(r) as unknown as Rec,
    columns: [
      col('slug', 'slug', 'text'),
      col('title', 'title', 'jsonb'),
      col('excerpt', 'excerpt', 'jsonb'),
      col('content', 'content', 'jsonb'),
      col('cover', 'cover', 'text'),
      col('gallery', 'gallery', 'jsonb'),
      col('destinationSlug', 'destination_slug', 'text', 'nullable'),
      col('plannerTemplateSlug', 'planner_template_slug', 'text', 'nullable'),
      nested('travelDates', 'start', 'travel_start', 'date'),
      nested('travelDates', 'end', 'travel_end', 'date'),
      col('actualCost', 'actual_cost', 'jsonb', 'nullable'),
      col('placeSlugs', 'place_slugs', 'textarray'),
      col('reviewIds', 'review_ids', 'textarray'),
      col('itinerarySlugs', 'itinerary_slugs', 'textarray'),
      col('travelStyle', 'travel_style', 'text', 'nullable'),
      col('readingMinutes', 'reading_minutes', 'int'),
      col('seo', 'seo', 'jsonb'),
      ...lifecycle,
      col('actualCostTotalVnd', 'actual_cost_total_vnd', 'bigint', 'nullable'),
      ...stamps,
    ],
  },
  {
    collection: 'collections',
    table: 'content_collections',
    key: SLUG_KEY,
    parse: (r) => collectionSchema.parse(r) as unknown as Rec,
    columns: [
      col('slug', 'slug', 'text'),
      col('title', 'title', 'jsonb'),
      col('tagline', 'tagline', 'jsonb'),
      col('description', 'description', 'jsonb'),
      col('cover', 'cover', 'text'),
      col('destinationSlugs', 'destination_slugs', 'textarray'),
      col('storySlugs', 'story_slugs', 'textarray'),
      col('placeSlugs', 'place_slugs', 'textarray'),
      col('seo', 'seo', 'jsonb'),
      ...lifecycle,
      ...stamps,
    ],
  },
  {
    collection: 'templates',
    table: 'content_templates',
    key: SLUG_KEY,
    parse: (r) => templateSchema.parse(r) as unknown as Rec,
    columns: [
      col('slug', 'slug', 'text'),
      col('sourceStorySlug', 'source_story_slug', 'text'),
      col('title', 'title', 'jsonb'),
      col('summary', 'summary', 'jsonb'),
      col('travelStyle', 'travel_style', 'text'),
      col('pace', 'pace', 'text'),
      col('groupSize', 'group_size', 'jsonb'),
      col('itinerarySlugs', 'itinerary_slugs', 'textarray'),
      col('days', 'days', 'jsonb'),
      col('visibility', 'visibility', 'text'),
      col('durationDays', 'duration_days', 'int'),
      col('placeSlugs', 'place_slugs', 'textarray'),
      col('estimatedTotalVnd', 'estimated_total_vnd', 'bigint'),
      col('version', 'version', 'int'),
      col('sourceSnapshot', 'source_snapshot', 'jsonb'),
      ...stamps,
    ],
  },
];
