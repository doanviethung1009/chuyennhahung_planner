import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
let workdir: string;
let publicRoute: typeof import('../src/app/api/community/reports/route');
let listRoute: typeof import('../src/app/api/admin/community/reports/route');
let resolveRoute: typeof import('../src/app/api/admin/community/reports/[id]/resolve/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;
let token: string;
let reviewId: string;

async function makeUser(role: 'member' | 'editor') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `rr-${role}-${(n += 1)}`, displayName: 'Người dùng', role });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}
const post = (body: unknown, o: { ip?: string; cookie?: string; site?: string; origin?: string } = {}) =>
  publicRoute.POST(
    new Request(`${ORIGIN}/api/community/reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': o.ip ?? '203.0.113.10',
        ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
        ...(o.site ? { 'sec-fetch-site': o.site } : {}),
        ...(o.origin ? { origin: o.origin } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
const auth = (o: { bearer?: string; cookie?: string }) => ({
  ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
  ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
});
const list = (query = '', o: { bearer?: string; cookie?: string } = {}) =>
  listRoute.GET(new Request(`${ORIGIN}/api/admin/community/reports${query}`, { headers: auth(o) }));
const resolve = (id: string, body: unknown, o: { bearer?: string; cookie?: string }) =>
  resolveRoute.POST(
    new Request(`${ORIGIN}/api/admin/community/reports/${id}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...auth(o) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'reports-routes-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  publicRoute = await import('../src/app/api/community/reports/route');
  listRoute = await import('../src/app/api/admin/community/reports/route');
  resolveRoute = await import('../src/app/api/admin/community/reports/[id]/resolve/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'rr-place' }));
  const repo = await planner.getPlannerRepository();
  const owner = (await makeUser('member')).id;
  const view = await repo.createTrip(owner, daLatTripInput());
  await repo.addActivity(owner, view.trip.id, activityInput(), null);
  await repo.setVisibility(owner, view.trip.id, 'public');
  await repo.requestListing(owner, view.trip.id, 'name');
  await repo.decideListing(view.trip.id, 'approve', 'staff', null);
  token = (await repo.getTrip(owner, view.trip.id)).trip.shareToken!;
  await repo.createGuestReview({ placeSlug: 'rr-place', rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorName: null }, '198.51.100.77');
  reviewId = (await repo.listApprovedReviews()).items[0]!.id;
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('POST /api/community/reports', () => {
  it('201 for a guest and a member, no-store, dedupes with the same answer', async () => {
    const a = await post({ targetKind: 'trip', shareToken: token, reason: 'spam' }, { ip: '203.0.113.21' });
    expect(a.status).toBe(201);
    expect(a.headers.get('cache-control')).toBe('no-store');
    expect(await a.json()).toEqual({ ok: true });
    const again = await post({ targetKind: 'trip', shareToken: token, reason: 'spam' }, { ip: '203.0.113.21' });
    expect(again.status).toBe(201);
    const member = await makeUser('member');
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'harassment', note: 'lời lẽ khó chịu' }, { cookie: member.cookie, site: 'same-origin' })).status).toBe(201);
    const rows = (await (await planner.getPlannerRepository()).listReports('open')).filter((r) => r.createdAt);
    expect(rows.filter((r) => r.targetKind === 'trip')).toHaveLength(1);
    expect(rows.find((r) => r.targetKind === 'review')?.signedIn).toBe(true);
  });

  it('treats a cross-site request as a guest, even with a cookie', async () => {
    const member = await makeUser('member');
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'other' }, { cookie: member.cookie, site: 'cross-site', ip: '203.0.113.31' })).status).toBe(201);
    const row = (await (await planner.getPlannerRepository()).listReports('open')).find((r) => r.reason === 'other');
    expect(row?.signedIn).toBe(false);
  });

  it('without Sec-Fetch-Site, a foreign or malformed Origin is a guest and our own Origin is the member (S-3)', async () => {
    const guests = async () => (await (await planner.getPlannerRepository()).listReports('open')).filter((r) => !r.signedIn).length;
    const base = await guests();
    const a = await makeUser('member');
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'harassment' }, { cookie: a.cookie, origin: 'https://evil.test', ip: '203.0.113.61' })).status).toBe(201);
    expect(await guests()).toBe(base + 1);
    const b = await makeUser('member');
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'harassment' }, { cookie: b.cookie, origin: 'not a url', ip: '203.0.113.62' })).status).toBe(201);
    expect(await guests()).toBe(base + 2);
    const c = await makeUser('member');
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'harassment' }, { cookie: c.cookie, origin: ORIGIN, ip: '203.0.113.63' })).status).toBe(201);
    expect(await guests()).toBe(base + 2);
  });

  it('404 for an unknown and for a non-public target, the same body', async () => {
    const a = await post({ targetKind: 'trip', shareToken: 'B'.repeat(43), reason: 'spam' }, { ip: '203.0.113.41' });
    const b = await post({ targetKind: 'review', targetId: 'rev_missing', reason: 'spam' }, { ip: '203.0.113.41' });
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(JSON.stringify(await a.json())).not.toContain('B'.repeat(43));
  });

  it('422 for a bad body; a filled honeypot answers 201 and stores nothing', async () => {
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'nope' }, { ip: '203.0.113.51' })).status).toBe(422);
    const before = (await (await planner.getPlannerRepository()).listReports()).length;
    expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'spam', website: 'http://spam' }, { ip: '203.0.113.52' })).status).toBe(201);
    expect((await (await planner.getPlannerRepository()).listReports()).length).toBe(before);
  });

  it('429 with Retry-After after 10 reports in a day from one client', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await post({ targetKind: 'review', targetId: reviewId, reason: 'spam' }, { ip: '203.0.113.99' })).status).toBe(201);
    }
    const blocked = await post({ targetKind: 'review', targetId: reviewId, reason: 'spam' }, { ip: '203.0.113.99' });
    expect(blocked.status).toBe(429);
    const retry = Number(blocked.headers.get('retry-after'));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(86_400);
  });
});

describe('admin reports (community:moderate)', () => {
  it('list: 401 anonymous, 403 member, 200 editor and service, 400 bad status, no private fields', async () => {
    expect((await list()).status).toBe(401);
    const member = await makeUser('member');
    expect((await list('', { cookie: member.cookie })).status).toBe(403);
    const editor = await makeUser('editor');
    const ok = await list('?status=open', { cookie: editor.cookie });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const text = JSON.stringify(await ok.json());
    expect(text).toContain('"signedIn"');
    expect(text).not.toMatch(/clientKey|reporterId|203\.0\.113/);
    expect(text).not.toContain(token);
    expect((await list('', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await list('?status=weird', { cookie: editor.cookie })).status).toBe(400);
  });

  it('resolve: member 403, editor ok, idempotent, one event', async () => {
    const repo = await planner.getPlannerRepository();
    const [target] = await repo.listReports('open');
    const id = target!.id;
    const member = await makeUser('member');
    expect((await resolve(id, { outcome: 'dismissed', reason: 'không vi phạm' }, { cookie: member.cookie })).status).toBe(403);
    const editor = await makeUser('editor');
    const first = await resolve(id, { outcome: 'dismissed', reason: 'không vi phạm' }, { cookie: editor.cookie });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ id, status: 'dismissed' });
    expect((await resolve(id, { outcome: 'dismissed', reason: 'không vi phạm' }, { cookie: editor.cookie })).status).toBe(200);
    expect((await resolve(id, { outcome: 'actioned', reason: 'đổi ý rồi' }, { cookie: editor.cookie })).status).toBe(409);
    expect((await resolve('rpt_nope', { outcome: 'dismissed', reason: 'không có' }, { cookie: editor.cookie })).status).toBe(404);
    expect((await resolve(id, { outcome: 'dismissed' }, { cookie: editor.cookie })).status).toBe(422);
    const events = (await repo.listEvents(target!.targetId)).filter((e) => e.action === 'report_dismissed');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: editor.id, reason: 'không vi phạm' });
  });
});
