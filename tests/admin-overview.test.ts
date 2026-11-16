import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { buildOverview, OVERVIEW_CARD_IDS, type OverviewSources } from '../src/server/admin/overview';
import { storyFixture } from './travel-content-helpers';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

let workdir: string;
let route: typeof import('../src/app/api/admin/overview/route');
let planner: typeof import('../src/server/planner/instance');
let content: typeof import('../src/server/content/instance');

function req(o: { bearer?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) {
    headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
    headers.origin = ORIGIN;
  }
  return new Request(`${ORIGIN}/api/admin/overview`, { headers });
}

let n = 0;
async function makeUser(role: 'member' | 'editor' | 'admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `ov-${role}-${(n += 1)}`, displayName: 'Người thử', role });
  const session = await repo.signIn(issued.accessToken);
  return { id: issued.user.id, cookie: session.token };
}

const ids = async (response: Response) =>
  ((await response.json()).cards as { id: string }[]).map((card) => card.id);

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'admin-overview-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  delete process.env.CONTENT_DATABASE_URL;
  route = await import('../src/app/api/admin/overview/route');
  planner = await import('../src/server/planner/instance');
  content = await import('../src/server/content/instance');
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('GET /api/admin/overview role matrix', () => {
  it('anonymous 401, member 403, both no-store', async () => {
    const anonymous = await route.GET(req());
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('cache-control')).toBe('no-store');
    const member = await makeUser('member');
    const forbidden = await route.GET(req({ cookie: member.cookie }));
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get('cache-control')).toBe('no-store');
  });

  it('editor sees content and moderation cards only', async () => {
    const editor = await makeUser('editor');
    const response = await route.GET(req({ cookie: editor.cookie }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await ids(response)).toEqual(['listingsPending', 'reviewsPending', 'contentDrafts']);
  });

  it('admin adds user and integrity cards; the service token matches; no runtime card', async () => {
    const admin = await makeUser('admin');
    const expected = ['listingsPending', 'reviewsPending', 'contentDrafts', 'usersActive', 'usersDisabled', 'integrity'];
    expect(await ids(await route.GET(req({ cookie: admin.cookie })))).toEqual(expected);
    expect(await ids(await route.GET(req({ bearer: ADMIN_TOKEN })))).not.toContain('runtime');
  });

  it('payload carries ids, counts and links only: no handle, email or secret', async () => {
    const admin = await makeUser('admin');
    const text = JSON.stringify(await (await route.GET(req({ cookie: admin.cookie }))).json());
    expect(text).not.toMatch(/ov-admin|@|token|hash|password/i);
    for (const card of JSON.parse(text).cards) expect(OVERVIEW_CARD_IDS).toContain(card.id);
  });
});

describe('counts equal the underlying lists', () => {
  it('matches a fixture on the JSON store', async () => {
    const repo = await content.getRepository();
    await repo.createStory(storyFixture({ slug: 'ov-draft-1' }));
    await repo.createStory(storyFixture({ slug: 'ov-draft-2' }));
    const drafts = (await repo.listStories({ status: 'draft' })).length + (await repo.listReviews({ status: 'draft' })).length;

    const planner_ = await planner.getPlannerRepository();
    const target = await makeUser('member');
    await planner_.changeAccountState(target.id, 'ban');
    const users = await planner_.listUsers();
    const disabled = users.filter((u) => u.bannedAt || u.deletedAt).length;

    const admin = await makeUser('admin');
    const body = await (await route.GET(req({ cookie: admin.cookie }))).json();
    const card = (id: string) => body.cards.find((c: { id: string }) => c.id === id);
    expect(card('contentDrafts').count).toBe(drafts);
    expect(card('contentDrafts').count).toBeGreaterThanOrEqual(2);
    expect(disabled).toBeGreaterThanOrEqual(1);
    expect(card('usersDisabled').count).toBe(disabled);
    expect(card('usersActive').count + card('usersDisabled').count).toBe((await planner_.listUsers()).length);
    expect(card('reviewsPending').count).toBe((await planner_.listReviewQueue('pending')).length);
    expect(card('listingsPending').count).toBe(
      (await planner_.listListingQueue()).filter((i) => i.listing.status === 'pending').length,
    );
  });
});

describe('buildOverview degraded and empty paths', () => {
  const ok: OverviewSources = {
    pendingListings: async () => 2,
    pendingReviews: async () => 0,
    contentDrafts: async () => 3,
    users: async () => ({ active: 5, disabled: 1 }),
    integrityFindings: async () => 0,
    runtime: () => 'file',
  };

  it('a failing source degrades only its own card', async () => {
    const overview = await buildOverview(
      { role: 'super_admin' },
      {
        ...ok,
        pendingReviews: async () => {
          throw new Error('db down');
        },
        users: async () => {
          throw new Error('db down');
        },
      },
    );
    const byId = Object.fromEntries(overview.cards.map((c) => [c.id, c]));
    expect(byId.reviewsPending).toMatchObject({ state: 'unavailable' });
    expect(byId.reviewsPending?.count).toBeUndefined();
    expect(byId.usersActive).toMatchObject({ state: 'unavailable' });
    expect(byId.usersDisabled).toMatchObject({ state: 'unavailable' });
    expect(byId.listingsPending).toMatchObject({ state: 'ok', count: 2, severity: 'attention' });
    expect(byId.runtime).toMatchObject({ state: 'ok', detail: 'file' });
    expect(overview.cards).toHaveLength(OVERVIEW_CARD_IDS.length);
  });

  it('member gets no cards (empty state)', async () => {
    expect((await buildOverview({ role: 'member' }, ok)).cards).toEqual([]);
  });

  it('zero counts carry no severity', async () => {
    const overview = await buildOverview({ role: 'admin' }, ok);
    expect(overview.cards.find((c) => c.id === 'integrity')).not.toHaveProperty('severity');
  });
});
