import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let route: typeof import('../src/app/api/admin/community/events/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;

const get = (query: string, o: { bearer?: string; cookie?: string } = {}) =>
  route.GET(
    new Request(`${ORIGIN}/api/admin/community/events${query}`, {
      headers: {
        ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
        ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
      },
    }),
  );

async function makeUser(role: 'member' | 'editor' | 'admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `ev-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`, displayName: 'Người dùng', role });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}

beforeAll(async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'mod-events-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  route = await import('../src/app/api/admin/community/events/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'ev-place' }));
});

describe('GET /api/admin/community/events (community:moderate)', () => {
  it('401 anonymous, 403 member, 200 editor and service, no-store, 400 without targetId', async () => {
    expect((await get('?targetId=x')).status).toBe(401);
    const member = await makeUser('member');
    expect((await get('?targetId=x', { cookie: member.cookie })).status).toBe(403);

    const editor = await makeUser('editor');
    const repo = await planner.getPlannerRepository();
    const owner = await makeUser('member');
    await repo.upsertPlannerReview(owner.id, 'ev-place', { rating: 4, body: 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.', lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' });
    const reviewId = (await repo.listReviewQueue()).find((row) => row.placeSlug === 'ev-place')!.id;
    await repo.decideReview(reviewId, 'hold', editor.id, 'Bạn đi hồi nào?');

    const ok = await get(`?targetId=${reviewId}`, { cookie: editor.cookie });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const body = await ok.json();
    expect(body.count).toBe(1);
    expect(body.items[0]).toMatchObject({ action: 'hold', targetId: reviewId });
    expect((await get(`?targetId=${reviewId}`, { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await get('', { cookie: editor.cookie })).status).toBe(400);
  });

  it('has no write verbs', () => {
    expect(Object.keys(route).filter((k) => /^(POST|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
});
