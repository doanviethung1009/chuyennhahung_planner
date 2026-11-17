import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { termsVersion } from '../src/content/site';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
let workdir: string;
let terms: typeof import('../src/app/api/planner/terms/route');
let review: typeof import('../src/app/api/planner/reviews/[placeSlug]/route');
let listing: typeof import('../src/app/api/planner/[id]/listing/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;

async function newSession() {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `terms-r-${(n += 1)}`, displayName: 'Người dùng', role: 'member' });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}
const headers = (cookie: string, origin: string | null = ORIGIN) => ({
  'content-type': 'application/json',
  cookie: `${SESSION_COOKIE}=${cookie}`,
  ...(origin ? { origin } : {}),
});
const postTerms = (cookie: string, body: unknown, origin: string | null = ORIGIN) =>
  terms.POST(new Request(`${ORIGIN}/api/planner/terms`, { method: 'POST', headers: headers(cookie, origin), body: JSON.stringify(body) }));
const getTerms = (cookie: string) => terms.GET(new Request(`${ORIGIN}/api/planner/terms`, { headers: headers(cookie) }));
const putReview = (cookie: string) =>
  review.PUT(
    new Request(`${ORIGIN}/api/planner/reviews/tr-place`, {
      method: 'PUT',
      headers: headers(cookie),
      body: JSON.stringify({ rating: 4, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' }),
    }),
    { params: Promise.resolve({ placeSlug: 'tr-place' }) },
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'terms-routes-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  terms = await import('../src/app/api/planner/terms/route');
  review = await import('../src/app/api/planner/reviews/[placeSlug]/route');
  listing = await import('../src/app/api/planner/[id]/listing/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'tr-place' }));
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('/api/planner/terms and the community-write gate (ADR 0019 §4)', () => {
  it('reports the status, accepts the current version, and is idempotent', async () => {
    const u = await newSession();
    expect(await (await getTerms(u.cookie)).json()).toMatchObject({ version: termsVersion, accepted: false });
    const first = await postTerms(u.cookie, { version: termsVersion, lang: 'en' });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ accepted: true, version: termsVersion });
    expect((await postTerms(u.cookie, { version: termsVersion })).status).toBe(200);
    expect(await (await getTerms(u.cookie)).json()).toMatchObject({ accepted: true });
    const events = (await (await planner.getPlannerRepository()).listEvents(u.id)).filter((e) => e.action === 'terms_accepted');
    expect(events).toHaveLength(1);
  });

  it('refuses anonymous, cross-origin, a stale version and a userId in the body', async () => {
    const u = await newSession();
    const anon = await terms.POST(new Request(`${ORIGIN}/api/planner/terms`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ version: termsVersion }) }));
    expect(anon.status).toBe(401);
    expect((await postTerms(u.cookie, { version: termsVersion }, 'https://evil.test')).status).toBe(403);
    expect((await postTerms(u.cookie, { version: termsVersion }, null)).status).toBe(403);
    expect((await postTerms(u.cookie, { version: '1999-01-01' })).status).toBe(400);
    expect((await postTerms(u.cookie, { version: termsVersion, userId: 'usr_other' })).status).toBe(422);
    expect(await (await getTerms(u.cookie)).json()).toMatchObject({ accepted: false });
  });

  it('refuses a review write with 403 terms_not_accepted, then allows it after acceptance', async () => {
    const u = await newSession();
    const blocked = await putReview(u.cookie);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toMatchObject({ code: 'forbidden', reason: 'terms_not_accepted' });
    expect((await (await planner.getPlannerRepository()).listReviewQueue()).filter((r) => r.placeSlug === 'tr-place')).toEqual([]);
    await postTerms(u.cookie, { version: termsVersion });
    expect((await putReview(u.cookie)).status).toBe(200);
    // Deleting one's own review is never gated.
    const del = await review.DELETE(
      new Request(`${ORIGIN}/api/planner/reviews/tr-place`, { method: 'DELETE', headers: headers(u.cookie) }),
      { params: Promise.resolve({ placeSlug: 'tr-place' }) },
    );
    expect(del.status).toBe(200);
  });

  it('refuses a listing request with 403 terms_not_accepted, but never blocks withdrawing', async () => {
    const u = await newSession();
    const repo = await planner.getPlannerRepository();
    const view = await repo.createTrip(u.id, daLatTripInput());
    await repo.addActivity(u.id, view.trip.id, activityInput(), null);
    await repo.setVisibility(u.id, view.trip.id, 'public');
    const ctx = { params: Promise.resolve({ id: view.trip.id }) };
    const put = () => listing.PUT(new Request(`${ORIGIN}/api/planner/${view.trip.id}/listing`, { method: 'PUT', headers: headers(u.cookie), body: JSON.stringify({ authorDisplay: 'name' }) }), ctx);
    const blocked = await put();
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.reason).toBe('terms_not_accepted');
    const withdraw = await listing.DELETE(new Request(`${ORIGIN}/api/planner/${view.trip.id}/listing`, { method: 'DELETE', headers: headers(u.cookie) }), ctx);
    expect(withdraw.status).toBe(200);
    await postTerms(u.cookie, { version: termsVersion });
    expect((await put()).status).toBe(200);
  });
});
