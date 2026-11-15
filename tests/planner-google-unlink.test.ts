import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';

/** ADR 0007: `DELETE /api/planner/google` through the real route handler. */

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
const NEW_PASSWORD = 'mật khẩu riêng của tôi';
let workdir: string;
let routes: {
  google: typeof import('../src/app/api/planner/google/route');
  session: typeof import('../src/app/api/planner/session/route');
  password: typeof import('../src/app/api/planner/password/route');
  adminUsers: typeof import('../src/app/api/admin/planner/users/route');
};
let repository: Awaited<ReturnType<typeof import('../src/server/planner/instance').getPlannerRepository>>;

function req(path: string, init: { method?: string; body?: unknown; cookie?: string; bearer?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.cookie) headers.cookie = `${SESSION_COOKIE}=${init.cookie}`;
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.origin) headers.origin = init.origin;
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const cookieOf = (response: Response) => (response.headers.get('set-cookie') ?? '').split(';')[0]!.split('=')[1]!;
const unlink = (cookie?: string, origin: string | null = ORIGIN) =>
  routes.google.DELETE(req('/api/planner/google', { method: 'DELETE', cookie, origin: origin ?? undefined }));

/** An operator-created user, signed in; password changed unless `pending`. */
async function signedIn(handle: string, pending = false) {
  const created = await routes.adminUsers.POST(
    req('/api/admin/planner/users', {
      method: 'POST',
      bearer: ADMIN_TOKEN,
      body: { handle, displayName: handle, email: `${handle}@example.com` },
    }),
  );
  const { temporaryPassword, user } = await created.json();
  const login = await routes.session.POST(
    req('/api/planner/session', {
      method: 'POST',
      origin: ORIGIN,
      body: { email: `${handle}@example.com`, password: temporaryPassword },
    }),
  );
  const cookie = cookieOf(login);
  if (!pending) {
    const changed = await routes.password.POST(
      req('/api/planner/password', {
        method: 'POST',
        cookie,
        origin: ORIGIN,
        body: { currentPassword: temporaryPassword, newPassword: NEW_PASSWORD },
      }),
    );
    expect(changed.status).toBe(204);
  }
  return { cookie, userId: user.id as string };
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-google-unlink-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  routes = {
    google: await import('../src/app/api/planner/google/route'),
    session: await import('../src/app/api/planner/session/route'),
    password: await import('../src/app/api/planner/password/route'),
    adminUsers: await import('../src/app/api/admin/planner/users/route'),
  };
  repository = await (await import('../src/server/planner/instance')).getPlannerRepository();
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

// Real routes hash at production cost, hence the longer timeout.
describe('DELETE /api/planner/google', { timeout: 30_000 }, () => {
  it('answers 401 with no session', async () => {
    expect((await unlink(undefined)).status).toBe(401);
  });

  it('refuses a cross-site request, even with a valid session', async () => {
    const { cookie, userId } = await signedIn('unlink-csrf');
    await repository.linkGoogle(userId, { sub: 'sub-csrf', email: 'g@gmail.com', name: 'G' });
    expect((await unlink(cookie, 'https://evil.test')).status).toBe(403);
    expect((await unlink(cookie, null)).status).toBe(403);
    const still = await (await routes.session.GET(req('/api/planner/session', { cookie }))).json();
    expect(still.user.hasGoogle).toBe(true);
  });

  it('refuses a session still holding a temporary password', async () => {
    const { cookie } = await signedIn('unlink-pending', true);
    const response = await unlink(cookie);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('password_change_required');
  });

  it('unlinks, keeping this session', async () => {
    const { cookie, userId } = await signedIn('unlink-ok');
    await repository.linkGoogle(userId, { sub: 'sub-ok', email: 'g2@gmail.com', name: 'G' });
    const response = await unlink(cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).user).toMatchObject({ id: userId, hasGoogle: false });
    expect((await routes.session.GET(req('/api/planner/session', { cookie }))).status).toBe(200);
  });

  it('is rate-limited per user', async () => {
    const { cookie } = await signedIn('unlink-limit');
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await unlink(cookie)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
