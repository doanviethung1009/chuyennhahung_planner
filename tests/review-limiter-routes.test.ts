import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { termsVersion } from '../src/content/site';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/**
 * P10-13: the two review write limiters answer 429 + `Retry-After` over HTTP
 * (5/hour per Planner user, 3/hour per guest client, ADR 0014). Written against
 * the in-memory limiters first, so it also guards the move to the shared one.
 */
const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';

let workdir: string;
let plannerRoute: typeof import('../src/app/api/planner/reviews/[placeSlug]/route');
let guestRoute: typeof import('../src/app/api/community/reviews/route');
let planner: typeof import('../src/server/planner/instance');

const placeParams = (placeSlug: string) => ({ params: Promise.resolve({ placeSlug }) });

function plannerPut(cookie: string) {
  return new Request(`${ORIGIN}/api/planner/reviews/lim-place`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${cookie}`, origin: ORIGIN },
    body: JSON.stringify({ rating: 4, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' }),
  });
}

function guestPost(ip: string) {
  return new Request(`${ORIGIN}/api/community/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({
      placeSlug: 'lim-place',
      rating: 5,
      body: BODY,
      lang: 'vi',
      visitedOn: '2026-02-20',
      authorName: null,
    }),
  });
}

async function newSession(handle: string) {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle, displayName: 'Người dùng', role: 'member' });
  const session = await repo.signIn(issued.accessToken);
  await repo.acceptTerms(issued.user.id, termsVersion, 'vi'); // the write gate (batch 10.4)
  return { id: issued.user.id, cookie: session.token };
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'review-limiter-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  plannerRoute = await import('../src/app/api/planner/reviews/[placeSlug]/route');
  guestRoute = await import('../src/app/api/community/reviews/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'lim-place' }));
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('review write limiters over HTTP', () => {
  it('answers a Planner user\'s sixth review in an hour with 429 and Retry-After', async () => {
    const a = await newSession('lim-a');
    for (let i = 0; i < 5; i += 1) {
      expect((await plannerRoute.PUT(plannerPut(a.cookie), placeParams('lim-place'))).status).toBe(200);
    }
    const blocked = await plannerRoute.PUT(plannerPut(a.cookie), placeParams('lim-place'));
    expect(blocked.status).toBe(429);
    const retry = Number(blocked.headers.get('retry-after'));
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(3600);
    expect((await blocked.json()).error.code).toBe('rate_limited');

    // The bucket is per user: another account is untouched.
    const b = await newSession('lim-b');
    expect((await plannerRoute.PUT(plannerPut(b.cookie), placeParams('lim-place'))).status).toBe(200);
  });

  it('answers a guest\'s eleventh review in an hour with 429 and Retry-After, per client', async () => {
    // Real submissions, all for one place; the limiter sees every attempt.
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      statuses.push((await guestRoute.POST(guestPost('203.0.113.9'))).status);
    }
    expect(statuses.every((s) => s === 201)).toBe(true);

    const blocked = await guestRoute.POST(guestPost('203.0.113.9'));
    expect(blocked.status).toBe(429);
    const retry = Number(blocked.headers.get('retry-after'));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(3600);
    expect((await blocked.json()).error.code).toBe('rate_limited');

    expect((await guestRoute.POST(guestPost('203.0.113.10'))).status).toBe(201);
  });
});
