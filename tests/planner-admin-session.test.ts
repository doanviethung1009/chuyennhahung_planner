import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { makeClock, makePlanner } from './planner-helpers';

// The routes and the page read the process-wide repository, which would hash at
// the production scrypt cost (N = 2^17, 128 MiB, ~0.75 s a hash uncontended).
// Alongside the other suites doing the same, that pushed a test here past the
// 5 s timeout. Nothing in this file is about the hash cost — that is
// tests/planner-password.test.ts — so new hashes here use N = 2^10.
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** ADR 0010: browser-session admins on the opted-in user routes. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

let workdir: string;
let routes: {
  users: typeof import('../src/app/api/admin/planner/users/route');
  user: typeof import('../src/app/api/admin/planner/users/[userId]/route');
  reset: typeof import('../src/app/api/admin/planner/users/[userId]/reset-password/route');
  rotate: typeof import('../src/app/api/admin/planner/users/[userId]/rotate-token/route');
  google: typeof import('../src/app/api/admin/planner/users/[userId]/google/route');
  integrity: typeof import('../src/app/api/admin/planner/integrity/route');
};
let http: typeof import('../src/server/planner/http');
let instance: typeof import('../src/server/planner/instance');

interface Opts {
  method?: string;
  path?: string;
  body?: unknown;
  bearer?: string;
  cookie?: string;
  origin?: string | null;
  fetchSite?: string;
}

function req(o: Opts = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
  const origin = o.origin === undefined ? (o.cookie ? ORIGIN : null) : o.origin;
  if (origin) headers.origin = origin;
  if (o.fetchSite) headers['sec-fetch-site'] = o.fetchSite;
  return new Request(`${ORIGIN}${o.path ?? '/api/admin/planner/users'}`, {
    method: o.method ?? 'GET',
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
  });
}
const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

let counter = 0;
/** Creates a user through the repository and returns a live browser session for them. */
async function makeUser(role: 'member' | 'editor' | 'admin', extra: Record<string, unknown> = {}) {
  const repo = await instance.getPlannerRepository();
  const handle = `adm-${role}-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;
  const issued = await repo.createUser({ handle, displayName: 'Người quản trị', role, ...extra });
  const session = await repo.signIn(issued.accessToken);
  return { id: issued.user.id, accessToken: issued.accessToken, cookie: session.token, issued };
}

const patchRole = (id: string, role: string, o: Opts = {}) =>
  routes.user.PATCH(
    req({ method: 'PATCH', path: `/api/admin/planner/users/${id}`, body: { role }, ...o }),
    params(id),
  );
const resetPw = (id: string, o: Opts = {}) =>
  routes.reset.POST(
    req({ method: 'POST', path: `/api/admin/planner/users/${id}/reset-password`, ...o }),
    params(id),
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-admin-session-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  routes = {
    users: await import('../src/app/api/admin/planner/users/route'),
    user: await import('../src/app/api/admin/planner/users/[userId]/route'),
    reset: await import('../src/app/api/admin/planner/users/[userId]/reset-password/route'),
    rotate: await import('../src/app/api/admin/planner/users/[userId]/rotate-token/route'),
    google: await import('../src/app/api/admin/planner/users/[userId]/google/route'),
    integrity: await import('../src/app/api/admin/planner/integrity/route'),
  };
  http = await import('../src/server/planner/http');
  instance = await import('../src/server/planner/instance');
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('principal resolution on the opted-in routes', () => {
  it('accepts the service token (unchanged) and an admin cookie, with no-store and no hashes', async () => {
    const admin = await makeUser('admin');
    for (const o of [{ bearer: ADMIN_TOKEN }, { cookie: admin.cookie }]) {
      const response = await routes.users.GET(req(o));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const text = JSON.stringify(await response.json());
      for (const key of ['tokenHash', 'passwordHash', 'googleSub']) expect(text).not.toContain(key);
    }
  });

  it('lets an admin session create a user and shows the one-time secrets once', async () => {
    const admin = await makeUser('admin');
    const response = await routes.users.POST(
      req({
        method: 'POST',
        cookie: admin.cookie,
        body: { handle: `made-${Date.now()}`, displayName: 'Người mới', email: `n${Date.now()}@example.test`, role: 'member' },
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.temporaryPassword).toBe('string');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const listed = JSON.stringify(await (await routes.users.GET(req({ cookie: admin.cookie }))).json());
    expect(listed).not.toContain(body.accessToken);
    expect(listed).not.toContain(body.temporaryPassword);
  });

  it('refuses member and editor sessions with 403, and no credential with 401', async () => {
    const member = await makeUser('member');
    const editor = await makeUser('editor');
    for (const who of [member, editor]) {
      const response = await routes.users.GET(req({ cookie: who.cookie }));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('forbidden');
      expect((await patchRole(member.id, 'admin', { cookie: who.cookie })).status).toBe(403);
      expect((await resetPw(member.id, { cookie: who.cookie })).status).toBe(403);
    }
    const none = await routes.users.GET(req());
    expect(none.status).toBe(401);
    expect((await none.json()).error.code).toBe('unauthorized');
    expect((await routes.users.GET(req({ cookie: 'not-a-real-session-token-not-a-real-one' }))).status).toBe(401);
  });

  it('never accepts a planner access token (even an admin user’s own) as an admin credential', async () => {
    const admin = await makeUser('admin');
    const response = await routes.users.GET(req({ bearer: admin.accessToken }));
    expect(response.status).toBe(401);
    // An Authorization header means token path only: a valid cookie beside it does not rescue it.
    const both = await routes.users.GET(req({ bearer: admin.accessToken, cookie: admin.cookie }));
    expect(both.status).toBe(401);
  });

  it('keeps rotate-token, DELETE, google unlink and integrity token-only', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('member');
    const id = target.id;
    const responses = [
      await routes.rotate.POST(
        req({ method: 'POST', path: `/api/admin/planner/users/${id}/rotate-token`, cookie: admin.cookie }),
        params(id),
      ),
      await routes.user.DELETE(
        req({ method: 'DELETE', path: `/api/admin/planner/users/${id}`, cookie: admin.cookie }),
        params(id),
      ),
      await routes.google.DELETE(
        req({ method: 'DELETE', path: `/api/admin/planner/users/${id}/google`, cookie: admin.cookie }),
        params(id),
      ),
      await routes.integrity.GET(req({ path: '/api/admin/planner/integrity', cookie: admin.cookie })),
    ];
    for (const response of responses) expect([401, 403]).toContain(response.status);
    // And the target is intact.
    const listed = (await (await routes.users.GET(req({ bearer: ADMIN_TOKEN }))).json()).users;
    expect(listed.some((u: { id: string }) => u.id === id)).toBe(true);
  });
});

describe('same-origin on cookie mutations', () => {
  it('refuses a cookie mutation with no Origin and no Sec-Fetch-Site (403)', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('member');
    const response = await patchRole(target.id, 'editor', { cookie: admin.cookie, origin: null });
    expect(response.status).toBe(403);
    const check = await routes.users.GET(req({ bearer: ADMIN_TOKEN }));
    expect((await check.json()).users.find((u: { id: string }) => u.id === target.id).role).toBe('member');
  });

  it('refuses a cross-site Origin and a cross-site Sec-Fetch-Site (403)', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('member');
    expect((await patchRole(target.id, 'editor', { cookie: admin.cookie, origin: 'https://evil.test' })).status).toBe(403);
    expect(
      (await patchRole(target.id, 'editor', { cookie: admin.cookie, origin: null, fetchSite: 'cross-site' })).status,
    ).toBe(403);
    expect((await patchRole(target.id, 'editor', { cookie: admin.cookie, origin: null, fetchSite: 'same-origin' })).status).toBe(200);
  });

  it('does not require an Origin for the service token (curl keeps working)', async () => {
    const target = await makeUser('member');
    expect((await patchRole(target.id, 'editor', { bearer: ADMIN_TOKEN })).status).toBe(200);
  });
});

describe('role is read from the store on every request', () => {
  it('a demoted admin loses access on the very next request', async () => {
    const admin = await makeUser('admin');
    expect((await routes.users.GET(req({ cookie: admin.cookie }))).status).toBe(200);
    // Another admin exists, so the demotion is allowed.
    await makeUser('admin');
    expect((await patchRole(admin.id, 'member', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await routes.users.GET(req({ cookie: admin.cookie }))).status).toBe(403);
  });

  it('a promoted member gains access on the next request', async () => {
    const member = await makeUser('member');
    expect((await routes.users.GET(req({ cookie: member.cookie }))).status).toBe(403);
    expect((await patchRole(member.id, 'admin', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await routes.users.GET(req({ cookie: member.cookie }))).status).toBe(200);
  });
});

describe('temporary-password gate', () => {
  it('blocks an admin whose session was opened with an operator-issued password', async () => {
    const repo = await instance.getPlannerRepository();
    const email = `gate${Date.now()}@example.test`;
    const issued = await repo.createUser({
      handle: `gate-${Date.now()}`,
      displayName: 'Quản trị tạm',
      email,
      role: 'admin',
    });
    const session = await repo.signInWithPassword(email, issued.temporaryPassword!);
    const response = await routes.users.GET(req({ cookie: session.token }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('password_change_required');
  });
});

describe('lockout guards', () => {
  it('refuses a session principal changing its own role or resetting its own password (409)', async () => {
    const admin = await makeUser('admin', { email: `self${Date.now()}@example.test` });
    await makeUser('admin');
    const demote = await patchRole(admin.id, 'member', { cookie: admin.cookie });
    expect(demote.status).toBe(409);
    expect((await demote.json()).error.code).toBe('invalid_state');
    expect((await patchRole(admin.id, 'admin', { cookie: admin.cookie })).status).toBe(409);
    expect((await resetPw(admin.id, { cookie: admin.cookie })).status).toBe(409);
  });

  it('allows admin-to-admin password reset and role change', async () => {
    const a = await makeUser('admin');
    const b = await makeUser('admin', { email: `peer${Date.now()}@example.test` });
    const reset = await resetPw(b.id, { cookie: a.cookie });
    expect(reset.status).toBe(200);
    expect(typeof (await reset.json()).temporaryPassword).toBe('string');
    expect((await patchRole(b.id, 'editor', { cookie: a.cookie })).status).toBe(200);
  });

  it('never leaves zero admins: demoting or deleting the last one is 409, token included', async () => {
    const store = (await instance.getPlannerRepository());
    // Demote everyone except one so exactly one admin remains.
    const users = await store.listUsers();
    const admins = users.filter((u) => u.role === 'admin');
    for (const u of admins.slice(1)) await store.setUserRole(u.id, 'member');
    const last = admins[0]!;
    const demote = await patchRole(last.id, 'member', { bearer: ADMIN_TOKEN });
    expect(demote.status).toBe(409);
    expect((await demote.json()).error.code).toBe('invalid_state');
    const del = await routes.user.DELETE(
      req({ method: 'DELETE', path: `/api/admin/planner/users/${last.id}`, bearer: ADMIN_TOKEN }),
      params(last.id),
    );
    expect(del.status).toBe(409);
    // Idempotent same-role write is still fine.
    expect((await patchRole(last.id, 'admin', { bearer: ADMIN_TOKEN })).status).toBe(200);
  });

  it('concurrent demotion of two admins leaves exactly one', async () => {
    const planner = makePlanner();
    const a = await planner.createUser({ handle: 'conc-a', displayName: 'Admin A', role: 'admin' });
    const b = await planner.createUser({ handle: 'conc-b', displayName: 'Admin B', role: 'admin' });
    const results = await Promise.allSettled([
      planner.setUserRole(a.user.id, 'member', { userId: b.user.id }),
      planner.setUserRole(b.user.id, 'member', { userId: a.user.id }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const admins = (await planner.listUsers()).filter((u) => u.role === 'admin');
    expect(admins).toHaveLength(1);
  });

  it('refuses a stale actor inside the transaction (demoted between check and write)', async () => {
    const planner = makePlanner();
    const a = await planner.createUser({ handle: 'stale-a', displayName: 'Admin A', role: 'admin' });
    const b = await planner.createUser({ handle: 'stale-b', displayName: 'Admin B', role: 'admin' });
    const c = await planner.createUser({ handle: 'stale-c', displayName: 'Member C' });
    await planner.setUserRole(a.user.id, 'member');
    await expect(planner.setUserRole(c.user.id, 'editor', { userId: a.user.id })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(planner.setUserRole(c.user.id, 'editor', { userId: b.user.id })).resolves.toBeTruthy();
  });
});

describe('session lifetimes by role (ADR 0010 §4)', () => {
  const cookieRequest = (token: string) =>
    new Request(ORIGIN, { headers: { cookie: `${SESSION_COOKIE}=${token}` } });

  async function sessionFor(role: 'member' | 'admin') {
    const clock = makeClock();
    const planner = makePlanner({ now: clock.now });
    const { accessToken, user } = await planner.createUser({ handle: `life-${role}`, displayName: 'Người dùng', role });
    const { token } = await planner.signIn(accessToken);
    return { clock, planner, token, user };
  }

  it('admin: idle 2 h ends the session, activity within the window keeps it', async () => {
    const { clock, planner, token } = await sessionFor('admin');
    clock.advanceMinutes(110);
    await expect(planner.identify(cookieRequest(token))).resolves.toMatchObject({ role: 'admin' });
    clock.advanceMinutes(110);
    // 110 min since the last use: still inside 2 h.
    await expect(planner.identify(cookieRequest(token))).resolves.toMatchObject({ role: 'admin' });
    clock.advanceMinutes(121);
    await expect(planner.identify(cookieRequest(token))).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('admin: absolute 12 h ends even a continuously used session', async () => {
    const { clock, planner, token } = await sessionFor('admin');
    for (let i = 0; i < 11; i += 1) {
      clock.advanceMinutes(60);
      await planner.identify(cookieRequest(token));
    }
    clock.advanceMinutes(61); // 12 h 1 min after sign-in
    await expect(planner.identify(cookieRequest(token))).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('member keeps 7 days idle / 14 days absolute', async () => {
    const { clock, planner, token } = await sessionFor('member');
    clock.advanceDays(6);
    await expect(planner.identify(cookieRequest(token))).resolves.toMatchObject({ role: 'member' });
    clock.advanceDays(6);
    await expect(planner.identify(cookieRequest(token))).resolves.toMatchObject({ role: 'member' });
    clock.advanceDays(3);
    await expect(planner.identify(cookieRequest(token))).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('promotion shortens the lifetime and demotion restores it', async () => {
    const { clock, planner, token, user } = await sessionFor('member');
    await planner.createUser({ handle: 'life-other-admin', displayName: 'Admin khác', role: 'admin' });
    await planner.setUserRole(user.id, 'admin');
    clock.advanceMinutes(150);
    await expect(planner.identify(cookieRequest(token))).rejects.toMatchObject({ code: 'unauthorized' });

    const again = await sessionFor('admin');
    await again.planner.createUser({ handle: 'life-keeper', displayName: 'Admin giữ', role: 'admin' });
    await again.planner.setUserRole(again.user.id, 'member');
    again.clock.advanceMinutes(150);
    await expect(again.planner.identify(cookieRequest(again.token))).resolves.toMatchObject({ role: 'member' });
  });
});

describe('rate limit on session admin mutations', () => {
  it('answers 429 with Retry-After after 30 mutations a minute, per user; reads are not counted', async () => {
    const admin = await makeUser('admin');
    const other = await makeUser('admin');
    const target = await makeUser('member');
    for (let i = 0; i < 10; i += 1) await routes.users.GET(req({ cookie: admin.cookie }));
    for (let i = 0; i < 30; i += 1) {
      const response = await patchRole(target.id, 'editor', { cookie: admin.cookie });
      expect(response.status).toBe(200);
    }
    const limited = await patchRole(target.id, 'editor', { cookie: admin.cookie });
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('rate_limited');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    // Another user, and the service token, are unaffected.
    expect((await patchRole(target.id, 'editor', { cookie: other.cookie })).status).toBe(200);
    expect((await patchRole(target.id, 'editor', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect(http.adminSessionLimiter).toBeDefined();
  });
});

describe('readAdminPageAccess', () => {
  async function accessFor(cookieValue: string | null) {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) =>
          name === SESSION_COOKIE && cookieValue ? { name, value: cookieValue } : undefined,
      }),
    }));
    const page = await import('../src/server/planner/admin-page');
    return page.readAdminPageAccess();
  }

  it('maps anonymous, invalid, member, temporary-password admin and admin', async () => {
    const admin = await makeUser('admin');
    const member = await makeUser('member');
    const repo = await instance.getPlannerRepository();
    const email = `page${Date.now()}@example.test`;
    const issued = await repo.createUser({ handle: `page-${Date.now()}`, displayName: 'Quản trị tạm', email, role: 'admin' });
    const pending = await repo.signInWithPassword(email, issued.temporaryPassword!);

    expect(await accessFor(null)).toEqual({ status: 'anonymous' });
    expect(await accessFor('garbage-session-token-garbage-session')).toEqual({ status: 'anonymous' });
    expect(await accessFor(member.cookie)).toEqual({ status: 'not-admin' });
    expect(await accessFor(pending.token)).toEqual({ status: 'must-change-password' });
    const ok = await accessFor(admin.cookie);
    expect(ok).toMatchObject({ status: 'admin', principal: { kind: 'session', userId: admin.id, role: 'admin' } });
    vi.doUnmock('next/headers');
  });
});
