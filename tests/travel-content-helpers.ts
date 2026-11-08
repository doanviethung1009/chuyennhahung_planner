import { TravelContentRepository } from '../src/server/content/repository';
import { createMemoryStore } from '../src/server/content/store';
import type {
  PlaceCreateInput,
  ReviewCreateInput,
  StoryCreateInput,
  TemplateCreateInput,
} from '../src/server/content/schemas';

/**
 * A repository on an isolated in-memory store with a frozen clock and counted
 * activity ids, so assertions can name exact timestamps and ids.
 */
export function makeRepository(): TravelContentRepository {
  let counter = 0;
  return new TravelContentRepository({
    store: createMemoryStore(),
    now: () => new Date('2026-03-01T08:00:00.000Z'),
    newId: () => `act_${++counter}`,
  });
}

export const bilingual = (vi: string, en: string) => ({ vi, en });

export function placeFixture(
  overrides: Partial<PlaceCreateInput> = {},
): PlaceCreateInput {
  return {
    slug: 'test-place',
    name: bilingual('Địa điểm thử', 'Test place'),
    destinationSlug: 'da-lat',
    location: bilingual('Trung tâm Đà Lạt', 'Central Đà Lạt'),
    coords: { lat: 11.94, lng: 108.44 },
    category: 'cafe',
    images: [],
    description: { vi: ['Một đoạn mô tả.'], en: ['A line of description.'] },
    suggestedMinutes: 60,
    estimatedCostVnd: 50_000,
    rating: 4,
    personalNote: null,
    affiliateLinks: [],
    ...overrides,
  };
}

export function storyFixture(
  overrides: Partial<StoryCreateInput> = {},
): StoryCreateInput {
  return {
    slug: 'test-story',
    title: bilingual('Chuyện thử', 'Test story'),
    excerpt: bilingual('Một đoạn dẫn.', 'A short lead.'),
    content: [{ type: 'paragraph', text: bilingual('Một đoạn.', 'A paragraph.') }],
    cover: '/images/covers/story-da-lat.svg',
    gallery: [],
    destinationSlug: 'da-lat',
    travelDates: { start: '2026-02-13', end: '2026-02-15' },
    actualCost: null,
    placeSlugs: [],
    reviewIds: [],
    itinerarySlugs: [],
    travelStyle: 'romantic',
    readingMinutes: 5,
    seo: {
      title: null,
      description: bilingual('Mô tả SEO.', 'SEO description.'),
      ogImage: null,
      canonicalPath: null,
      noindex: false,
      keywords: { vi: [], en: [] },
    },
    ...overrides,
  };
}

export function reviewFixture(
  overrides: Partial<ReviewCreateInput> = {},
): ReviewCreateInput {
  return {
    id: 'test-review',
    subject: { kind: 'destination', ref: 'da-lat' },
    title: bilingual('Đánh giá thử', 'Test review'),
    rating: 4.5,
    body: { vi: ['Nội dung đánh giá.'], en: ['Review body.'] },
    pros: { vi: [], en: [] },
    cons: { vi: [], en: [] },
    visitedOn: '2026-02-14',
    costVnd: null,
    author: 'Nhà Hưng',
    ...overrides,
  };
}

export function templateFixture(
  overrides: Partial<TemplateCreateInput> = {},
): TemplateCreateInput {
  return {
    slug: 'test-template',
    sourceStorySlug: 'test-story',
    title: bilingual('Mẫu thử', 'Test template'),
    summary: bilingual('Tóm tắt mẫu.', 'Template summary.'),
    travelStyle: 'romantic',
    pace: 'relaxed',
    groupSize: bilingual('2 người', '2 people'),
    itinerarySlugs: [],
    visibility: 'private',
    days: [
      {
        title: bilingual('Ngày một', 'Day one'),
        summary: null,
        activities: [
          {
            title: bilingual('Việc A', 'Activity A'),
            placeSlug: null,
            startTime: '08:00',
            durationMinutes: 60,
            estimatedCostVnd: 100_000,
            note: null,
          },
          {
            title: bilingual('Việc B', 'Activity B'),
            placeSlug: null,
            startTime: '10:00',
            durationMinutes: 60,
            estimatedCostVnd: 200_000,
            note: null,
          },
        ],
      },
      {
        title: bilingual('Ngày hai', 'Day two'),
        summary: null,
        activities: [
          {
            title: bilingual('Việc C', 'Activity C'),
            placeSlug: null,
            startTime: '09:00',
            durationMinutes: 90,
            estimatedCostVnd: 300_000,
            note: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}
