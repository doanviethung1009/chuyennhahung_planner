import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';

// The routes and the page read the process-wide repository, which would hash at
// the production scrypt cost (N = 2^17, 128 MiB, ~0.75 s a hash uncontended).
// Alongside the other suites doing the same, that pushed a test here past the
// 5 s timeout. Nothing in this file is about the hash cost — that is
// tests/planner-password.test.ts — so new hashes here use N = 2^10.
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** ADR 0017: route-level behaviour of ban / unban / restore and DELETE ?mode. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

let workdir: string;
let routes: {
  users: typeof import('../src/app/api/admin/planner/users/route');
  user: typeof import('../src/app/api/admin/planner/users/[userId]/route');
  ban: typeof import('../src/app/api/admin/planner/users/[userId]/ban/route');
  unban: typeof import('../src/app/api/admin/planner/users/[userId]/unban/route');
  restore: typeof import('../src/app/api/admin/planner/users/[userId]/restore/route');
};
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
async function makeUser(role: 'member' | 'editor' | 'admin' | 'super_admin', extra: Record<string, unknown> = {}) {
  const repo = await instance.getPlannerRepository();
  const handle = `adm-${role}-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;
  const issued = await repo.createUser({ handle, displayName: 'Người quản trị', role, ...extra });
  const session = await repo.signIn(issued.accessToken);
  return { id: issued.user.id, accessToken: issued.accessToken, cookie: session.token, issued };
}

const post = (kind: 'ban' | 'unban' | 'restore', id: string, o: Opts = {}) =>
  routes[kind].POST(req({ method: 'POST', path: `/api/admin/planner/users/${id}/${kind}`, ...o }), params(id));
const del = (id: string, query: string, o: Opts = {}) =>
  routes.user.DELETE(req({ method: 'DELETE', path: `/api/admin/planner/users/${id}${query}`, ...o }), params(id));
const errorCode = async (response: Response) => (await response.json()).error.code as string;

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
    ban: await import('../src/app/api/admin/planner/users/[userId]/ban/route'),
    unban: await import('../src/app/api/admin/planner/users/[userId]/unban/route'),
    restore: await import('../src/app/api/admin/planner/users/[userId]/restore/route'),
  };
  instance = await import('../src/server/planner/instance');
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('ban / unban / restore routes', () => {
  it('401 without credentials, 403 for a member session and for a cross-site cookie', async () => {
    const target = await makeUser('editor');
    expect((await post('ban', target.id)).status).toBe(401);
    const member = await makeUser('member');
    expect((await post('ban', target.id, { cookie: member.cookie })).status).toBe(403);
    const admin = await makeUser('admin');
    expect((await post('ban', target.id, { cookie: admin.cookie, origin: 'https://evil.test' })).status).toBe(403);
  });

  it('an admin bans and unbans an editor; the editor is then refused everywhere', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const banned = await post('ban', editor.id, { cookie: admin.cookie });
    expect(banned.status).toBe(200);
    expect((await banned.json()).user.bannedAt).toBeTruthy();
    const repo = await instance.getPlannerRepository();
    await expect(repo.signIn(editor.accessToken)).rejects.toMatchObject({ code: 'unauthorized' });
    const unbanned = await post('unban', editor.id, { cookie: admin.cookie });
    expect(unbanned.status).toBe(200);
    expect((await unbanned.json()).user.bannedAt ?? null).toBeNull();
    await expect(repo.signIn(editor.accessToken)).resolves.toBeTruthy();
  });

  it('refuses yourself (409), an admin acting on an admin (403) and an unknown id (404); a member can be banned', async () => {
    const admin = await makeUser('admin');
    const peer = await makeUser('admin');
    const member = await makeUser('member');
    expect((await post('ban', admin.id, { cookie: admin.cookie })).status).toBe(409);
    expect((await post('ban', peer.id, { cookie: admin.cookie })).status).toBe(403);
    expect((await post('ban', member.id, { cookie: admin.cookie })).status).toBe(200);
    expect((await post('ban', 'usr_missing', { cookie: admin.cookie })).status).toBe(404);
  });

  it('a super admin bans an admin; the service token works without an Origin', async () => {
    const boss = await makeUser('super_admin');
    const admin = await makeUser('admin');
    expect((await post('ban', admin.id, { cookie: boss.cookie })).status).toBe(200);
    expect((await post('unban', admin.id, { bearer: ADMIN_TOKEN })).status).toBe(200);
  });

  it('restore undoes a soft delete and answers 200 again when nothing changes', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    expect((await del(editor.id, '?mode=soft', { cookie: admin.cookie })).status).toBe(200);
    const restored = await post('restore', editor.id, { cookie: admin.cookie });
    expect(restored.status).toBe(200);
    expect((await restored.json()).user.deletedAt ?? null).toBeNull();
    expect((await post('restore', editor.id, { cookie: admin.cookie })).status).toBe(200);
  });
});

describe('DELETE ?mode', () => {
  it('422 validation_failed for an unknown mode, nothing is deleted', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const response = await del(editor.id, '?mode=bogus', { cookie: admin.cookie });
    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe('validation_failed');
    const listed = (await (await routes.users.GET(req({ bearer: ADMIN_TOKEN }))).json()).users;
    expect(listed.some((u: { id: string }) => u.id === editor.id)).toBe(true);
  });

  it('soft returns the user with deletedAt; a session hard-delete needs the soft step first', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const early = await del(editor.id, '?mode=hard', { cookie: admin.cookie });
    expect(early.status).toBe(409);
    const soft = await del(editor.id, '?mode=soft', { cookie: admin.cookie });
    expect(soft.status).toBe(200);
    expect((await soft.json()).user.deletedAt).toBeTruthy();
    const hard = await del(editor.id, '', { cookie: admin.cookie }); // default mode is hard
    expect(hard.status).toBe(204);
    const listed = (await (await routes.users.GET(req({ bearer: ADMIN_TOKEN }))).json()).users;
    expect(listed.some((u: { id: string }) => u.id === editor.id)).toBe(false);
  });

  it('keeps the legacy service-token hard delete (default mode) working', async () => {
    const member = await makeUser('member');
    expect((await del(member.id, '', { bearer: ADMIN_TOKEN })).status).toBe(204);
  });
});
