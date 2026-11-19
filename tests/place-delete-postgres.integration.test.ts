import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPostgresPool } from '../src/server/persistence/postgres-pool';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture, storyFixture } from './travel-content-helpers';

// The Planner is not under test for hashing; keep any user creation cheap.
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/**
 * CORE-10: `DELETE /api/admin/travel/places/[slug]` on real PostgreSQL stores for
 * both Travel Content and the Planner (ADR 0009, 0013, 0028). Runs only when
 * `TEST_DATABASE_URL` is set; without it the file is skipped and the result must
 * be reported as NOT RUN. Everything lives in a throwaway schema (via PGOPTIONS,
 * which the instances' pools inherit) that is dropped at the end.
 */
const url = process.env.TEST_DATABASE_URL;
const TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

describe.skipIf(!url)('DELETE place on PostgreSQL (TEST_DATABASE_URL)', () => {
  const schema = `pgdel_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  let route: typeof import('../src/app/api/admin/travel/places/[slug]/route');
  let content: Awaited<ReturnType<typeof import('../src/server/content/instance').getRepository>>;
  let planner: Awaited<ReturnType<typeof import('../src/server/planner/instance').getPlannerRepository>>;
  let n = 0;
  const previousPgOptions = process.env.PGOPTIONS;

  const del = (slug: string) =>
    route.DELETE(
      new Request(`${ORIGIN}/api/admin/travel/places/${slug}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
      { params: Promise.resolve({ slug }) },
    );
  const newPlace = async () => {
    const slug = `pg-place-${++n}`;
    await content.createPlace(placeFixture({ slug }));
    return slug;
  };

  beforeAll(async () => {
    admin = createPostgresPool(url!, { max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    process.env.PGOPTIONS = `-c search_path=${schema}`;
    process.env.CONTENT_DATABASE_URL = url!;
    process.env.PLANNER_DATABASE_URL = url!;
    process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
    process.env.ADMIN_API_TOKEN = TOKEN;
    process.env.GUEST_KEY_SECRET = 'place-delete-pg-guest-secret-0123456789';
    route = await import('../src/app/api/admin/travel/places/[slug]/route');
    content = await (await import('../src/server/content/instance')).getRepository();
    planner = await (await import('../src/server/planner/instance')).getPlannerRepository();
  });

  afterAll(async () => {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    if (previousPgOptions === undefined) delete process.env.PGOPTIONS;
    else process.env.PGOPTIONS = previousPgOptions;
  });

  it('deletes an unreferenced place (204) and then answers 404', async () => {
    const slug = await newPlace();
    expect((await del(slug)).status).toBe(204);
    await expect(content.getPlace(slug)).rejects.toMatchObject({ code: 'not_found' });
    expect((await del(slug)).status).toBe(404);
  });

  it('answers 409 with content counts and keeps the place', async () => {
    const slug = await newPlace();
    await content.createStory(storyFixture({ slug: `story-${slug}`, placeSlugs: [slug] }));
    const response = await del(slug);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('place_in_use');
    expect(body.error.details.counts).toMatchObject({ stories: 1, tripActivities: 0, communityReviews: 0 });
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('answers 409 for Planner trip activities and community reviews, then 204 once they are gone', async () => {
    const slug = await newPlace();
    const owner = await planner.createUser({ handle: `pgdel-${slug}`, displayName: 'Chủ chuyến' });
    const trip = await planner.createTrip(owner.user.id, daLatTripInput());
    const withActivity = await planner.addActivity(owner.user.id, trip.trip.id, activityInput({ placeSlug: slug }), null);
    await planner.upsertPlannerReview(owner.user.id, slug, {
      rating: 5,
      body: 'Quán rất đẹp vào buổi sáng, đồ uống ngon, không gian yên tĩnh, đi bộ quanh khu vườn mất khoảng một tiếng và nên ghé lại lần nữa.',
      lang: 'vi',
      visitedOn: '2026-02-01',
      authorDisplay: 'name',
    });

    const blocked = await del(slug);
    const text = await blocked.text();
    expect(blocked.status, text).toBe(409);
    expect(JSON.parse(text).error.details.counts).toMatchObject({ tripActivities: 1, communityReviews: 1 });
    expect(text).not.toContain(owner.user.id);

    // Remove the activity and the review: the place is free again.
    const activityId = withActivity.days.flatMap((d) => d.activities).find((a) => a.placeSlug === slug)!.id;
    await planner.deleteActivity(owner.user.id, trip.trip.id, activityId, withActivity.trip.version);
    await planner.deleteOwnReview(owner.user.id, slug);
    expect((await del(slug)).status).toBe(204);
  });

  it('fails closed with 503 when the Planner store cannot be read, and deletes nothing', async () => {
    const slug = await newPlace();
    // The store caches by revision: move it so the next read goes to the database.
    await admin.query(`UPDATE ${schema}.planner_revision SET revision = revision + 1`);
    await admin.query(`ALTER TABLE ${schema}.trip_activities RENAME TO trip_activities_off`);
    try {
      const response = await del(slug);
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('service_unavailable');
    } finally {
      await admin.query(`ALTER TABLE ${schema}.trip_activities_off RENAME TO trip_activities`);
    }
    expect((await content.getPlace(slug)).slug).toBe(slug);
    expect((await del(slug)).status).toBe(204);
  });
});
