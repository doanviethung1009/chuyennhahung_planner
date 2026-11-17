import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { guestReviewInputSchema } from '../src/server/planner/schemas';
import { impersonatesStaff, RESERVED_NAME_PHRASES } from '../src/server/community/reserved-names';
import { requireContributionOpen } from '../src/server/community/contribution-gate';
import { termsVersion } from '../src/content/site';
import { clientKey } from '../src/server/rate-limit';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture } from './travel-content-helpers';

// Batch 10.6a. The real `site.ts` is untouched: only the flag the gate reads is
// made switchable, so a closed gate can be simulated without editing content.
const gate = vi.hoisted(() => ({ open: true }));
vi.mock('../src/content/site', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/content/site')>();
  const mocked = { ...original };
  Object.defineProperty(mocked, 'contributionOpen', { get: () => gate.open, enumerable: true });
  return mocked;
});
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
const PLACE = 'hd-place';
let workdir: string;
let planner: typeof import('../src/server/planner/instance');
let guestRoute: typeof import('../src/app/api/community/reviews/route');
let plannerReviewRoute: typeof import('../src/app/api/planner/reviews/[placeSlug]/route');
let listingRoute: typeof import('../src/app/api/planner/[id]/listing/route');
let cookie: string;
let tripId: string;
let n = 0;

const review = { rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20' };
const json = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${url}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
const guestPost = (body: Record<string, unknown> = {}, ip = '203.0.113.1') =>
  guestRoute.POST(
    json('/api/community/reviews', 'POST', { placeSlug: PLACE, ...review, authorName: null, ...body }, { 'x-forwarded-for': ip }),
  );
const plannerPut = () =>
  plannerReviewRoute.PUT(
    json(`/api/planner/reviews/${PLACE}`, 'PUT', { ...review, authorDisplay: 'name' }, { cookie: `${SESSION_COOKIE}=${cookie}` }),
    { params: Promise.resolve({ placeSlug: PLACE }) },
  );
const listingPut = () =>
  listingRoute.PUT(json(`/api/planner/${tripId}/listing`, 'PUT', { authorDisplay: 'name' }, { cookie: `${SESSION_COOKIE}=${cookie}` }), {
    params: Promise.resolve({ id: tripId }),
  });

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'hardening-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = 'test-admin-token-at-least-32-chars-long';
  delete process.env.PLANNER_DATABASE_URL;
  guestRoute = await import('../src/app/api/community/reviews/route');
  plannerReviewRoute = await import('../src/app/api/planner/reviews/[placeSlug]/route');
  listingRoute = await import('../src/app/api/planner/[id]/listing/route');
  planner = await import('../src/server/planner/instance');
  await (await (await import('../src/server/content/instance')).getRepository()).createPlace(placeFixture({ slug: PLACE }));
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `hd-${(n += 1)}`, displayName: 'Người dùng', role: 'member' });
  cookie = (await repo.signIn(issued.accessToken)).token;
  const view = await repo.createTrip(issued.user.id, daLatTripInput());
  await repo.addActivity(issued.user.id, view.trip.id, activityInput(), null);
  await repo.setVisibility(issued.user.id, view.trip.id, 'public');
  tripId = view.trip.id;
  await repo.acceptTerms(issued.user.id, termsVersion, 'vi');
});
afterAll(async () => {
  gate.open = true;
  await rm(workdir, { recursive: true, force: true });
});

describe('P10-15 contribution gate', () => {
  it('requireContributionOpen throws forbidden/contribution_closed only when closed', () => {
    expect(() => requireContributionOpen(true)).not.toThrow();
    expect(() => requireContributionOpen(false)).toThrowError(
      expect.objectContaining({ code: 'forbidden', status: 403, reason: 'contribution_closed' }),
    );
  });

  it('closed: the three write routes answer 403 contribution_closed, reads still work', async () => {
    gate.open = false;
    try {
      for (const res of [await guestPost({}, '203.0.113.2'), await plannerPut(), await listingPut()]) {
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('forbidden');
        expect(body.error.reason).toBe('contribution_closed');
      }
      expect((await guestRoute.GET(new Request(`${ORIGIN}/api/community/reviews`))).status).toBe(200);
      const listing = await (await planner.getPlannerRepository()).listApprovedReviews();
      expect(listing.items).toEqual([]); // nothing was stored by the refused writes
    } finally {
      gate.open = true;
    }
  });

  it('closed gate does not spend the guest limiter', async () => {
    gate.open = false;
    try {
      for (let i = 0; i < 5; i += 1) expect((await guestPost({}, '203.0.113.3')).status).toBe(403);
    } finally {
      gate.open = true;
    }
    expect((await guestPost({}, '203.0.113.3')).status).toBe(201);
  });

  it('open: the three writes behave as before', async () => {
    expect((await guestPost({}, '203.0.113.4')).status).toBe(201);
    expect((await plannerPut()).status).toBe(200);
    expect((await listingPut()).status).toBe(200);
  });
});

describe('P10-16 guest authorName', () => {
  const parse = (authorName: unknown) => guestReviewInputSchema.safeParse({ placeSlug: PLACE, ...review, authorName });

  it.each(['Admin', 'ADMIN', 'admin hung', 'Quản trị viên', 'quan tri', 'Ban Biên Tập', 'Chuyện Nhà Hưng', 'ChuyenNhaHung', 'Nhân viên Lan', 'Staff', 'Moderator', 'Hỗ trợ'])(
    'rejects %s',
    (name) => {
      const result = parse(name);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.path).toEqual(['authorName']);
    },
  );

  it.each(['Lan', 'Nguyễn Thị Hương', 'Đặng Văn Hưng', 'Hưng', 'Trần Mộng Điệp', 'Minh Quân', 'Phương Thảo', 'Modest Mouse', 'Mai'])(
    'accepts %s',
    (name) => expect(parse(name).success).toBe(true),
  );

  it('null stays allowed; the list is one constant of plain lowercase phrases', () => {
    expect(parse(null).success).toBe(true);
    expect(impersonatesStaff('Đ Ă Ng')).toBe(false);
    for (const p of RESERVED_NAME_PHRASES) expect(p).toBe(p.toLowerCase());
  });

  it('the route answers 422 validation_failed with path authorName', async () => {
    const res = await guestPost({ authorName: 'Quản Trị Viên' }, '203.0.113.5');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.issues[0].path).toBe('authorName');
  });
});

describe('P10-12 clientKey behind the documented proxy', () => {
  const remoteAddrOnly = (conf: string) =>
    /proxy_set_header\s+X-Forwarded-For\s+\$remote_addr\s*;/.test(conf.replace(/#.*$/gm, ''));
  // What the app sees: nginx drops the client's X-Forwarded-For and writes the socket address.
  const viaProxy = (socket: string, _clientHeaders: Record<string, string>) => new Headers({ 'x-forwarded-for': socket });

  for (const file of ['deploy/nginx/default.conf', 'deploy/nginx-app.conf']) {
    it(`${file} overwrites the header, so a forged value cannot pick the key`, () => {
      expect(remoteAddrOnly(readFileSync(join(__dirname, '..', file), 'utf8'))).toBe(true);
      const forged = { 'x-forwarded-for': '6.6.6.6, 7.7.7.7', 'x-real-ip': '8.8.8.8' };
      expect(clientKey(viaProxy('198.51.100.20', forged))).toBe('198.51.100.20');
    });
  }

  it('rotating a forged header does not escape the guest limiter behind the proxy', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await guestRoute.POST(
        json('/api/community/reviews', 'POST', { placeSlug: PLACE, ...review, authorName: null, rating: 4 }, viaProxyHeaders('198.51.100.30', `9.9.9.${i}`)),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s === 201 || s === 409)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it('WITHOUT the proxy the first hop is the client\'s own claim (why nginx must overwrite)', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.40' }))).toBe('6.6.6.6');
  });
});

/** The request headers the app receives when the client forges `forged` but nginx overwrites it. */
function viaProxyHeaders(socket: string, _forged: string): Record<string, string> {
  return { 'x-forwarded-for': socket };
}
