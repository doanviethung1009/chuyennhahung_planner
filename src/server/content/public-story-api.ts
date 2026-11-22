import type { TravelStory } from './schemas';

/**
 * The public story record served by `GET /api/travel/stories` (STORY-API-PROJ).
 * An allow-list like `toPublicPlace` (ADR 0026): no `status`, `createdAt`,
 * `actualCost`, `actualCostTotalVnd`, `placeSlugs`, `reviewIds` or
 * `itinerarySlugs`. A new `TravelStory` field stays private until it is added
 * here on purpose. The raw record stays on the admin routes.
 */
export interface PublicStoryRecord {
  slug: string;
  title: TravelStory['title'];
  excerpt: TravelStory['excerpt'];
  content: TravelStory['content'];
  cover: string;
  gallery: string[];
  destinationSlug: string | null;
  plannerTemplateSlug: string | null;
  travelDates: TravelStory['travelDates'];
  travelStyle: TravelStory['travelStyle'];
  readingMinutes: number;
  seo: TravelStory['seo'];
  publishedAt: string | null;
  updatedAt: string;
}

export function toPublicStoryRecord(story: TravelStory): PublicStoryRecord {
  return {
    slug: story.slug,
    title: story.title,
    excerpt: story.excerpt,
    content: story.content,
    cover: story.cover,
    gallery: story.gallery,
    destinationSlug: story.destinationSlug,
    plannerTemplateSlug: story.plannerTemplateSlug ?? null,
    travelDates: story.travelDates,
    travelStyle: story.travelStyle,
    readingMinutes: story.readingMinutes,
    seo: story.seo,
    publishedAt: story.publishedAt,
    updatedAt: story.updatedAt,
  };
}
