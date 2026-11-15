import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { placeFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** ADR 0015: who may hold, restrict and lift, over HTTP. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';

let workdir: string;
let routes: {
  list: typeof import('../src/app/api/admin/community/restrictions/route');
  one: typeof import('../src/app/api/admin/community/restrictions/[id]/route');
  review: typeof import('../src/app/api/admin/community/reviews/[id]/route');
};
let planner: typeof import('../src/server/planner/instance');

interface Opts {
  method?: string;
  body?: unknown;
  bearer?: string;
  cookie?: string;
  origin?: string | null;
}
function req(path: string, o: Opts = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
  const origin = o.origin === undefined ? (o.cookie ? ORIGIN : null) : o.origin;
  if (origin) headers.origin = origin;
  return new Request(`${ORIGIN}${path}`, {
    method: o.method ?? 'GET',
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
  });
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

let counter = 0;
async function makeUser(role: 'member' | 'editor' | 'admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({
    handle: `rr-${role}-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Người dùng',
    role,
  });
  const session = await repo.signIn(issued.accessToken);
  return { id: issued.user.id, cookie: session.token };
}

async function aReview(): Promise<string> {
  const repo = await planner.getPlannerRepository();
  const author = await makeUser('member');
  await repo.upsertPlannerReview(author.id, 'rr-place', {
    rating: 4,
    body: BODY,
    lang: 'vi',
    visitedOn: '2026-02-20',
    authorDisplay: 'name',
  });
  const item = (await repo.listReviewQueue()).find((row) => row.placeSlug === 'rr-place' && row.status === 'approved');
  return item!.id;
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'review-restrictions-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  routes = {
    list: await import('../src/app/api/admin/community/restrictions/route'),
    one: await import('../src/app/api/admin/community/restrictions/[id]/route'),
    review: await import('../src/app/api/admin/community/reviews/[id]/route'),
  };
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'rr-place' }));
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('restriction routes', () => {
  it('lets admin and the service token restrict and lift; refuses editor and member (403) and nobody (401)', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const member = await makeUser('member');
    const reviewId = await aReview();
    const body = { reviewId, scope: 'place', reason: 'nội dung sai' };

    for (const who of [editor, member]) {
      const denied = await routes.list.POST(req('/api/admin/community/restrictions', { method: 'POST', body, cookie: who.cookie }));
      expect(denied.status).toBe(403);
    }
    expect((await routes.list.POST(req('/api/admin/community/restrictions', { method: 'POST', body }))).status).toBe(401);

    const created = await routes.list.POST(
      req('/api/admin/community/restrictions', { method: 'POST', body, cookie: admin.cookie }),
    );
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const { id } = await created.json();

    const listed = await routes.list.GET(req('/api/admin/community/restrictions?active=1', { bearer: ADMIN_TOKEN }));
    const payload = await listed.json();
    expect(payload.items).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toMatch(/guestKey|authorId/);
    expect((await routes.list.GET(req('/api/admin/community/restrictions', { cookie: editor.cookie }))).status).toBe(403);

    expect((await routes.one.DELETE(req(`/api/admin/community/restrictions/${id}`, { method: 'DELETE', cookie: editor.cookie }), idParams(id))).status).toBe(403);
    const lifted = await routes.one.DELETE(
      req(`/api/admin/community/restrictions/${id}`, { method: 'DELETE', bearer: ADMIN_TOKEN }),
      idParams(id),
    );
    expect(lifted.status).toBe(200);
    expect((await (await routes.list.GET(req('/api/admin/community/restrictions?active=1', { bearer: ADMIN_TOKEN }))).json()).items).toEqual([]);
  });

  it('refuses a cross-site cookie request and unknown body fields', async () => {
    const admin = await makeUser('admin');
    const reviewId = await aReview();
    const body = { reviewId, scope: 'all', reason: 'lạm dụng' };
    const cross = await routes.list.POST(
      req('/api/admin/community/restrictions', { method: 'POST', body, cookie: admin.cookie, origin: 'https://evil.test' }),
    );
    expect(cross.status).toBe(403);
    const extra = await routes.list.POST(
      req('/api/admin/community/restrictions', { method: 'POST', body: { ...body, authorId: 'x' }, cookie: admin.cookie }),
    );
    expect(extra.status).toBe(422);
  });

  it('lets an editor hold a review and ask the author, but only one written in the Planner', async () => {
    const editor = await makeUser('editor');
    const reviewId = await aReview();
    const held = await routes.review.PATCH(
      req(`/api/admin/community/reviews/${reviewId}`, {
        method: 'PATCH',
        body: { decision: 'hold', reason: 'Bạn đã đến đó thật chứ?' },
        cookie: editor.cookie,
      }),
      idParams(reviewId),
    );
    expect(held.status).toBe(200);
    expect((await held.json()).status).toBe('held');
  });
});
