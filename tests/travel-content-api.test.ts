import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { placeFixture, reviewFixture, storyFixture } from './travel-content-helpers';

/**
 * Exercises the real route handlers against a temp JSON file store, so the
 * authorization wrapper, the zod boundary and the error→status mapping are all
 * covered by the same path a request takes in production.
 */
const TOKEN = 'test-admin-token-at-least-32-chars-long';
const BASE = 'https://example.test';

let workdir: string;
let routes: {
  adminPlaces: typeof import('../src/app/api/admin/travel/places/route');
  adminPlace: typeof import('../src/app/api/admin/travel/places/[slug]/route');
  adminPlaceStatus: typeof import('../src/app/api/admin/travel/places/[slug]/status/route');
  publicPlace: typeof import('../src/app/api/travel/places/[slug]/route');
  publicPlaces: typeof import('../src/app/api/travel/places/route');
  adminStories: typeof import('../src/app/api/admin/travel/stories/route');
  adminStoryStatus: typeof import('../src/app/api/admin/travel/stories/[slug]/status/route');
  adminStoryPlaces: typeof import('../src/app/api/admin/travel/stories/[slug]/places/route');
  adminTemplates: typeof import('../src/app/api/admin/travel/templates/route');
  adminReorder: typeof import('../src/app/api/admin/travel/templates/[slug]/reorder/route');
  integrity: typeof import('../src/app/api/admin/travel/integrity/route');
  publicStories: typeof import('../src/app/api/travel/stories/route');
  publicStory: typeof import('../src/app/api/travel/stories/[slug]/route');
  publicTemplates: typeof import('../src/app/api/travel/templates/route');
  adminReviews: typeof import('../src/app/api/admin/travel/reviews/route');
  adminReviewStatus: typeof import('../src/app/api/admin/travel/reviews/[id]/status/route');
  publicReviews: typeof import('../src/app/api/travel/reviews/route');
};

function authed(body?: unknown, method = 'POST'): Request {
  return new Request(`${BASE}/api/admin/travel`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** The record's current `updatedAt`, read from the same JSON store the routes write (If-Match is required, S-6). */
async function stampOf(kind: 'place' | 'story' | 'template', slug: string): Promise<string> {
  const { TravelContentRepository } = await import('../src/server/content/repository');
  const { createJsonFileStore } = await import('../src/server/content/store');
  const reader = new TravelContentRepository({ store: createJsonFileStore(join(workdir, 'content.json')) });
  const record =
    kind === 'place'
      ? await reader.getPlace(slug)
      : kind === 'story'
        ? await reader.getStory(slug)
        : await reader.getTemplate(slug);
  return record.updatedAt;
}

function withMatch(request: Request, stamp: string): Request {
  request.headers.set('if-match', `"${stamp}"`);
  return request;
}

function anon(method = 'GET'): Request {
  return new Request(`${BASE}/api/admin/travel`, { method });
}

const params = <T extends Record<string, string>>(value: T) => ({
  params: Promise.resolve(value),
});

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'travel-content-api-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  // The seed is asserted separately; these tests build their own fixtures.
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.ADMIN_API_TOKEN = TOKEN;

  routes = {
    adminPlaces: await import('../src/app/api/admin/travel/places/route'),
    adminPlace: await import('../src/app/api/admin/travel/places/[slug]/route'),
    adminPlaceStatus: await import('../src/app/api/admin/travel/places/[slug]/status/route'),
    publicPlace: await import('../src/app/api/travel/places/[slug]/route'),
    publicPlaces: await import('../src/app/api/travel/places/route'),
    adminStories: await import('../src/app/api/admin/travel/stories/route'),
    adminStoryStatus: await import('../src/app/api/admin/travel/stories/[slug]/status/route'),
    adminStoryPlaces: await import('../src/app/api/admin/travel/stories/[slug]/places/route'),
    adminTemplates: await import('../src/app/api/admin/travel/templates/route'),
    adminReorder: await import('../src/app/api/admin/travel/templates/[slug]/reorder/route'),
    integrity: await import('../src/app/api/admin/travel/integrity/route'),
    publicStories: await import('../src/app/api/travel/stories/route'),
    publicStory: await import('../src/app/api/travel/stories/[slug]/route'),
    publicTemplates: await import('../src/app/api/travel/templates/route'),
    adminReviews: await import('../src/app/api/admin/travel/reviews/route'),
    adminReviewStatus: await import('../src/app/api/admin/travel/reviews/[id]/status/route'),
    publicReviews: await import('../src/app/api/travel/reviews/route'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('admin routes require authorization', () => {
  it('rejects an unauthenticated list with 401', async () => {
    const response = await routes.adminPlaces.GET(anon());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('unauthorized');
  });

  it('rejects an unauthenticated create with 401 and writes nothing', async () => {
    const create = new Request(`${BASE}/api/admin/travel/places`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(placeFixture({ slug: 'should-not-exist' })),
    });
    expect((await routes.adminPlaces.POST(create)).status).toBe(401);

    const listed = await routes.adminPlaces.GET(authed(undefined, 'GET'));
    const body = await listed.json();
    expect(body.places.some((p: { slug: string }) => p.slug === 'should-not-exist')).toBe(
      false,
    );
  });

  it('never caches an admin response', async () => {
    const response = await routes.adminPlaces.GET(authed(undefined, 'GET'));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('admin place CRUD over HTTP', () => {
  it('creates with 201 and returns the stored record', async () => {
    const response = await routes.adminPlaces.POST(
      authed(placeFixture({ slug: 'ho-tuyen-lam' })),
    );
    expect(response.status).toBe(201);
    const place = await response.json();
    expect(place.slug).toBe('ho-tuyen-lam');
    expect(place.createdAt).toBeTruthy();
    // ADR 0035: a place authored through the CMS starts as a draft.
    expect(place.status).toBe('draft');
    expect(place.publishedAt).toBeNull();
  });

  it('keeps a draft place off the public API until it is published', async () => {
    expect((await routes.publicPlace.GET(new Request(`${BASE}/api/travel/places/ho-tuyen-lam`), params({ slug: 'ho-tuyen-lam' }))).status).toBe(404);
    const listed = await (await routes.publicPlaces.GET(new Request(`${BASE}/api/travel/places?status=draft`))).json();
    expect(listed.places.map((p: { slug: string }) => p.slug)).not.toContain('ho-tuyen-lam');

    const published = await routes.adminPlaceStatus.POST(authed({ action: 'publish' }), params({ slug: 'ho-tuyen-lam' }));
    expect(published.status).toBe(200);
    expect((await published.json()).status).toBe('published');
    expect((await routes.publicPlace.GET(new Request(`${BASE}/api/travel/places/ho-tuyen-lam`), params({ slug: 'ho-tuyen-lam' }))).status).toBe(200);
  });

  it('returns 409 on a duplicate slug', async () => {
    const response = await routes.adminPlaces.POST(
      authed(placeFixture({ slug: 'ho-tuyen-lam' })),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('slug_conflict');
  });

  it('returns 422 with field paths when the body fails validation', async () => {
    const response = await routes.adminPlaces.POST(
      authed({ ...placeFixture({ slug: 'bad-place' }), estimatedCostVnd: 12.5, rating: 9 }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['estimatedCostVnd', 'rating']),
    );
  });

  it('returns 422 when a reference does not resolve', async () => {
    const response = await routes.adminPlaces.POST(
      authed(placeFixture({ slug: 'nowhere-place', destinationSlug: 'atlantis' })),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('invalid_reference');
  });

  it('returns 400 on a malformed JSON body', async () => {
    const request = new Request(`${BASE}/api/admin/travel/places`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: '{ not json',
    });
    const response = await routes.adminPlaces.POST(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('bad_request');
  });

  it('patches and returns 404 for an unknown slug', async () => {
    const patched = await routes.adminPlace.PATCH(
      withMatch(authed({ estimatedCostVnd: 95_000 }, 'PATCH'), await stampOf('place', 'ho-tuyen-lam')),
      params({ slug: 'ho-tuyen-lam' }),
    );
    expect((await patched.json()).estimatedCostVnd).toBe(95_000);

    const missing = await routes.adminPlace.PATCH(
      withMatch(authed({ estimatedCostVnd: 1 }, 'PATCH'), 'any'),
      params({ slug: 'ghost' }),
    );
    expect(missing.status).toBe(404);
  });

  it('deletes with 204', async () => {
    await routes.adminPlaces.POST(authed(placeFixture({ slug: 'temporary-place' })));
    const response = await routes.adminPlace.DELETE(
      authed(undefined, 'DELETE'),
      params({ slug: 'temporary-place' }),
    );
    expect(response.status).toBe(204);
  });
});

describe('story publishing and the public read path', () => {
  const slug = 'api-da-lat-story';

  it('creates a story as a draft', async () => {
    const response = await routes.adminStories.POST(
      authed(storyFixture({ slug, placeSlugs: ['ho-tuyen-lam'] })),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).status).toBe('draft');
  });

  it('hides the draft from the public endpoints', async () => {
    const detail = await routes.publicStory.GET(
      new Request(`${BASE}/api/travel/stories/${slug}`),
      params({ slug }),
    );
    expect(detail.status).toBe(404);

    const list = await routes.publicStories.GET(
      new Request(`${BASE}/api/travel/stories`),
    );
    const body = await list.json();
    expect(body.stories.some((s: { slug: string }) => s.slug === slug)).toBe(false);
  });

  it('publishes, and then serves it publicly', async () => {
    const published = await routes.adminStoryStatus.POST(
      authed({ action: 'publish' }),
      params({ slug }),
    );
    expect((await published.json()).status).toBe('published');

    const detail = await routes.publicStory.GET(
      new Request(`${BASE}/api/travel/stories/${slug}`),
      params({ slug }),
    );
    expect(detail.status).toBe(200);
    expect((await detail.json()).slug).toBe(slug);
  });

  it('serves the public story as an allow-list, with no cost, status or reference lists', async () => {
    const costSlug = 'api-cost-story';
    await routes.adminStories.POST(
      authed(
        storyFixture({
          slug: costSlug,
          actualCost: {
            partySize: 2,
            currency: 'VND',
            breakdown: [{ category: 'stay', label: { vi: 'Khách sạn', en: 'Hotel' }, amountVnd: 987654 }],
            note: null,
          },
        }),
      ),
    );
    await routes.adminStoryStatus.POST(authed({ action: 'publish' }), params({ slug: costSlug }));
    const keys = [
      'content', 'cover', 'destinationSlug', 'excerpt', 'gallery', 'plannerTemplateSlug', 'publishedAt',
      'readingMinutes', 'seo', 'slug', 'title', 'travelDates', 'travelStyle', 'updatedAt',
    ];

    const detail = await routes.publicStory.GET(
      new Request(`${BASE}/api/travel/stories/${costSlug}`),
      params({ slug: costSlug }),
    );
    const detailBody = await detail.json();
    expect(Object.keys(detailBody).sort()).toEqual(keys);

    const list = await routes.publicStories.GET(new Request(`${BASE}/api/travel/stories`));
    const listed = (await list.json()).stories.find((x: { slug: string }) => x.slug === costSlug);
    expect(Object.keys(listed).sort()).toEqual(keys);
    expect(JSON.stringify([detailBody, listed])).not.toMatch(
      /actualCost|"status"|createdAt|placeSlugs|reviewIds|itinerarySlugs|987654/,
    );
  });

  it('rejects an unknown publish action with 422', async () => {
    const response = await routes.adminStoryStatus.POST(
      authed({ action: 'delete-everything' }),
      params({ slug }),
    );
    expect(response.status).toBe(422);
  });

  it('adds a place to the story through the dedicated endpoint', async () => {
    await routes.adminPlaces.POST(authed(placeFixture({ slug: 'doi-che-cau-dat' })));
    const response = await routes.adminStoryPlaces.PATCH(
      withMatch(authed({ add: ['doi-che-cau-dat'], remove: [] }, 'PATCH'), await stampOf('story', slug)),
      params({ slug }),
    );
    expect((await response.json()).placeSlugs).toEqual([
      'ho-tuyen-lam',
      'doi-che-cau-dat',
    ]);
  });

  it('refuses to delete the published story with 409', async () => {
    const adminStory = await import('../src/app/api/admin/travel/stories/[slug]/route');
    const response = await adminStory.DELETE(
      authed(undefined, 'DELETE'),
      params({ slug }),
    );
    expect(response.status).toBe(409);
  });
});

describe('template creation and activity reordering over HTTP', () => {
  const slug = 'api-da-lat-template';

  it('creates a public template from the published story', async () => {
    const response = await routes.adminTemplates.POST(
      authed({
        slug,
        sourceStorySlug: 'api-da-lat-story',
        title: { vi: 'Mẫu Đà Lạt', en: 'Đà Lạt template' },
        summary: { vi: 'Tóm tắt.', en: 'Summary.' },
        travelStyle: 'romantic',
        pace: 'relaxed',
        groupSize: { vi: '2 người', en: '2 people' },
        itinerarySlugs: ['da-lat-3-ngay-nghi-that'],
        visibility: 'public',
        days: [
          {
            title: { vi: 'Ngày 1', en: 'Day 1' },
            summary: null,
            activities: [
              {
                title: { vi: 'Hồ Tuyền Lâm', en: 'Tuyền Lâm Lake' },
                placeSlug: 'ho-tuyen-lam',
                startTime: '15:30',
                durationMinutes: 150,
                estimatedCostVnd: 160_000,
                note: null,
              },
              {
                title: { vi: 'Đồi chè', en: 'Tea hills' },
                placeSlug: 'doi-che-cau-dat',
                startTime: '06:00',
                durationMinutes: 120,
                estimatedCostVnd: 100_000,
                note: null,
              },
            ],
          },
        ],
      }),
    );
    expect(response.status).toBe(201);
    const template = await response.json();
    expect(template.version).toBe(1);
    expect(template.durationDays).toBe(1);
    expect(template.estimatedTotalVnd).toBe(260_000);
  });

  it('reorders the activities and bumps the version', async () => {
    const before = await routes.publicTemplates.GET(
      new Request(`${BASE}/api/travel/templates`),
    );
    const listed = await before.json();
    const template = listed.templates.find((t: { slug: string }) => t.slug === slug);
    expect(template).toBeDefined();

    const ids = template.days[0].activities.map((a: { id: string }) => a.id);
    const response = await routes.adminReorder.POST(
      withMatch(authed({ day: 1, activityIds: [ids[1], ids[0]] }), await stampOf('template', slug)),
      params({ slug }),
    );
    expect(response.status).toBe(200);
    const reordered = await response.json();
    expect(reordered.days[0].activities.map((a: { id: string }) => a.id)).toEqual([
      ids[1],
      ids[0],
    ]);
    expect(reordered.version).toBe(2);
  });

  it('rejects a reorder that is not a permutation with 409', async () => {
    const response = await routes.adminReorder.POST(
      withMatch(authed({ day: 1, activityIds: ['act_nope'] }), await stampOf('template', slug)),
      params({ slug }),
    );
    expect(response.status).toBe(409);
  });
});

describe('integrity endpoint', () => {
  it('reports a clean store', async () => {
    const response = await routes.integrity.GET(authed(undefined, 'GET'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.issues).toEqual([]);
    expect(body.ok).toBe(true);
  });

  it('requires authorization', async () => {
    expect((await routes.integrity.GET(anon())).status).toBe(401);
  });
});

describe('persistence survives a fresh repository', () => {
  it('reads records written by an earlier instance from disk', async () => {
    const { TravelContentRepository } = await import('../src/server/content/repository');
    const { createJsonFileStore } = await import('../src/server/content/store');

    const fresh = new TravelContentRepository({
      store: createJsonFileStore(join(workdir, 'content.json')),
    });
    const story = await fresh.getStory('api-da-lat-story');
    expect(story.status).toBe('published');
    expect((await fresh.getTemplate('api-da-lat-template')).version).toBe(2);
  });
});

describe('GET /api/travel/reviews is an allow-list (REVIEWS-API-PROJ)', () => {
  it('serves only the allowed fields of published reviews, never a draft', async () => {
    await routes.adminReviews.POST(authed(reviewFixture({ id: 'api-review-live', costVnd: 876543, author: 'Chuyện Nhà Hưng' })));
    await routes.adminReviewStatus.POST(authed({ action: 'publish' }), params({ id: 'api-review-live' }));
    await routes.adminReviews.POST(authed(reviewFixture({ id: 'api-review-draft' })));

    const keys = ['body', 'cons', 'id', 'pros', 'rating', 'title', 'visitedOn'];
    for (const query of ['', '?status=draft']) {
      const response = await routes.publicReviews.GET(new Request(`${BASE}/api/travel/reviews${query}`));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.reviews.map((r: { id: string }) => r.id)).toEqual(['api-review-live']);
      expect(Object.keys(body.reviews[0]).sort()).toEqual(keys);
      expect(JSON.stringify(body)).not.toMatch(
        /"(status|publishedAt|createdAt|updatedAt|subject|costVnd|author)"|876543/,
      );
    }
  });
});
