import { invalidateOverviewCacheAfter, invalidateOverviewPayloadsAfter, overviewCache } from '@/server/overview-cache';
import { NextResponse } from 'next/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import {
  buildOverview,
  loadOverview,
  OVERVIEW_CACHE_TTL_MS,
  OVERVIEW_CARD_IDS,
  REVIEW_QUEUE_CAP,
  resetOverviewCache, type OverviewSources,
} from '../src/server/admin/overview';
import { storyFixture } from './travel-content-helpers';
import { daLatTripInput } from './planner-helpers';

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

beforeEach(() => resetOverviewCache());

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
    expect(await ids(response)).toEqual([
      'listingsPending',
      'reviewsHeld',
      'reportsOpen',
      'contentDrafts',
      'contentPublished',
      'integrityIssues',
    ]);
  });

  it('admin adds the two user cards (no integrity card); the service token matches; no runtime card', async () => {
    const admin = await makeUser('admin');
    const expected = [
      'listingsPending',
      'reviewsHeld',
      'reportsOpen',
      'restrictionsActive',
      'contentDrafts',
      'contentPublished',
      'integrityIssues',
      'usersActive',
      'usersDisabled',
    ];
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
    expect(body.cards.map((c: { id: string }) => c.id)).not.toContain('integrity');
    expect(card('usersActive').count + card('usersDisabled').count).toBe((await planner_.listUsers()).length);
    expect(card('reviewsHeld').count).toBe((await planner_.listReviewQueue('held')).length);
    expect(card('listingsPending').count).toBe(
      (await planner_.listListingQueue()).filter((i) => i.listing.status === 'pending').length,
    );
  });
});

describe('buildOverview degraded and empty paths', () => {
  const ok: OverviewSources = {
    pendingListings: async () => 2,
    heldReviews: async () => 0,
    openReports: async () => 1,
    activeRestrictions: async () => 0,
    contentDrafts: async () => 3,
    contentPublished: async () => 4,
    integrityIssues: async () => 0,
    users: async () => ({ active: 5, disabled: 1 }),
    runtime: () => 'file',
  };

  it('a failing source degrades only its own card', async () => {
    const overview = await buildOverview(
      { role: 'super_admin' },
      {
        ...ok,
        heldReviews: async () => {
          throw new Error('db down');
        },
        users: async () => {
          throw new Error('db down');
        },
      },
    );
    const byId = Object.fromEntries(overview.cards.map((c) => [c.id, c]));
    expect(byId.reviewsHeld).toMatchObject({ state: 'unavailable' });
    expect(byId.reviewsHeld?.count).toBeUndefined();
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
    expect(overview.cards.find((c) => c.id === 'reviewsHeld')).not.toHaveProperty('severity');
  });

  it('a held-review count at the cap is a lower bound, below it is exact', async () => {
    const capped = await buildOverview({ role: 'editor' }, { ...ok, heldReviews: async () => REVIEW_QUEUE_CAP });
    expect(capped.cards.find((c) => c.id === 'reviewsHeld')).toMatchObject({ count: 200, atLeast: true });
    const exact = await buildOverview({ role: 'editor' }, { ...ok, heldReviews: async () => REVIEW_QUEUE_CAP - 1 });
    expect(exact.cards.find((c) => c.id === 'reviewsHeld')).not.toHaveProperty('atLeast');
  });

  it('state and detail come from closed sets; a thrown message never reaches the payload', async () => {
    const overview = await buildOverview(
      { role: 'super_admin' },
      {
        ...ok,
        contentDrafts: async () => {
          throw new Error('postgres://user:secret@host/db stack');
        },
      },
    );
    for (const card of overview.cards) {
      expect(['ok', 'unavailable']).toContain(card.state);
      if (card.detail) expect(['postgres', 'file', 'mixed']).toContain(card.detail);
    }
    expect(JSON.stringify(overview)).not.toMatch(/secret|postgres:\/\/|stack/);
  });

  it('only the super admin gets the runtime card', async () => {
    for (const role of ['editor', 'admin'] as const) {
      expect((await buildOverview({ role }, ok)).cards.map((c) => c.id)).not.toContain('runtime');
    }
    expect((await buildOverview({ role: 'super_admin' }, ok)).cards.map((c) => c.id)).toContain('runtime');
  });
});

describe('overview cache (security review warning: unrate-limited full reads)', () => {
  it('serves repeats within the window from one read, per role, and refreshes after it', async () => {
    const repo = await content.getRepository();
    const draftCount = async () =>
      ((await loadOverview({ role: 'editor' }, t0 + 1)).cards.find((c) => c.id === 'contentDrafts')?.count) ?? -1;
    const t0 = 1_000_000;
    const first = (await loadOverview({ role: 'editor' }, t0)).cards.find((c) => c.id === 'contentDrafts')?.count ?? -1;
    await repo.createStory(storyFixture({ slug: `ov-cache-${Date.now()}` }));
    expect(await draftCount()).toBe(first); // still the cached payload
    const later = await loadOverview({ role: 'editor' }, t0 + OVERVIEW_CACHE_TTL_MS + 1);
    expect(later.cards.find((c) => c.id === 'contentDrafts')?.count).toBe(first + 1);
    // another role has its own entry and its own card set
    const admin = await loadOverview({ role: 'admin' }, t0 + 2);
    expect(admin.cards.map((c) => c.id)).toContain('usersActive');
  });

  it('is dropped right after a state-changing admin request, not after a read', async () => {
    const repo = await content.getRepository();
    const t0 = 2_000_000;
    const drafts = async (at: number) =>
      ((await loadOverview({ role: 'editor' }, at)).cards.find((c) => c.id === 'contentDrafts')?.count) ?? -1;
    const before = await drafts(t0);
    await repo.createStory(storyFixture({ slug: `ov-inval-${Date.now()}` }));
    invalidateOverviewCacheAfter(new Request('http://x/api', { method: 'GET' }));
    expect(await drafts(t0 + 1)).toBe(before); // a read keeps the cache
    invalidateOverviewCacheAfter(new Request('http://x/api', { method: 'POST' }));
    expect(await drafts(t0 + 2)).toBe(before + 1); // a write refreshes at once
  });
});

describe('reviews on hold card', () => {
  it('counts held reviews, never flags them, and the pending queue is gone', async () => {
    const overview = await buildOverview(
      { role: 'editor' },
      { pendingListings: async () => 0, heldReviews: async () => 3, openReports: async () => 0, activeRestrictions: async () => 0,
        contentDrafts: async () => 0, contentPublished: async () => 0, integrityIssues: async () => 0,
        users: async () => ({ active: 0, disabled: 0 }), runtime: () => 'file' },
    );
    const card = overview.cards.find((c) => c.id === 'reviewsHeld');
    expect(card).toMatchObject({ state: 'ok', count: 3 });
    expect(card).not.toHaveProperty('severity');
    expect(OVERVIEW_CARD_IDS).not.toContain('reviewsPending' as never);
  });
});

describe('overview cache and member writes', () => {
  const warm = async (at: number) => {
    await loadOverview({ role: 'editor' }, at);
    expect(overviewCache().size).toBe(1);
  };

  it('a member or reader write drops only the dashboard payloads, a read keeps them', async () => {
    await warm(3_000_000);
    invalidateOverviewPayloadsAfter(new Request('http://x/api', { method: 'GET' }));
    expect(overviewCache().size).toBe(1);
    invalidateOverviewPayloadsAfter(new Request('http://x/api', { method: 'POST' }));
    expect(overviewCache().size).toBe(0);
  });

  it('plannerRoute drops the payloads after a member write, even when the handler throws', async () => {
    const { plannerRoute } = await import('../src/server/planner/http');
    const member = await makeUser('member');
    const request = (method: string) =>
      new Request(`${ORIGIN}/api/planner/x`, { method, headers: { cookie: `${SESSION_COOKIE}=${member.cookie}`, origin: ORIGIN } });

    await warm(4_000_000);
    await plannerRoute(request('GET'), async () => NextResponse.json({ ok: true }));
    expect(overviewCache().size).toBe(1);

    await plannerRoute(request('PUT'), async () => NextResponse.json({ ok: true }));
    expect(overviewCache().size).toBe(0);

    await warm(4_000_001);
    await plannerRoute(request('POST'), async () => {
      throw new Error('boom');
    });
    expect(overviewCache().size).toBe(0);
  });

  it('a member listing request shows on the dashboard at once, not after the window', async () => {
    const repo = await planner.getPlannerRepository();
    const { plannerRoute } = await import('../src/server/planner/http');
    const owner = await makeUser('member');
    const { trip } = await repo.createTrip(owner.id, daLatTripInput());
    await repo.setVisibility(owner.id, trip.id, 'public');
    await repo.acceptTerms(owner.id, (await import('../src/content/site')).termsVersion, 'vi');

    const pending = async (at: number) =>
      (await loadOverview({ role: 'editor' }, at)).cards.find((c) => c.id === 'listingsPending')?.count ?? -1;
    const before = await pending(5_000_000);
    await plannerRoute(
      new Request(`${ORIGIN}/api/planner/${trip.id}/listing`, {
        method: 'PUT',
        headers: { cookie: `${SESSION_COOKIE}=${owner.cookie}`, origin: ORIGIN },
      }),
      async ({ userId }) => {
        await repo.requestListing(userId, trip.id, 'name');
        return NextResponse.json({ ok: true });
      },
    );
    expect(await pending(5_000_001)).toBe(before + 1); // same 15s window, fresh count
  });
});
