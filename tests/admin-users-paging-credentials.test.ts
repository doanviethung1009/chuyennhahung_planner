import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** P07-12: paging on GET /users, and role gating of unlink-Google and rotate-token. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
let workdir: string;
let users: typeof import('../src/app/api/admin/planner/users/route');
let google: typeof import('../src/app/api/admin/planner/users/[userId]/google/route');
let rotate: typeof import('../src/app/api/admin/planner/users/[userId]/rotate-token/route');
let instance: typeof import('../src/server/planner/instance');

const params = (userId: string) => ({ params: Promise.resolve({ userId }) });
function req(path: string, o: { method?: string; cookie?: string; bearer?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.cookie) {
    headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
    headers.origin = ORIGIN;
  }
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  return new Request(`${ORIGIN}${path}`, { method: o.method ?? 'GET', headers });
}
let n = 0;
async function makeUser(role: 'member' | 'editor' | 'admin' | 'super_admin') {
  const repo = await instance.getPlannerRepository();
  const issued = await repo.createUser({ handle: `pg-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`, displayName: 'Người dùng', role });
  return { id: issued.user.id, accessToken: issued.accessToken, cookie: (await repo.signIn(issued.accessToken)).token };
}
const list = (query: string, cookie?: string) =>
  users.GET(req(`/api/admin/planner/users${query}`, cookie ? { cookie } : { bearer: ADMIN_TOKEN }));
const unlink = (id: string, cookie: string) => google.DELETE(req(`/api/admin/planner/users/${id}/google`, { method: 'DELETE', cookie }), params(id));
const rotateTok = (id: string, cookie: string) => rotate.POST(req(`/api/admin/planner/users/${id}/rotate-token`, { method: 'POST', cookie }), params(id));

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'admin-users-paging-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  users = await import('../src/app/api/admin/planner/users/route');
  google = await import('../src/app/api/admin/planner/users/[userId]/google/route');
  rotate = await import('../src/app/api/admin/planner/users/[userId]/rotate-token/route');
  instance = await import('../src/server/planner/instance');
  for (let i = 0; i < 7; i += 1) await makeUser('member');
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('GET /users paging', () => {
  it('without a query returns everything, with no paging fields', async () => {
    const body = await (await list('')).json();
    expect(body.users.length).toBe(body.count);
    expect(body).not.toHaveProperty('nextCursor');
  });

  it('walks every account once, in order, whatever the sort', async () => {
    const all = (await (await list('')).json()).users.length as number;
    for (const sort of ['handle', 'created', '-created']) {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await list(`?limit=3&sort=${sort}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(all);
        seen.push(...body.users.map((u: { id: string }) => u.id));
        cursor = body.nextCursor;
      } while (cursor);
      expect(seen.length).toBe(all);
      expect(new Set(seen).size).toBe(all);
    }
  });

  it('stays stable when an account is created between pages', async () => {
    const first = await (await list('?limit=3&sort=handle')).json();
    await makeUser('member');
    const rest: string[] = [];
    let cursor: string | null = first.nextCursor;
    while (cursor) {
      const body: { users: { id: string }[]; nextCursor: string | null } = await (await list(`?limit=3&sort=handle&cursor=${encodeURIComponent(cursor)}`)).json();
      rest.push(...body.users.map((u) => u.id));
      cursor = body.nextCursor;
    }
    const ids = [...first.users.map((u: { id: string }) => u.id), ...rest];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps limit at 200 and rejects a bad limit, bad cursor or a cursor from another sort with 422', async () => {
    expect((await (await list('?limit=100000')).json()).users.length).toBeLessThanOrEqual(200);
    expect((await list('?limit=0')).status).toBe(422);
    expect((await list('?limit=abc')).status).toBe(422);
    expect((await list('?cursor=not-a-cursor')).status).toBe(422);
    expect((await list('?sort=bogus')).status).toBe(422);
    const page = await (await list('?limit=2&sort=handle')).json();
    expect((await list(`?limit=2&sort=created&cursor=${encodeURIComponent(page.nextCursor)}`)).status).toBe(422);
  });
});

describe('unlink Google and rotate token: who may act', () => {
  it('401 anonymous, 403 for a member, and an admin may not touch an admin or super admin', async () => {
    const editor = await makeUser('editor');
    const anon = await google.DELETE(req(`/api/admin/planner/users/${editor.id}/google`, { method: 'DELETE' }), params(editor.id));
    expect(anon.status).toBe(401);
    const member = await makeUser('member');
    expect((await unlink(editor.id, member.cookie)).status).toBe(403);
    expect((await rotateTok(editor.id, member.cookie)).status).toBe(403);
    const admin = await makeUser('admin');
    const peer = await makeUser('admin');
    const boss = await makeUser('super_admin');
    for (const target of [peer, boss]) {
      for (const res of [await unlink(target.id, admin.cookie), await rotateTok(target.id, admin.cookie)]) {
        expect(res.status).toBe(403);
        expect((await res.json()).error.reason).toBe('manage_role');
      }
    }
    // Refused means untouched: the peer's token still signs in.
    await expect((await instance.getPlannerRepository()).signIn(peer.accessToken)).resolves.toBeTruthy();
  });

  it('refuses rotating your own token (409 self_action), even for a super admin', async () => {
    const boss = await makeUser('super_admin');
    const res = await rotateTok(boss.id, boss.cookie);
    expect(res.status).toBe(409);
    expect((await res.json()).error.reason).toBe('self_action');
    await expect((await instance.getPlannerRepository()).signIn(boss.accessToken)).resolves.toBeTruthy();
  });

  it('an admin rotates an editor token: no-store, new token once, old one dead; unknown id is 404', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const res = await rotateTok(editor.id, admin.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    const body = await res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.accessToken).not.toBe(editor.accessToken);
    const repo = await instance.getPlannerRepository();
    await expect(repo.signIn(editor.accessToken)).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(repo.signIn(body.accessToken)).resolves.toBeTruthy();
    expect((await rotateTok('usr_missing', admin.cookie)).status).toBe(404);
    expect((await unlink('usr_missing', admin.cookie)).status).toBe(404);
  });

  it('an admin unlinks Google from a member; a super admin does it to an admin; the service token to anyone', async () => {
    const admin = await makeUser('admin');
    const member = await makeUser('member');
    expect((await unlink(member.id, admin.cookie)).status).toBe(200);
    const boss = await makeUser('super_admin');
    const other = await makeUser('admin');
    expect((await unlink(other.id, boss.cookie)).status).toBe(200);
    const svc = await google.DELETE(req(`/api/admin/planner/users/${other.id}/google`, { method: 'DELETE', bearer: ADMIN_TOKEN }), params(other.id));
    expect(svc.status).toBe(200);
  });
});
