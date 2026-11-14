import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { can, ROLE_ACTIONS, userRole, type Action } from '../src/server/identity/permissions';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';

/** ADR 0006 steps 1–2: the role field, the permission map, the promote route. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
const FORBIDDEN_KEYS = ['tokenHash', 'passwordHash', 'googleSub'];

let workdir: string;
let routes: {
  trips: typeof import('../src/app/api/planner/route');
  trip: typeof import('../src/app/api/planner/[id]/route');
  session: typeof import('../src/app/api/planner/session/route');
  users: typeof import('../src/app/api/admin/planner/users/route');
  user: typeof import('../src/app/api/admin/planner/users/[userId]/route');
};

function req(o: { method?: string; path?: string; body?: unknown; bearer?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) {
    headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
    headers.origin = ORIGIN;
  }
  return new Request(`${ORIGIN}${o.path ?? '/api/admin/planner/users'}`, {
    method: o.method ?? 'GET',
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
  });
}
const params = (userId: string) => ({ params: Promise.resolve({ userId }) });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

async function create(handle: string, extra: Record<string, unknown> = {}) {
  const response = await routes.users.POST(
    req({ method: 'POST', bearer: ADMIN_TOKEN, body: { handle, displayName: 'Người đi chơi', ...extra } }),
  );
  return { response, body: await response.json() };
}

const patch = (id: string, body: unknown, bearer: string | null = ADMIN_TOKEN, cookie?: string) =>
  routes.user.PATCH(
    req({ method: 'PATCH', path: `/api/admin/planner/users/${id}`, body, bearer: bearer ?? undefined, cookie }),
    params(id),
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-roles-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  routes = {
    trips: await import('../src/app/api/planner/route'),
    trip: await import('../src/app/api/planner/[id]/route'),
    session: await import('../src/app/api/planner/session/route'),
    users: await import('../src/app/api/admin/planner/users/route'),
    user: await import('../src/app/api/admin/planner/users/[userId]/route'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('role resolution', () => {
  it('reads a legacy row without role as member, and does not rewrite it', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const { accessToken } = await planner.createUser({ handle: 'legacy', displayName: 'Legacy user' });
    const data = await store.read();
    expect('role' in data.users[0]!).toBe(false);
    const before = JSON.stringify(data);

    expect((await planner.listUsers())[0]!.role).toBe('member');
    const identity = await planner.identify(
      new Request(ORIGIN, { headers: { authorization: `Bearer ${accessToken}` } }),
    );
    expect(identity.role).toBe('member');
    expect(JSON.stringify(await store.read())).toBe(before);
    expect(userRole({})).toBe('member');
  });

  it('identify returns the stored role on the bearer and the cookie path', async () => {
    const planner = makePlanner();
    for (const role of ['editor', 'admin'] as const) {
      const { user, accessToken } = await planner.createUser({
        handle: `r-${role}`,
        displayName: 'Người đi chơi',
        role,
      });
      expect(user.role).toBe(role);
      const bearer = await planner.identify(
        new Request(ORIGIN, { headers: { authorization: `Bearer ${accessToken}` } }),
      );
      expect(bearer).toMatchObject({ source: 'bearer', role });

      const session = await planner.signIn(accessToken);
      const cookie = await planner.identify(
        new Request(ORIGIN, { headers: { cookie: `${SESSION_COOKIE}=${session.token}` } }),
      );
      expect(cookie).toMatchObject({ source: 'cookie', role });
    }
  });
});

describe('can', () => {
  const actions: Action[] = ['user:provision', 'user:promote', 'template:write', 'story:publish', 'content:write', 'community:moderate', 'trip:support-read'];

  it('matches the declared matrix for every role and action', () => {
    const expected: Record<string, Action[]> = {
      member: [],
      editor: ['template:write', 'story:publish', 'content:write', 'community:moderate'],
      admin: ['template:write', 'story:publish', 'content:write', 'community:moderate', 'user:provision', 'user:promote'],
      service: ['template:write', 'story:publish', 'content:write', 'community:moderate', 'user:provision', 'user:promote'],
    };
    for (const [role, allowed] of Object.entries(expected)) {
      for (const action of actions) {
        expect(can({ role: role as 'member' }, action), `${role} ${action}`).toBe(allowed.includes(action));
      }
    }
  });

  it('denies trip:support-read to everyone, and unknown roles everything', () => {
    for (const role of Object.keys(ROLE_ACTIONS)) {
      expect(can({ role: role as 'admin' }, 'trip:support-read')).toBe(false);
    }
    for (const action of actions) {
      expect(can({ role: 'superuser' as 'admin' }, action)).toBe(false);
      expect(can({ role: 'toString' as 'admin' }, action)).toBe(false);
    }
    expect(can({ role: 'admin' }, 'nope' as Action)).toBe(false);
  });
});

describe('PATCH /api/admin/planner/users/[userId]', () => {
  it('promotes, and a repeat is a 200 that does not bump updatedAt', async () => {
    const { body } = await create('promote-me');
    const id = body.user.id as string;
    expect(body.user.role).toBe('member');

    const first = await patch(id, { role: 'admin' });
    expect(first.status).toBe(200);
    const promoted = (await first.json()).user;
    expect(promoted.role).toBe('admin');

    const again = await patch(id, { role: 'admin' });
    expect(again.status).toBe(200);
    expect((await again.json()).user).toEqual(promoted);
  });

  it('allows demotion and keeps existing sessions working', async () => {
    const { body } = await create('demote-me', { role: 'admin' });
    const id = body.user.id as string;
    expect((await (await patch(id, { role: 'member' })).json()).user.role).toBe('member');
  });

  it('returns 404 for an unknown user', async () => {
    const response = await patch('usr_missing', { role: 'admin' });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('not_found');
  });

  it('returns 401 with no token or a wrong token, and 403 for a member session', async () => {
    const { body } = await create('gate-target');
    const id = body.user.id as string;
    expect((await patch(id, { role: 'admin' }, null)).status).toBe(401);
    expect((await patch(id, { role: 'admin' }, 'wrong-token-wrong-token-wrong-token-1')).status).toBe(401);

    const member = await create('gate-member');
    const sessionResponse = await routes.session.POST(
      new Request(`${ORIGIN}/api/planner/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken: member.body.accessToken }),
      }),
    );
    const cookie = sessionResponse.headers.get('set-cookie')!.split(';')[0]!.split('=')[1]!;
    // ADR 0010: a signed-in member is authenticated but not permitted.
    expect((await patch(id, { role: 'admin' }, null, cookie)).status).toBe(403);
    // Nothing was promoted by any of the refused calls.
    const listed = (await (await routes.users.GET(req({ bearer: ADMIN_TOKEN }))).json()).users;
    expect(listed.find((u: { id: string }) => u.id === id).role).toBe('member');
  });

  it('returns 422 (validation_failed) for an invalid role, a missing role and an extra key', async () => {
    const { body } = await create('bad-body');
    const id = body.user.id as string;
    for (const bad of [{ role: 'root' }, {}, { role: 'admin', email: 'a@b.co' }, { role: 'admin', tokenHash: 'x' }]) {
      const response = await patch(id, bad);
      expect(response.status, JSON.stringify(bad)).toBe(422);
      expect((await response.json()).error.code).toBe('validation_failed');
    }
  });
});

describe('POST /api/admin/planner/users role', () => {
  it('persists an explicit role, defaults to member, rejects an invalid one', async () => {
    const admin = await create('made-admin', { role: 'admin' });
    expect(admin.response.status).toBe(201);
    expect(admin.body.user.role).toBe('admin');
    expect((await create('made-default')).body.user.role).toBe('member');
    expect((await create('made-bad', { role: 'owner' })).response.status).toBe(422);
  });

  it('rejects an unknown key instead of stripping it', async () => {
    const extra = await create('made-extra', { role: 'admin', tokenHash: 'x'.repeat(64) });
    expect(extra.response.status).toBe(422);
    expect(extra.body.error.code).toBe('validation_failed');
  });
});

describe('roles do not widen trip access', () => {
  it('rejects the admin token on trips, and an admin-role session gets not_found on another trip', async () => {
    expect((await routes.trips.GET(req({ path: '/api/planner', bearer: ADMIN_TOKEN }))).status).toBe(401);

    const owner = await create('trip-owner');
    const tripResponse = await routes.trips.POST(
      req({
        method: 'POST',
        path: '/api/planner',
        bearer: owner.body.accessToken,
        body: {
          source: 'blank',
          title: 'Đà Lạt 3 ngày 2 đêm',
          destinationSlug: 'da-lat',
          startDate: '2026-04-10',
          durationDays: 3,
          partySize: 2,
          budget: { targetTotalVnd: 5_000_000 },
        },
      }),
    );
    expect(tripResponse.status).toBe(201);
    const tripId = (await tripResponse.json()).trip.id as string;

    const admin = await create('trip-admin', { role: 'admin' });
    const read = await routes.trip.GET(
      req({ path: `/api/planner/${tripId}`, bearer: admin.body.accessToken }),
      idParams(tripId),
    );
    expect(read.status).toBe(404);
    expect((await read.json()).error.code).toBe('not_found');
  });
});

describe('public user JSON', () => {
  it('never carries a credential, on create, PATCH, list and Google-created users', async () => {
    const created = await create('leak-check', { email: 'leak@example.com', role: 'editor' });
    const patched = await patch(created.body.user.id, { role: 'admin' });
    const listed = await routes.users.GET(req({ bearer: ADMIN_TOKEN }));

    const planner = makePlanner();
    const google = await planner.signInWithGoogle(
      { sub: 'sub-123', email: 'g@example.com', name: 'G' },
      { signupEnabled: true },
    );
    if (!google.ok) throw new Error('google sign-in failed');

    const texts = [
      JSON.stringify(created.body.user),
      JSON.stringify((await patched.json()).user),
      JSON.stringify((await listed.json()).users),
      JSON.stringify(google.session.user),
    ];
    for (const text of texts) {
      for (const key of FORBIDDEN_KEYS) expect(text).not.toContain(key);
    }
  });

  it('gives a first Google sign-in the member role', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const result = await planner.signInWithGoogle(
      { sub: 'sub-456', email: 'new@example.com', name: 'New' },
      { signupEnabled: true },
    );
    expect(result).toMatchObject({ ok: true, created: true });
    if (!result.ok) throw new Error('unreachable');
    expect(result.session.user.role).toBe('member');
    expect((await store.read()).users[0]!.role).toBe('member');
  });
});
