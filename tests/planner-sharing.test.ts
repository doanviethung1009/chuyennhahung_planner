import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContentCatalog } from '../src/server/planner/catalog';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { tripSchema, type Trip } from '../src/server/planner/schemas';
import { createMemoryPlannerStore, emptyPlannerData } from '../src/server/planner/store';
import {
  activityInput,
  daLatTripInput,
  expenseInput,
  makeOwner,
  makePlanner,
  makeSeededPlanner,
} from './planner-helpers';
import { isContentError } from '../src/server/content/repository';

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!isContentError(error)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}, but it resolved`);
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

async function sharedTrip(visibility: 'unlisted' | 'public' = 'unlisted') {
  const planner = makePlanner();
  const { userId } = await makeOwner(planner);
  const view = await planner.createTrip(userId, daLatTripInput({ note: 'ghi chú riêng tư' }));
  await planner.addActivity(userId, view.trip.id, activityInput({ note: 'ghi chú hoạt động' }), null);
  await planner.addExpense(userId, view.trip.id, expenseInput({ label: 'BÍ MẬT' }), null);
  const share = await planner.setVisibility(userId, view.trip.id, visibility);
  return { planner, userId, tripId: view.trip.id, token: share.shareToken! };
}

describe('share lifecycle', () => {
  it('mints, rotates, revokes and re-shares', async () => {
    const { planner, userId, tripId, token } = await sharedTrip();
    expect(token).toMatch(TOKEN_RE);
    expect(await planner.getSharedTrip(token)).not.toBeNull();

    // Idempotent: same visibility keeps the token.
    expect((await planner.setVisibility(userId, tripId, 'public')).shareToken).toBe(token);

    const rotated = await planner.rotateShareToken(userId, tripId);
    expect(rotated.shareToken).not.toBe(token);
    expect(await planner.getSharedTrip(token)).toBeNull();
    expect(await planner.getSharedTrip(rotated.shareToken!)).not.toBeNull();

    const revoked = await planner.setVisibility(userId, tripId, 'private');
    expect(revoked).toEqual({ visibility: 'private', shareToken: null, shareTokenCreatedAt: null });
    expect(await planner.getSharedTrip(rotated.shareToken!)).toBeNull();

    const again = await planner.setVisibility(userId, tripId, 'unlisted');
    expect(again.shareToken).not.toBe(rotated.shareToken);
    expect(await planner.revokeShare(userId, tripId)).toMatchObject({ shareToken: null });
    expect(await planner.revokeShare(userId, tripId)).toMatchObject({ shareToken: null });
  });

  it('does not bump the trip version', async () => {
    const { planner, userId, tripId } = await sharedTrip();
    const before = (await planner.getTrip(userId, tripId)).trip.version;
    await planner.rotateShareToken(userId, tripId);
    expect((await planner.getTrip(userId, tripId)).trip.version).toBe(before);
  });

  it('refuses to rotate a private trip and to share an archived one', async () => {
    const planner = makePlanner();
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    await expectCode(planner.rotateShareToken(userId, trip.id), 'invalid_state');
    const archived = await planner.archiveTrip(userId, trip.id, trip.version);
    expect(archived.status).toBe('archived');
    await expectCode(planner.setVisibility(userId, trip.id, 'unlisted'), 'invalid_state');
  });

  it('serves nothing for a shared trip once it is archived', async () => {
    const { planner, userId, tripId, token } = await sharedTrip();
    const { trip } = await planner.getTrip(userId, tripId);
    await planner.archiveTrip(userId, tripId, trip.version);
    expect(await planner.getSharedTrip(token)).toBeNull();
  });

  it('revokes the link on archive, so restoring does not revive it', async () => {
    const { planner, userId, tripId, token } = await sharedTrip('public');
    const { trip } = await planner.getTrip(userId, tripId);
    const archived = await planner.archiveTrip(userId, tripId, trip.version);
    expect(archived).toMatchObject({ visibility: 'private', shareToken: null, shareTokenCreatedAt: null });

    const restored = await planner.restoreTrip(userId, tripId, archived.version);
    expect(restored.trip).toMatchObject({
      status: 'active',
      visibility: 'private',
      shareToken: null,
      shareTokenCreatedAt: null,
    });
    expect(await planner.getSharedTrip(token)).toBeNull();

    const reshared = await planner.setVisibility(userId, tripId, 'unlisted');
    expect(reshared.shareToken).toMatch(TOKEN_RE);
    expect(reshared.shareToken).not.toBe(token);
    expect(await planner.getSharedTrip(token)).toBeNull();
    expect(await planner.getSharedTrip(reshared.shareToken!)).not.toBeNull();
  });

  it('returns null for malformed tokens without a lookup', async () => {
    const { planner } = await sharedTrip();
    for (const bad of ['', 'short', 'a'.repeat(44), `${'a'.repeat(42)}!`, '../etc/passwd']) {
      expect(await planner.getSharedTrip(bad)).toBeNull();
    }
  });
});

describe('public projection', () => {
  it('leaks none of the private fields', async () => {
    const { planner, token } = await sharedTrip();
    const view = await planner.getSharedTrip(token);
    const text = JSON.stringify(view);
    for (const secret of ['ownerId', 'shareToken', 'version', 'expenses', 'ghi chú riêng tư', 'BÍ MẬT', 'usr_', 'trip_', 'day_', 'act_', 'exp_']) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/"(id|tripId|dayId)"/);
    expect(text).not.toContain(token);
    expect(text).toContain('ghi chú hoạt động'); // activity note is part of the contract
  });

  it('exposes exactly the allow-listed keys', async () => {
    const { planner, token } = await sharedTrip();
    const view = (await planner.getSharedTrip(token))!;
    expect(Object.keys(view).sort()).toEqual(
      [
        'attribution', 'budget', 'days', 'destinationSlug', 'durationDays', 'endDate', 'pace',
        'partySize', 'planningStatus', 'startDate', 'title', 'travelStyle', 'visibility',
      ].sort(),
    );
    expect(Object.keys(view.days[0]!).sort()).toEqual(['activities', 'date', 'dayNumber', 'title']);
    expect(Object.keys(view.days[0]!.activities[0]!).sort()).toEqual(
      ['category', 'endTime', 'note', 'order', 'placeSlug', 'startTime', 'title'],
    );
    expect(Object.keys(view.budget).sort()).toEqual(['currency', 'estimatedTotalVnd', 'targetTotalVnd']);
  });

  it('fails when a new Trip field appears that nobody classified', () => {
    // Every Trip field is either projected (listed in `projected`) or
    // deliberately withheld. Adding a field to tripSchema breaks this test until
    // a human decides which, in buildSharedView.
    const projected = [
      'title', 'destinationSlug', 'startDate', 'endDate', 'durationDays', 'partySize',
      'travelStyle', 'pace', 'planningStatus', 'visibility', 'budget', 'sourceTemplate',
    ];
    const withheld = [
      'id', 'ownerId', 'note', 'status', 'archivedAt', 'shareToken', 'shareTokenCreatedAt',
      'duplicatedFromTripId', 'version', 'createdAt', 'updatedAt',
    ];
    expect(Object.keys(tripSchema.shape).sort()).toEqual([...projected, ...withheld].sort());
  });
});

describe('authorization', () => {
  it("treats another traveller's trip as missing for every share and duplicate op", async () => {
    const { planner, tripId } = await sharedTrip();
    const other = await makeOwner(planner, 'nguoi-la');
    await expectCode(planner.setVisibility(other.userId, tripId, 'public'), 'not_found');
    await expectCode(planner.rotateShareToken(other.userId, tripId), 'not_found');
    await expectCode(planner.revokeShare(other.userId, tripId), 'not_found');
    await expectCode(planner.duplicateTrip(other.userId, tripId), 'not_found');
    await expectCode(planner.updateTrip(other.userId, tripId, { planningStatus: 'planned' }, 1), 'not_found');
  });
});

describe('duplicate', () => {
  it('copies into an independent private draft and leaves the source untouched', async () => {
    const { planner, userId, tripId } = await sharedTrip('public');
    const act = (await planner.getTrip(userId, tripId)).days[0]!.activities[0]!;
    await planner.addExpense(userId, tripId, expenseInput({ activityId: act.id }), null);
    const before = JSON.stringify(await planner.getTrip(userId, tripId));

    const copy = await planner.duplicateTrip(userId, tripId, { title: 'Bản của mình' });
    expect(JSON.stringify(await planner.getTrip(userId, tripId))).toBe(before);

    expect(copy.trip).toMatchObject({
      title: 'Bản của mình',
      planningStatus: 'draft',
      visibility: 'private',
      shareToken: null,
      duplicatedFromTripId: tripId,
      version: 1,
      status: 'active',
    });
    const src = await planner.getTrip(userId, tripId);
    const ids = (v: typeof copy) => [
      v.trip.id,
      ...v.days.flatMap((d) => [d.id, ...d.activities.map((a) => a.id)]),
      ...v.expenses.map((e) => e.id),
    ];
    const srcIds = new Set(ids(src));
    expect(ids(copy).filter((id) => srcIds.has(id))).toEqual([]);
    expect(copy.expenses).toHaveLength(src.expenses.length);
    const copyAct = copy.days[0]!.activities[0]!;
    expect(copy.expenses.some((e) => e.activityId === copyAct.id)).toBe(true);
    expect(copy.trip.sourceTemplate).toEqual(src.trip.sourceTemplate);
  });

  it('refuses an archived source', async () => {
    const { planner, userId, tripId } = await sharedTrip();
    const { trip } = await planner.getTrip(userId, tripId);
    await planner.archiveTrip(userId, tripId, trip.version);
    await expectCode(planner.duplicateTrip(userId, tripId), 'invalid_state');
  });
});

describe('template cloning and attribution', () => {
  const linkedStory = { slug: 'di-da-lat-fixture', title: { vi: 'Đi Đà Lạt', en: 'Going to Đà Lạt' } };

  async function seeded() {
    const { content } = await makeSeededPlanner();
    const catalog = createContentCatalog(content, undefined, [
      { ...linkedStory, plannerTemplateSlug: 'da-lat-3-ngay-lang-man' },
    ]);
    const planner = makePlanner({ catalog });
    const { userId } = await makeOwner(planner);
    return { planner, content, userId };
  }

  it('derives the story server-side and never mutates the template', async () => {
    const { planner, content, userId } = await seeded();
    const templateBefore = JSON.stringify(await content.getPublicTemplate('da-lat-3-ngay-lang-man'));

    const view = await planner.createTrip(userId, {
      source: 'template',
      templateSlug: 'da-lat-3-ngay-lang-man',
      startDate: null,
      partySize: 2,
      budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
      note: null,
    });
    expect(view.trip.sourceTemplate?.story).toEqual(linkedStory);

    const act = view.days[0]!.activities[0]!;
    await planner.updateActivity(userId, view.trip.id, act.id, { title: 'Đã sửa' }, view.trip.version);
    await planner.addExpense(userId, view.trip.id, expenseInput(), null);
    expect(JSON.stringify(await content.getPublicTemplate('da-lat-3-ngay-lang-man'))).toBe(templateBefore);

    const share = await planner.setVisibility(userId, view.trip.id, 'public');
    const shared = await planner.getSharedTrip(share.shareToken!);
    expect(shared?.attribution?.story).toEqual(linkedStory);
  });

  it('rejects a client-supplied story or visibility on create', async () => {
    const { tripCreateSchema } = await import('../src/server/planner/schemas');
    const base = {
      source: 'template', templateSlug: 'x-y', partySize: 2, budget: { targetTotalVnd: 1 },
    };
    expect(tripCreateSchema.safeParse({ ...base, story: { slug: 'a' } }).success).toBe(false);
    expect(tripCreateSchema.safeParse({ ...base, visibility: 'public' }).success).toBe(false);
    expect(tripCreateSchema.safeParse({ ...base, shareToken: 'x' }).success).toBe(false);
  });
});

describe('backward compatibility', () => {
  it('reads a stored trip lacking every new field as draft/private/no token', async () => {
    const store0 = createMemoryPlannerStore();
    const planner0 = makePlanner({ store: store0 });
    const { userId } = await makeOwner(planner0);
    const { trip } = await planner0.createTrip(userId, daLatTripInput());
    const old: Record<string, unknown> = { ...trip };
    for (const k of ['planningStatus', 'visibility', 'shareToken', 'shareTokenCreatedAt', 'duplicatedFromTripId']) {
      delete old[k];
    }
    const store = createMemoryPlannerStore({
      ...emptyPlannerData(),
      users: (await store0.read()).users,
      trips: [old as unknown as Trip],
    });
    const planner = makePlanner({ store });
    const read = (await planner.getTrip(userId, trip.id)).trip;
    expect(read).toMatchObject({
      planningStatus: 'draft', visibility: 'private', shareToken: null, duplicatedFromTripId: null,
    });
    expect(tripSchema.safeParse(old).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const ADMIN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let workdir: string;
let r: {
  trips: typeof import('../src/app/api/planner/route');
  trip: typeof import('../src/app/api/planner/[id]/route');
  duplicate: typeof import('../src/app/api/planner/[id]/duplicate/route');
  share: typeof import('../src/app/api/planner/[id]/share/route');
  rotate: typeof import('../src/app/api/planner/[id]/share/rotate/route');
  session: typeof import('../src/app/api/planner/session/route');
  shared: typeof import('../src/app/api/shared/[token]/route');
  adminUsers: typeof import('../src/app/api/admin/planner/users/route');
};

function req(
  path: string,
  o: { method?: string; body?: unknown; bearer?: string; cookie?: string; origin?: string; ip?: string } = {},
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
  if (o.origin) headers.origin = o.origin;
  if (o.ip) headers['x-forwarded-for'] = o.ip;
  return new Request(`${ORIGIN}${path}`, {
    method: o.method ?? 'GET',
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
  });
}
const ctx = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });

async function provision(handle: string): Promise<string> {
  const res = await r.adminUsers.POST(
    req('/api/admin/planner/users', { method: 'POST', bearer: ADMIN, body: { handle, displayName: 'Người đi chơi' } }),
  );
  return ((await res.json()) as { accessToken: string }).accessToken;
}

async function makeTrip(bearer: string): Promise<{ id: string; version: number }> {
  const res = await r.trips.POST(
    req('/api/planner', {
      method: 'POST', bearer,
      body: { source: 'blank', title: 'Đà Lạt 3 ngày', destinationSlug: 'da-lat', startDate: '2026-04-10', durationDays: 3, partySize: 2, budget: { targetTotalVnd: 5_000_000 } },
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { trip: { id: string; version: number } };
  return body.trip;
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-sharing-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN;
  r = {
    trips: await import('../src/app/api/planner/route'),
    trip: await import('../src/app/api/planner/[id]/route'),
    duplicate: await import('../src/app/api/planner/[id]/duplicate/route'),
    share: await import('../src/app/api/planner/[id]/share/route'),
    rotate: await import('../src/app/api/planner/[id]/share/rotate/route'),
    session: await import('../src/app/api/planner/session/route'),
    shared: await import('../src/app/api/shared/[token]/route'),
    adminUsers: await import('../src/app/api/admin/planner/users/route'),
  };
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('HTTP: share endpoints', () => {
  it('runs the lifecycle and answers every miss with the same 404', async () => {
    const bearer = await provision('chu-chuyen-di');
    const { id } = await makeTrip(bearer);

    const put = await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', bearer, body: { visibility: 'unlisted' } }), ctx({ id }));
    expect(put.status).toBe(200);
    const { shareToken } = (await put.json()) as { shareToken: string };
    expect(shareToken).toMatch(TOKEN_RE);

    const ok = await r.shared.GET(req(`/api/shared/${shareToken}`, { ip: '10.0.0.1' }), ctx({ token: shareToken }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('private, no-store');
    expect(ok.headers.get('referrer-policy')).toBe('no-referrer');
    expect(ok.headers.get('x-robots-tag')).toBe('noindex');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');

    const rotate = await r.rotate.POST(req(`/api/planner/${id}/share/rotate`, { method: 'POST', bearer }), ctx({ id }));
    const fresh = ((await rotate.json()) as { shareToken: string }).shareToken;
    const stale = await r.shared.GET(req(`/api/shared/${shareToken}`, { ip: '10.0.0.1' }), ctx({ token: shareToken }));
    expect(stale.status).toBe(404);

    await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', bearer, body: { visibility: 'public' } }), ctx({ id }));
    const pub = await r.shared.GET(req(`/api/shared/${fresh}`, { ip: '10.0.0.1' }), ctx({ token: fresh }));
    expect(pub.status).toBe(200);
    expect(pub.headers.get('x-robots-tag')).toBeNull();

    const del = await r.share.DELETE(req(`/api/planner/${id}/share`, { method: 'DELETE', bearer }), ctx({ id }));
    expect(await del.json()).toEqual({ visibility: 'private', shareToken: null, shareTokenCreatedAt: null });

    // Revoked, malformed, unknown and private-with-valid-format: identical.
    const unknown = 'A'.repeat(43);
    const misses = [] as Array<{ status: number; body: string; cc: string | null; rp: string | null }>;
    for (const t of [fresh, 'short', unknown, `${'b'.repeat(42)}!`]) {
      const res = await r.shared.GET(req(`/api/shared/${t}`, { ip: '10.0.0.2' }), ctx({ token: t }));
      misses.push({ status: res.status, body: await res.text(), cc: res.headers.get('cache-control'), rp: res.headers.get('referrer-policy') });
    }
    expect(new Set(misses.map((m) => JSON.stringify(m))).size).toBe(1);
    expect(misses[0]!.status).toBe(404);
    expect(misses[0]!.cc).toBe('private, no-store');
  });

  it('exports GET only on the public route', () => {
    const methods = Object.keys(r.shared).filter((k) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(k));
    expect(methods).toEqual([]);
  });

  it('enforces auth, ownership and CSRF', async () => {
    const owner = await provision('owner-a');
    const other = await provision('owner-b');
    const { id, version } = await makeTrip(owner);
    const c = ctx({ id });

    expect((await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', body: { visibility: 'public' } }), c)).status).toBe(401);
    expect((await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', bearer: other, body: { visibility: 'public' } }), c)).status).toBe(404);
    expect((await r.rotate.POST(req(`/api/planner/${id}/share/rotate`, { method: 'POST', bearer: other }), c)).status).toBe(404);
    expect((await r.share.DELETE(req(`/api/planner/${id}/share`, { method: 'DELETE', bearer: other }), c)).status).toBe(404);
    expect((await r.duplicate.POST(req(`/api/planner/${id}/duplicate`, { method: 'POST', bearer: other }), c)).status).toBe(404);
    const patch = new Request(`${ORIGIN}/api/planner/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${other}`, 'content-type': 'application/json', 'if-match': `"${version}"` },
      body: JSON.stringify({ planningStatus: 'planned' }),
    });
    expect((await r.trip.PATCH(patch, c)).status).toBe(404);

    // Cookie-authenticated cross-origin write is refused by the existing CSRF rule.
    const signIn = await r.session.POST(req('/api/planner/session', { method: 'POST', body: { accessToken: owner }, ip: '10.1.1.1' }));
    const cookie = /planner_session=([^;]+)/.exec(signIn.headers.get('set-cookie')!)![1]!;
    const cross = await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', cookie, origin: 'https://evil.test', body: { visibility: 'public' } }), c);
    expect(cross.status).toBe(403);
  });

  it('rejects mass assignment on share, create, patch and duplicate bodies', async () => {
    const bearer = await provision('mass-assign');
    const { id, version } = await makeTrip(bearer);
    const c = ctx({ id });

    for (const body of [{ visibility: 'public', shareToken: 'x'.repeat(43) }, { visibility: 'nope' }, {}]) {
      const res = await r.share.PUT(req(`/api/planner/${id}/share`, { method: 'PUT', bearer, body }), c);
      expect(res.status).toBe(422);
    }
    const dup = await r.duplicate.POST(req(`/api/planner/${id}/duplicate`, { method: 'POST', bearer, body: { visibility: 'public' } }), c);
    expect(dup.status).toBe(422);
    const patch = await r.trip.PATCH(
      new Request(`${ORIGIN}/api/planner/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'if-match': `"${version}"` },
        body: JSON.stringify({ shareToken: 'x'.repeat(43) }),
      }),
      c,
    );
    expect(patch.status).toBe(422);
    const create = await r.trips.POST(
      req('/api/planner', { method: 'POST', bearer, body: { source: 'blank', title: 'Đà Lạt', destinationSlug: 'da-lat', durationDays: 2, partySize: 2, budget: { targetTotalVnd: 1 }, visibility: 'public' } }),
    );
    expect(create.status).toBe(422);
  });

  it('duplicates with no body and with a title', async () => {
    const bearer = await provision('duper');
    const { id } = await makeTrip(bearer);
    const a = await r.duplicate.POST(new Request(`${ORIGIN}/api/planner/${id}/duplicate`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } }), ctx({ id }));
    expect(a.status).toBe(201);
    const b = await r.duplicate.POST(req(`/api/planner/${id}/duplicate`, { method: 'POST', bearer, body: { title: 'Chuyến mới' } }), ctx({ id }));
    expect(((await b.json()) as { trip: { title: string; id: string } }).trip.title).toBe('Chuyến mới');
  });

  it('PATCHes planningStatus under the existing If-Match rules', async () => {
    const bearer = await provision('status-setter');
    const { id, version } = await makeTrip(bearer);
    const mk = (ifMatch?: string) =>
      new Request(`${ORIGIN}/api/planner/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', ...(ifMatch ? { 'if-match': ifMatch } : {}) },
        body: JSON.stringify({ planningStatus: 'planned' }),
      });
    expect((await r.trip.PATCH(mk(), ctx({ id }))).status).toBe(428);
    expect((await r.trip.PATCH(mk('"99"'), ctx({ id }))).status).toBe(412);
    const ok = await r.trip.PATCH(mk(`"${version}"`), ctx({ id }));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { trip: { planningStatus: string } }).trip.planningStatus).toBe('planned');
  });
});

describe('HTTP: session probe and rate limits', () => {
  it('GET /session answers 200 with cookie and bearer, 401 without, and carries no token', async () => {
    const bearer = await provision('prober');
    const signIn = await r.session.POST(req('/api/planner/session', { method: 'POST', body: { accessToken: bearer }, ip: '10.2.2.2' }));
    const cookie = /planner_session=([^;]+)/.exec(signIn.headers.get('set-cookie')!)![1]!;

    const viaCookie = await r.session.GET(req('/api/planner/session', { cookie }));
    expect(viaCookie.status).toBe(200);
    const body = (await viaCookie.json()) as { user: { id: string; displayName: string }; expiresAt: string | null };
    expect(body.user.displayName).toBe('Người đi chơi');
    expect(typeof body.expiresAt).toBe('string');
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(cookie);
    expect(raw).not.toContain(bearer);
    expect(raw).not.toContain('tokenHash');

    const viaBearer = await r.session.GET(req('/api/planner/session', { bearer }));
    expect(viaBearer.status).toBe(200);
    expect(((await viaBearer.json()) as { expiresAt: unknown }).expiresAt).toBeNull();

    expect((await r.session.GET(req('/api/planner/session'))).status).toBe(401);
  });

  it('rate-limits the public read with 429, Retry-After and the envelope', async () => {
    const token = 'C'.repeat(43);
    let last: Response | null = null;
    for (let i = 0; i < 61; i++) {
      last = await r.shared.GET(req(`/api/shared/${token}`, { ip: '10.9.9.9' }), ctx({ token }));
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(((await last!.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    // A different client is unaffected.
    const other = await r.shared.GET(req(`/api/shared/${token}`, { ip: '10.9.9.10' }), ctx({ token }));
    expect(other.status).toBe(404);
  });

  it('rate-limits sign-in with 429 and Retry-After', async () => {
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) {
      last = await r.session.POST(req('/api/planner/session', { method: 'POST', body: { accessToken: 'z'.repeat(40) }, ip: '10.8.8.8' }));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(((await last!.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
  });
});

describe('share index (W3)', () => {
  function countingStore() {
    const inner = createMemoryPlannerStore(emptyPlannerData());
    const counter = { reads: 0 };
    const store = {
      read: () => {
        counter.reads += 1;
        return inner.read();
      },
      write: (next: Parameters<typeof inner.write>[0]) => inner.write(next),
    };
    return { store, counter };
  }

  it('a wrong guess costs no store read once the index is warm', async () => {
    const { store, counter } = countingStore();
    const planner = makePlanner({ store });
    const { userId } = await makeOwner(planner);
    const { trip } = await planner.createTrip(userId, daLatTripInput());
    const { shareToken } = await planner.setVisibility(userId, trip.id, 'unlisted');

    expect(await planner.getSharedTrip(shareToken!)).not.toBeNull(); // warms the index
    const before = counter.reads;
    for (let i = 0; i < 20; i++) {
      expect(await planner.getSharedTrip(`${'A'.repeat(42)}${i % 10}`)).toBeNull();
    }
    expect(counter.reads).toBe(before);
  });

  it('archiving, rotating and revoking take effect through a warm index', async () => {
    const { planner, userId, tripId, token } = await sharedTrip();
    expect(await planner.getSharedTrip(token)).not.toBeNull();

    const { trip } = await planner.getTrip(userId, tripId);
    const archived = await planner.archiveTrip(userId, tripId, trip.version);
    expect(await planner.getSharedTrip(token)).toBeNull();

    await planner.restoreTrip(userId, tripId, archived.version);
    expect(await planner.getSharedTrip(token)).toBeNull();

    const reshared = await planner.setVisibility(userId, tripId, 'unlisted');
    expect(await planner.getSharedTrip(reshared.shareToken!)).not.toBeNull();

    const rotated = await planner.rotateShareToken(userId, tripId);
    expect(await planner.getSharedTrip(reshared.shareToken!)).toBeNull();
    expect(await planner.getSharedTrip(rotated.shareToken!)).not.toBeNull();

    await planner.revokeShare(userId, tripId);
    expect(await planner.getSharedTrip(rotated.shareToken!)).toBeNull();
  });
});
