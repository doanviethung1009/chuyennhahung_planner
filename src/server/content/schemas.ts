import { z } from 'zod';

/**
 * Single source of truth for the Travel Content System. Every domain type in
 * this module is `z.infer`-ed from the schema that validates it, so a validator
 * and its model cannot drift apart. See `docs/adr/0001-travel-content-system.md`.
 */

/**
 * PATCH schemas: Zod 4 applies `.default(...)` even inside `.partial()`, so a
 * one-field PATCH would reset every defaulted field (placeSlugs, gallery, pros…).
 * Strip top-level defaults first so an absent key stays absent. Create schemas
 * keep their defaults.
 */
type WithoutDefaults<S extends z.ZodRawShape> = {
  [K in keyof S]: S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K];
};

function updateShape<S extends z.ZodRawShape>(shape: S): WithoutDefaults<S> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as WithoutDefaults<S>;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(96)
  .regex(SLUG_PATTERN, 'must be lowercase words joined by single hyphens');

/** `YYYY-MM-DD`, and a date that actually exists — `2025-02-30` is rejected. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'is not a real calendar date');

// `z.iso.datetime()` is zod 4's home for this; `z.string().datetime()` still
// works but is deprecated. Verified equivalent before the swap: both accept a
// UTC instant with or without milliseconds and reject a date, an offset and a
// space-separated form, with the same message.
export const timestampSchema = z.iso.datetime();

/**
 * Money is always an integer count of đồng — never a float, never cents.
 * The ceiling is 10^12 (a thousand billion đồng), high enough for any real trip
 * and low enough to catch a unit mistake such as passing a minor unit.
 */
export const vndSchema = z
  .number()
  .int('VND amounts must be whole đồng')
  .min(0)
  .max(1_000_000_000_000, 'implausibly large — check the unit');

/**
 * Rule 1 in CLAUDE.md: no user-visible string ships in one locale only. A
 * localized field is therefore structurally required to carry both.
 */
export const localizedTextSchema = z.object({
  vi: z.string().trim().min(1, 'Vietnamese text is required'),
  en: z.string().trim().min(1, 'English text is required'),
});

function localizedListSchema(minItems: number) {
  const list = z.array(z.string().trim().min(1)).min(minItems).max(50);
  return z.object({ vi: list, en: list });
}

export const localizedParagraphsSchema = localizedListSchema(1);
export const localizedTagsSchema = localizedListSchema(0);

/**
 * Either a committed asset under `/images/**` or an absolute https URL on a host
 * `next.config.ts` allows. Rule 4: `#` and other placeholders are defects, so
 * nothing relative or schemeless is accepted here.
 */
export const imageRefSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      /^\/images\/[\w./-]+\.(svg|jpg|jpeg|png|webp|avif)$/i.test(value) ||
      /^https:\/\/[^\s]+$/.test(value),
    'must be a committed /images/… asset or an https URL',
  );

export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .startsWith('https://', 'must be https');

export const ratingSchema = z
  .number()
  .min(1)
  .max(5)
  .refine((value) => Number.isInteger(value * 2), 'must land on a half star');

export const publishStatusSchema = z.enum(['draft', 'published', 'archived']);
export const visibilitySchema = z.enum(['private', 'public']);

export const seoSchema = z.object({
  /** Falls back to the entity title when omitted, so it is optional by design. */
  title: localizedTextSchema.nullable().default(null),
  description: localizedTextSchema,
  ogImage: imageRefSchema.nullable().default(null),
  canonicalPath: z
    .string()
    .trim()
    .startsWith('/', 'must be a site-relative path')
    .max(200)
    .nullable()
    .default(null),
  noindex: z.boolean().default(false),
  keywords: localizedTagsSchema.default({ vi: [], en: [] }),
});

/** Start/end pair used for travel dates, validated in order. */
export const dateRangeSchema = z
  .object({ start: isoDateSchema, end: isoDateSchema })
  .refine((range) => range.start <= range.end, {
    message: 'end date must not precede the start date',
    path: ['end'],
  });

// ---------------------------------------------------------------------------
// Travel Places
// ---------------------------------------------------------------------------

export const placeCategorySchema = z.enum([
  'cafe',
  'restaurant',
  'street-food',
  'viewpoint',
  'stay',
  'market',
  'museum',
  'nature',
  'activity',
  'transport',
]);

/**
 * Affiliate links are optional and intentionally empty in seed data — no partner
 * programme exists yet (CLAUDE.md rule 8).
 */
export const affiliateLinkSchema = z.object({
  partner: z.string().trim().min(2).max(60),
  label: localizedTextSchema,
  url: httpsUrlSchema,
});

export const coordsSchema = z.object({
  /** Vietnam spans roughly 8.2–23.4 N, 102.1–109.5 E; bounds are generous. */
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const placeInputSchema = z.object({
  slug: slugSchema,
  name: localizedTextSchema,
  /** Reuses the existing `Destination` collection — never a free-text region. */
  destinationSlug: slugSchema,
  location: localizedTextSchema,
  coords: coordsSchema,
  category: placeCategorySchema,
  images: z.array(imageRefSchema).max(20).default([]),
  description: localizedParagraphsSchema,
  suggestedMinutes: z.number().int().min(5).max(24 * 60),
  estimatedCostVnd: vndSchema,
  /** Our own visit, not an aggregate score. Null when we have not rated it. */
  rating: ratingSchema.nullable().default(null),
  personalNote: localizedTextSchema.nullable().default(null),
  affiliateLinks: z.array(affiliateLinkSchema).max(10).default([]),
});

/** `/admin/content/{stories,places}/new` is the create page, so a record with this slug could never be opened there. */
const notReservedSlug = (input: { slug: string }) => input.slug !== 'new';
const reservedSlugIssue = { message: 'this slug is reserved', path: ['slug'] };

export const placeCreateSchema = placeInputSchema.refine(notReservedSlug, reservedSlugIssue);
/** PATCH semantics: every field optional, slug immutable (URLs are permanent). */
export const placeUpdateSchema = z.object(updateShape(placeInputSchema.omit({ slug: true }).shape)).partial();

export const placeSchema = placeInputSchema.extend({
  /**
   * Publish state (ADR 0035). A record stored before this field existed has none
   * and was public, so parsing defaults it to `published`.
   */
  status: publishStatusSchema.default('published'),
  publishedAt: timestampSchema.nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * True when a place may be shown to visitors or added to a trip. Reads a missing
 * `status` as published, because a JSON store file written before ADR 0035 holds
 * places without one and the file store does not re-parse them.
 */
export function isPublishedPlace(place: { status?: PublishStatus | undefined }): boolean {
  return (place.status ?? 'published') === 'published';
}

// ---------------------------------------------------------------------------
// Travel Stories — rich content as typed blocks
// ---------------------------------------------------------------------------

const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: localizedTextSchema,
});

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  /** `h1` belongs to the page, never to body content (CLAUDE.md rule 5). */
  level: z.union([z.literal(2), z.literal(3)]),
  text: localizedTextSchema,
});

const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: imageRefSchema,
  /** Meaningful alt text is required, in both locales. */
  alt: localizedTextSchema,
  caption: localizedTextSchema.nullable().default(null),
});

const quoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: localizedTextSchema,
  attribution: z.string().trim().max(120).nullable().default(null),
});

const listBlockSchema = z.object({
  type: z.literal('list'),
  ordered: z.boolean().default(false),
  items: localizedParagraphsSchema,
});

/** Embeds a `Place` inline instead of re-describing it in prose. */
const placeBlockSchema = z.object({
  type: z.literal('place'),
  placeSlug: slugSchema,
  note: localizedTextSchema.nullable().default(null),
});

const costBlockSchema = z.object({
  type: z.literal('cost'),
  label: localizedTextSchema,
  amountVnd: vndSchema,
});

export const storyBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  headingBlockSchema,
  imageBlockSchema,
  quoteBlockSchema,
  listBlockSchema,
  placeBlockSchema,
  costBlockSchema,
]);

export const costCategorySchema = z.enum([
  'transport',
  'stay',
  'food',
  'tickets',
  'rental',
  'shopping',
  'other',
]);

const costLineSchema = z.object({
  category: costCategorySchema,
  label: localizedTextSchema,
  amountVnd: vndSchema,
});

/**
 * What the trip actually cost, optional by design — older stories were written
 * before we tracked spending. `totalVnd` is recomputed from the breakdown on
 * write, never trusted from the client.
 */
export const tripCostSchema = z.object({
  partySize: z.number().int().min(1).max(50),
  currency: z.literal('VND').default('VND'),
  breakdown: z.array(costLineSchema).min(1).max(40),
  note: localizedTextSchema.nullable().default(null),
});

export const storyInputSchema = z.object({
  slug: slugSchema,
  title: localizedTextSchema,
  excerpt: localizedTextSchema,
  content: z.array(storyBlockSchema).min(1).max(200),
  cover: imageRefSchema,
  gallery: z.array(imageRefSchema).max(30).default([]),
  /** Null for a story that is not about one destination (ADR 0012). */
  destinationSlug: slugSchema.nullable(),
  /**
   * Public Planner template that is this story's real itinerary. Cannot be derived
   * from `template.sourceStorySlug`: a template may be cut from a different story.
   * Optional on input so documents stored before ADR 0012 still validate (ADR 0012).
   */
  plannerTemplateSlug: slugSchema.nullable().default(null),
  travelDates: dateRangeSchema,
  actualCost: tripCostSchema.nullable().default(null),
  placeSlugs: z.array(slugSchema).max(60).default([]),
  reviewIds: z.array(z.string().trim().min(3).max(96)).max(60).default([]),
  /** Related tour services — existing `Itinerary` slugs. */
  itinerarySlugs: z.array(slugSchema).max(20).default([]),
  travelStyle: z
    .enum(['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'])
    .nullable()
    .default(null),
  readingMinutes: z.number().int().min(1).max(120),
  seo: seoSchema,
});

export const storyCreateSchema = storyInputSchema.refine(notReservedSlug, reservedSlugIssue);
export const storyUpdateSchema = z.object(updateShape(storyInputSchema.omit({ slug: true }).shape)).partial();

export const storySchema = storyInputSchema.extend({
  status: publishStatusSchema,
  publishedAt: timestampSchema.nullable(),
  /** Recomputed from `actualCost.breakdown`; null when no cost was recorded. */
  actualCostTotalVnd: vndSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const publishActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive']),
  /** Backdating a publish date is allowed; the repository validates the format. */
  publishedAt: timestampSchema.optional(),
});

export const storyPlacesPatchSchema = z.object({
  add: z.array(slugSchema).max(60).default([]),
  remove: z.array(slugSchema).max(60).default([]),
});

// ---------------------------------------------------------------------------
// Destination Collections — curation only, owns no content of its own
// ---------------------------------------------------------------------------

export const collectionInputSchema = z.object({
  slug: slugSchema,
  title: localizedTextSchema,
  tagline: localizedTextSchema,
  description: localizedParagraphsSchema,
  cover: imageRefSchema,
  destinationSlugs: z.array(slugSchema).min(1).max(40),
  storySlugs: z.array(slugSchema).max(60).default([]),
  placeSlugs: z.array(slugSchema).max(100).default([]),
  seo: seoSchema,
});

export const collectionCreateSchema = collectionInputSchema;
export const collectionUpdateSchema = z
  .object(updateShape(collectionInputSchema.omit({ slug: true }).shape))
  .partial();

export const collectionSchema = collectionInputSchema.extend({
  status: publishStatusSchema,
  publishedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------------------------------------------------------------------------
// Travel Reviews — written and rated; distinct from the link-free VideoReview
// ---------------------------------------------------------------------------

export const reviewSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place'), ref: slugSchema }),
  z.object({ kind: z.literal('destination'), ref: slugSchema }),
  z.object({ kind: z.literal('itinerary'), ref: slugSchema }),
]);

export const reviewInputSchema = z.object({
  id: z
    .string()
    .trim()
    .min(3)
    .max(96)
    .regex(SLUG_PATTERN, 'must be lowercase words joined by single hyphens'),
  subject: reviewSubjectSchema,
  title: localizedTextSchema,
  rating: ratingSchema,
  body: localizedParagraphsSchema,
  pros: localizedTagsSchema.default({ vi: [], en: [] }),
  cons: localizedTagsSchema.default({ vi: [], en: [] }),
  visitedOn: isoDateSchema,
  costVnd: vndSchema.nullable().default(null),
  /** The brand voice, not a personal identity — see ADR 0001. */
  author: z.string().trim().min(2).max(60),
});

export const reviewCreateSchema = reviewInputSchema;
export const reviewUpdateSchema = z.object(updateShape(reviewInputSchema.omit({ id: true }).shape)).partial();

export const reviewSchema = reviewInputSchema.extend({
  status: publishStatusSchema,
  publishedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ---------------------------------------------------------------------------
// Reusable Travel Templates — derived from a real trip, never writing back
// ---------------------------------------------------------------------------

export const travelStyleSchema = z.enum([
  'romantic',
  'family',
  'solo',
  'friends',
  'adventure',
  'budget',
  'foodie',
  'relaxed',
]);

export const paceSchema = z.enum(['relaxed', 'balanced', 'active']);

/**
 * Activity input carries no `id` and no `order`: ordering is the array position
 * and ids are server-assigned, so a client cannot create a duplicate or a gap.
 */
export const activityInputSchema = z.object({
  title: localizedTextSchema,
  placeSlug: slugSchema.nullable().default(null),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM, 24-hour')
    .nullable()
    .default(null),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  estimatedCostVnd: vndSchema,
  note: localizedTextSchema.nullable().default(null),
});

export const activitySchema = activityInputSchema.extend({
  id: z.string().min(1),
  order: z.number().int().min(0),
});

export const templateDayInputSchema = z.object({
  title: localizedTextSchema,
  summary: localizedTextSchema.nullable().default(null),
  activities: z.array(activityInputSchema).min(1).max(20),
});

export const templateDaySchema = z.object({
  /** Derived from array position, so days are always 1..n with no gaps. */
  day: z.number().int().min(1),
  title: localizedTextSchema,
  summary: localizedTextSchema.nullable(),
  activities: z.array(activitySchema).min(1),
});

/**
 * The frozen record of the source story at the moment the template was cut.
 * Editing or deleting that story never mutates this (ADR 0001 §4).
 */
export const sourceSnapshotSchema = z.object({
  storySlug: slugSchema,
  title: localizedTextSchema,
  destinationSlug: slugSchema.nullable(),
  travelDates: z.object({ start: isoDateSchema, end: isoDateSchema }),
  actualCostTotalVnd: vndSchema.nullable(),
  placeSlugs: z.array(slugSchema),
  /** The story's `updatedAt` when snapshotted — lets an editor spot staleness. */
  storyUpdatedAt: timestampSchema,
  snapshotTakenAt: timestampSchema,
});

export const templateInputSchema = z.object({
  slug: slugSchema,
  sourceStorySlug: slugSchema,
  title: localizedTextSchema,
  summary: localizedTextSchema,
  travelStyle: travelStyleSchema,
  pace: paceSchema,
  groupSize: localizedTextSchema,
  /** Related tour services this template can be booked through. */
  itinerarySlugs: z.array(slugSchema).max(20).default([]),
  days: z.array(templateDayInputSchema).min(1).max(30),
  visibility: visibilitySchema.default('private'),
});

export const templateCreateSchema = templateInputSchema;
export const templateUpdateSchema = z
  .object(updateShape(templateInputSchema.omit({ slug: true, sourceStorySlug: true, days: true }).shape))
  .partial()
  .extend({ days: z.array(templateDayInputSchema).min(1).max(30).optional() });

export const templateSchema = templateInputSchema
  .omit({ days: true })
  .extend({
    days: z.array(templateDaySchema).min(1),
    /** Derived from `days.length` — never supplied by the client. */
    durationDays: z.number().int().min(1).max(30),
    /** Derived union of every activity's place, in first-appearance order. */
    placeSlugs: z.array(slugSchema),
    /** Derived sum of every activity's `estimatedCostVnd`. */
    estimatedTotalVnd: vndSchema,
    version: z.number().int().min(1),
    sourceSnapshot: sourceSnapshotSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  });

/**
 * Reorder activities inside one day. The payload must be a permutation of that
 * day's existing activity ids — no additions, no removals, no duplicates.
 */
export const reorderActivitiesSchema = z.object({
  day: z.number().int().min(1).max(30),
  activityIds: z.array(z.string().min(1)).min(1).max(20),
});

/** Move a single activity between days, or to a new index within its day. */
export const moveActivitySchema = z.object({
  activityId: z.string().min(1),
  toDay: z.number().int().min(1).max(30),
  toIndex: z.number().int().min(0).max(19),
});

// ---------------------------------------------------------------------------
// Query schemas for list endpoints
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  status: publishStatusSchema.optional(),
  destinationSlug: slugSchema.optional(),
  category: placeCategorySchema.optional(),
  travelStyle: travelStyleSchema.optional(),
  visibility: visibilitySchema.optional(),
  /** Places search (PLACES-UI-S6): trimmed, 1–80 characters; other list endpoints ignore it. */
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

// ---------------------------------------------------------------------------
// Inferred domain types
// ---------------------------------------------------------------------------

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type PublishStatus = z.infer<typeof publishStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type PlaceCategory = z.infer<typeof placeCategorySchema>;
export type AffiliateLink = z.infer<typeof affiliateLinkSchema>;
export type Place = z.infer<typeof placeSchema>;
export type PlaceCreateInput = z.infer<typeof placeCreateSchema>;
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>;
export type StoryBlock = z.infer<typeof storyBlockSchema>;
export type CostCategory = z.infer<typeof costCategorySchema>;
export type TripCost = z.infer<typeof tripCostSchema>;
export type TravelStory = z.infer<typeof storySchema>;
export type StoryCreateInput = z.infer<typeof storyCreateSchema>;
export type StoryUpdateInput = z.infer<typeof storyUpdateSchema>;
export type PublishAction = z.infer<typeof publishActionSchema>;
export type StoryPlacesPatch = z.infer<typeof storyPlacesPatchSchema>;
export type DestinationCollection = z.infer<typeof collectionSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
export type ReviewSubject = z.infer<typeof reviewSubjectSchema>;
export type TravelReview = z.infer<typeof reviewSchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type TravelStyle = z.infer<typeof travelStyleSchema>;
export type TemplateActivity = z.infer<typeof activitySchema>;
export type TemplateActivityInput = z.infer<typeof activityInputSchema>;
export type TemplateDay = z.infer<typeof templateDaySchema>;
export type TemplateDayInput = z.infer<typeof templateDayInputSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type TravelTemplate = z.infer<typeof templateSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type ReorderActivitiesInput = z.infer<typeof reorderActivitiesSchema>;
export type MoveActivityInput = z.infer<typeof moveActivitySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
