import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { guestReviewInputSchema } from '../src/server/planner/schemas';
import { placeFixture } from './travel-content-helpers';
import { makePlanner } from './planner-helpers';
import { registerErasureCases } from './guest-review-erasure-cases';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

describe('guest review erasure on the JSON/memory store (ADR 0024 §8)', () => {
  registerErasureCases(async () => {
    const store = createMemoryPlannerStore();
    return { planner: makePlanner({ store }), store };
  });
});

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let route: typeof import('../src/app/api/admin/community/reviews/[id]/erase/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;

const post = (id: string, body: unknown, o: { bearer?: string; cookie?: string; origin?: string } = {}) =>
  route.POST(
    new Request(`${ORIGIN}/api/admin/community/reviews/${id}/erase`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: o.origin ?? ORIGIN,
        ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
        ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

async function makeUser(role: 'member' | 'editor' | 'admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `er-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`, displayName: 'Người dùng', role });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}

beforeAll(async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'erase-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  route = await import('../src/app/api/admin/community/reviews/[id]/erase/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'er-place' }));
});

describe('POST /api/admin/community/reviews/[id]/erase (community:erase)', () => {
  it('401 anonymous, 403 member and editor, 403 cross-site cookie, 422 bad body, 404, 200 admin and service', async () => {
    const repo = await planner.getPlannerRepository();
    const body = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
    await repo.createGuestReview(guestReviewInputSchema.parse({ placeSlug: 'er-place', rating: 5, body, lang: 'vi', visitedOn: '2026-02-20', authorName: null }), '198.51.100.1');
    await repo.createGuestReview(guestReviewInputSchema.parse({ placeSlug: 'er-place', rating: 5, body, lang: 'vi', visitedOn: '2026-02-20', authorName: null }), '198.51.100.2');
    const ids = (await repo.listReviewQueue()).filter((r) => r.placeSlug === 'er-place').map((r) => r.id);
    const [first, second] = ids as [string, string];

    expect((await post(first, { reason: 'phiếu 1' })).status).toBe(401);
    const member = await makeUser('member');
    expect((await post(first, { reason: 'phiếu 1' }, { cookie: member.cookie })).status).toBe(403);
    const editor = await makeUser('editor');
    expect((await post(first, { reason: 'phiếu 1' }, { cookie: editor.cookie })).status).toBe(403);
    const admin = await makeUser('admin');
    expect((await post(first, { reason: 'phiếu 1' }, { cookie: admin.cookie, origin: 'https://evil.test' })).status).toBe(403);
    expect((await post(first, { reason: 'x' }, { cookie: admin.cookie })).status).toBe(422);
    expect((await post(first, { reason: 'phiếu 1', extra: 1 }, { cookie: admin.cookie })).status).toBe(422);
    expect((await post('rev_nope', { reason: 'phiếu 1' }, { cookie: admin.cookie })).status).toBe(404);
    expect((await repo.listReviewQueue()).every((r) => !r.erased)).toBe(true);

    const ok = await post(first, { reason: 'phiếu 1' }, { cookie: admin.cookie });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await ok.json()).toMatchObject({ id: first, status: 'removed', erased: true });
    expect((await post(second, { reason: 'phiếu 2' }, { bearer: ADMIN_TOKEN })).status).toBe(200);
    const events = (await repo.listEvents(first)).filter((e) => e.action === 'erase');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: admin.id, reason: 'phiếu 1' });

    const planned = await makeUser('member');
    await repo.upsertPlannerReview(planned.id, 'er-place', { rating: 4, body, lang: 'vi', visitedOn: '2026-02-20', authorDisplay: 'name' });
    const pid = (await repo.listReviewQueue()).find((r) => r.source === 'planner')!.id;
    expect((await post(pid, { reason: 'phiếu 3' }, { cookie: admin.cookie })).status).toBe(409);
  });
});
