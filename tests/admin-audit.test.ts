import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';
import { registerAuditCases } from './admin-audit-cases';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

describe('admin audit events on the memory store (P07-13)', () => {
  registerAuditCases(async () => {
    const store = createMemoryPlannerStore();
    return { planner: makePlanner({ store }), store };
  });
});

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let route: typeof import('../src/app/api/admin/audit/route');
let storyRoute: typeof import('../src/app/api/admin/travel/stories/[slug]/status/route');
let planner: typeof import('../src/server/planner/instance');
let content: typeof import('../src/server/content/instance');
let n = 0;

const get = (query: string, o: { bearer?: string; cookie?: string } = {}) =>
  route.GET(
    new Request(`${ORIGIN}/api/admin/audit${query}`, {
      headers: {
        ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
        ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
      },
    }),
  );

async function makeUser(role: 'member' | 'editor' | 'admin' | 'super_admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `au-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`, displayName: 'Người dùng', role });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}

beforeAll(async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'admin-audit-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  route = await import('../src/app/api/admin/audit/route');
  storyRoute = await import('../src/app/api/admin/travel/stories/[slug]/status/route');
  planner = await import('../src/server/planner/instance');
  content = await import('../src/server/content/instance');
});

describe('GET /api/admin/audit (audit:read)', () => {
  it('401 anonymous, 403 member and editor, 200 admin, super admin and service; no-store', async () => {
    expect((await get('')).status).toBe(401);
    expect((await get('', { cookie: (await makeUser('member')).cookie })).status).toBe(403);
    expect((await get('', { cookie: (await makeUser('editor')).cookie })).status).toBe(403);
    for (const role of ['admin', 'super_admin'] as const) {
      const res = await get('', { cookie: (await makeUser(role)).cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect((await get('', { bearer: ADMIN_TOKEN })).status).toBe(200);
  });

  it('validates filters and the cursor', async () => {
    const bearer = ADMIN_TOKEN;
    for (const q of ['?targetType=nope', '?action=DROP TABLE', '?from=yesterday', '?limit=0', '?limit=101', '?cursor=zzz', '?from=2026-05-02&to=2026-05-01', '?from=2026-02-31']) {
      expect((await get(q, { bearer })).status, q).toBe(422);
    }
  });

  it('pages deterministically and returns neither email nor secrets', async () => {
    const repo = await planner.getPlannerRepository();
    const boss = await makeUser('super_admin');
    const issued = await repo.createUser({ handle: `pg-${(n += 1)}`, displayName: 'Khách', email: `leak${n}@example.com`, role: 'member' }, { userId: boss.id });
    for (const role of ['editor', 'member', 'editor'] as const) await repo.setUserRole(issued.user.id, role, { userId: boss.id });
    const first = await (await get(`?actor=${boss.id}&limit=2`, { bearer: ADMIN_TOKEN })).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await (await get(`?actor=${boss.id}&limit=2&cursor=${first.nextCursor}`, { bearer: ADMIN_TOKEN })).json();
    expect(second.items.length).toBeGreaterThan(0);
    const ids = [...first.items, ...second.items].map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const blob = JSON.stringify(await (await get('?limit=100', { bearer: ADMIN_TOKEN })).json());
    expect(blob).not.toContain('@example.com');
    expect(blob).not.toMatch(/passwordHash|tokenHash|guestKey/);
  });
});

describe('story publish events', () => {
  const post = (slug: string, action: string) =>
    storyRoute.POST(
      new Request(`${ORIGIN}/api/admin/travel/stories/${slug}/status`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      }),
      { params: Promise.resolve({ slug }) },
    );

  it('writes one event per real change and none for a repeat', async () => {
    const { storyFixture } = await import('./travel-content-helpers');
    const repo = await content.getRepository();
    const story = await repo.createStory(storyFixture({ slug: 'audit-story' }));
    expect((await post(story.slug, 'publish')).status).toBe(200);
    expect((await post(story.slug, 'publish')).status).toBe(200);
    expect((await post(story.slug, 'archive')).status).toBe(200);
    const body = await (await get('?targetType=story', { bearer: ADMIN_TOKEN })).json();
    const mine = body.items.filter((e: { targetId: string }) => e.targetId === 'audit-story');
    expect(mine.map((e: { action: string; fromStatus: string; toStatus: string }) => `${e.action}:${e.fromStatus}>${e.toStatus}`)).toEqual([
      'archive:published>archived',
      'publish:draft>published',
    ]);
    expect(mine[0]).toMatchObject({ actorId: 'service', actorKind: 'service' });
  });

  it('a failed change writes no event', async () => {
    expect((await post('missing-story', 'publish')).status).toBe(404);
    const body = await (await get('?targetType=story', { bearer: ADMIN_TOKEN })).json();
    expect(body.items.some((e: { targetId: string }) => e.targetId === 'missing-story')).toBe(false);
  });
});

describe('rendering', () => {
  it('shows reasons as plain text: no raw-HTML sink in the page or the table', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const file of ['src/components/admin/audit/audit-table.tsx', 'src/app/(admin)/[locale]/admin/audit/page.tsx']) {
      expect(await readFile(file, 'utf8')).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
  });
});
