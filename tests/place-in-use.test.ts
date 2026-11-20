import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture, reviewFixture, storyFixture, templateFixture } from './travel-content-helpers';

/**
 * CORE-9 / decision 11: `DELETE /api/admin/travel/places/[slug]` answers
 * 409 `place_in_use` while content or Planner data still names the place, with
 * counts only. Runs against the JSON stores; the same repository methods run on
 * PostgreSQL in the `*postgres*.integration.test.ts` suites.
 */
const TOKEN = 'test-admin-token-at-least-32-chars-long';
const BASE = 'http://localhost';
const ZERO = {
  stories: 0,
  collections: 0,
  templates: 0,
  contentReviews: 0,
  tripActivities: 0,
  communityReviews: 0,
};

let workdir: string;
let route: typeof import('../src/app/api/admin/travel/places/[slug]/route');
let content: Awaited<ReturnType<typeof import('../src/server/content/instance').getRepository>>;
let planner: Awaited<ReturnType<typeof import('../src/server/planner/instance').getPlannerRepository>>;
let n = 0;

const del = (slug: string) =>
  route.DELETE(
    new Request(`${BASE}/api/admin/travel/places/${slug}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${TOKEN}` },
    }),
    { params: Promise.resolve({ slug }) },
  );

const newPlace = async () => {
  const slug = `place-${++n}`;
  await content.createPlace(placeFixture({ slug }));
  return slug;
};

const collectionBody = (slug: string, placeSlugs: string[]) => ({
  slug,
  title: { vi: 'Bộ sưu tập', en: 'Collection' },
  tagline: { vi: 'Khẩu hiệu', en: 'Tagline' },
  description: { vi: ['Mô tả.'], en: ['Description.'] },
  cover: '/images/covers/da-lat.svg',
  destinationSlugs: ['da-lat'],
  storySlugs: [],
  placeSlugs,
  seo: {
    title: null,
    description: { vi: 'Mô tả SEO.', en: 'SEO description.' },
    ogImage: null,
    canonicalPath: null,
    noindex: false,
    keywords: { vi: [], en: [] },
  },
});

async function expectBlocked(slug: string, expected: Partial<typeof ZERO>) {
  const response = await del(slug);
  expect(response.status).toBe(409);
  const text = await response.text();
  const body = JSON.parse(text);
  expect(body.error.code).toBe('place_in_use');
  expect(body.error.details.counts).toEqual({ ...ZERO, ...expected });
  // The place is still there.
  expect((await content.getPlace(slug)).slug).toBe(slug);
  return text;
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'place-in-use-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.ADMIN_API_TOKEN = TOKEN;
  process.env.GUEST_KEY_SECRET = 'place-in-use-guest-secret-0123456789';
  route = await import('../src/app/api/admin/travel/places/[slug]/route');
  content = await (await import('../src/server/content/instance')).getRepository();
  planner = await (await import('../src/server/planner/instance')).getPlannerRepository();
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('DELETE place guards against references (place_in_use)', () => {
  it('deletes an unreferenced place with 204', async () => {
    const slug = await newPlace();
    expect((await del(slug)).status).toBe(204);
    await expect(content.getPlace(slug)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('answers 404 for an unknown place', async () => {
    expect((await del('no-such-place')).status).toBe(404);
  });

  it('blocks on a story', async () => {
    const slug = await newPlace();
    await content.createStory(storyFixture({ slug: `story-${slug}`, placeSlugs: [slug] }));
    await expectBlocked(slug, { stories: 1 });
  });

  it('blocks on a collection', async () => {
    const slug = await newPlace();
    await content.createCollection(collectionBody(`col-${slug}`, [slug]));
    await expectBlocked(slug, { collections: 1 });
  });

  it('blocks on a template', async () => {
    const slug = await newPlace();
    await content.createStory(storyFixture({ slug: `src-${slug}` }));
    const base = templateFixture({ slug: `tpl-${slug}`, sourceStorySlug: `src-${slug}` });
    await content.createTemplate({
      ...base,
      days: base.days.map((day, i) => ({
        ...day,
        activities: day.activities.map((a, j) => (i === 0 && j === 0 ? { ...a, placeSlug: slug } : a)),
      })),
    });
    await expectBlocked(slug, { templates: 1 });
  });

  it('blocks on an editorial review', async () => {
    const slug = await newPlace();
    await content.createReview(
      reviewFixture({ id: `rev-${slug}`, subject: { kind: 'place', ref: slug } }),
    );
    await expectBlocked(slug, { contentReviews: 1 });
  });

  it('blocks on trip activities, archived trips included, without leaking ids', async () => {
    const slug = await newPlace();
    const owner = await planner.createUser({ handle: `owner-${slug}`, displayName: 'Chủ chuyến' });
    const userId = owner.user.id;
    const first = await planner.createTrip(userId, daLatTripInput({ title: 'Chuyến bí mật A' }));
    const second = await planner.createTrip(userId, daLatTripInput({ title: 'Chuyến bí mật B' }));
    await planner.addActivity(userId, first.trip.id, activityInput({ placeSlug: slug }), null);
    const withTwo = await planner.addActivity(
      userId,
      second.trip.id,
      activityInput({ placeSlug: slug }),
      null,
    );
    await planner.archiveTrip(userId, second.trip.id, withTwo.trip.version);

    const text = await expectBlocked(slug, { tripActivities: 2 });
    for (const secret of [userId, first.trip.id, second.trip.id, `owner-${slug}`, 'Chuyến bí mật']) {
      expect(text).not.toContain(secret);
    }
  });

  it('blocks on community reviews of any status, without leaking ids', async () => {
    const slug = await newPlace();
    const owner = await planner.createUser({ handle: `rev-${slug}`, displayName: 'Người đánh giá' });
    const review = {
      rating: 5,
      body: 'Một địa điểm rất đáng ghé, cà phê ngon và yên tĩnh.',
      lang: 'vi' as const,
      visitedOn: '2026-02-01',
      authorDisplay: 'anonymous' as const,
    };
    await planner.upsertPlannerReview(owner.user.id, slug, review);
    await planner.createGuestReview({ placeSlug: slug, ...review, authorName: 'Khách', website: '' } as never, '203.0.113.7');

    // A removed review still names the place, so it still blocks.
    const queue = await planner.listReviewQueue('approved');
    const guest = queue.find((item) => item.placeSlug === slug && item.source === 'homepage');
    expect(guest).toBeDefined();
    await planner.decideReview(guest!.id, 'remove', 'admin', null);
    expect((await planner.listReviewQueue('removed')).some((item) => item.id === guest!.id)).toBe(true);

    const text = await expectBlocked(slug, { communityReviews: 2 });
    expect(text).not.toContain(owner.user.id);
    expect(text).not.toContain('rev_');
  });

  it('adds up several kinds in one 409', async () => {
    const slug = await newPlace();
    await content.createStory(storyFixture({ slug: `multi-${slug}`, placeSlugs: [slug] }));
    await content.createCollection(collectionBody(`multi-col-${slug}`, [slug]));
    const owner = await planner.createUser({ handle: `multi-${slug}`, displayName: 'Multi' });
    const trip = await planner.createTrip(owner.user.id, daLatTripInput());
    await planner.addActivity(owner.user.id, trip.trip.id, activityInput({ placeSlug: slug }), null);
    await expectBlocked(slug, { stories: 1, collections: 1, tripActivities: 1 });
  });

  it('fails closed when the Planner store cannot be read', async () => {
    const slug = await newPlace();
    const original = planner.countPlaceReferences.bind(planner);
    planner.countPlaceReferences = () => Promise.reject(new Error('connection refused: secret-host'));
    try {
      const response = await del(slug);
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text).error.code).toBe('service_unavailable');
      expect(text).not.toContain('secret-host');
    } finally {
      planner.countPlaceReferences = original;
    }
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('is token-only: no credentials means 401 and nothing is deleted', async () => {
    const slug = await newPlace();
    const response = await route.DELETE(new Request(`${BASE}/x`, { method: 'DELETE' }), {
      params: Promise.resolve({ slug }),
    });
    expect(response.status).toBe(401);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });
});
