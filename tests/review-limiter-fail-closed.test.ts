import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentError } from '../src/server/content/errors';
import { termsVersion } from '../src/content/site';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

// The limiter's database is down; the Planner store itself is fine, so a
// review that slipped through would really be written.
const down = vi.hoisted(() => ({ on: true }));
vi.mock('../src/server/planner/instance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/server/planner/instance')>();
  const failing = {
    check: async () => {
      throw new ContentError('service_unavailable', 'the rate limiter database is unavailable');
    },
  };
  return {
    ...actual,
    getWriteLimiters: async () =>
      down.on ? { plannerReview: failing, guestReview: failing } : actual.getWriteLimiters(),
  };
});

/** The limiter database failing must stop the write: 503, and nothing stored (fail closed). */
const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
let workdir: string;

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'review-failclosed-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'fc-place' }));
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('review routes fail closed when the limiter database is down', () => {
  it('Planner review: 503 service_unavailable and nothing written', async () => {
    const planner = await import('../src/server/planner/instance');
    const repo = await planner.getPlannerRepository();
    const issued = await repo.createUser({ handle: 'fc-user', displayName: 'Người dùng', role: 'member' });
    const session = await repo.signIn(issued.accessToken);
    await repo.acceptTerms(issued.user.id, termsVersion, 'vi'); // the write gate (batch 10.4)
    const route = await import('../src/app/api/planner/reviews/[placeSlug]/route');
    const response = await route.PUT(
      new Request(`${ORIGIN}/api/planner/reviews/fc-place`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${session.token}`, origin: ORIGIN },
        body: JSON.stringify({ rating: 4, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' }),
      }),
      { params: Promise.resolve({ placeSlug: 'fc-place' }) },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('service_unavailable');
    expect(await repo.listReviewQueue()).toEqual([]);
  });

  it('guest review: 503 service_unavailable and nothing written', async () => {
    const planner = await import('../src/server/planner/instance');
    const route = await import('../src/app/api/community/reviews/route');
    const response = await route.POST(
      new Request(`${ORIGIN}/api/community/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
        body: JSON.stringify({ placeSlug: 'fc-place', rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorName: null }),
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('service_unavailable');
    expect(await (await planner.getPlannerRepository()).listReviewQueue()).toEqual([]);
  });
});
