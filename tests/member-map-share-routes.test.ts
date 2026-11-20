import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { SHARE_TOKEN_PATTERN } from '../src/server/planner/schemas';

vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

const ORIGIN = 'https://example.test';
const URL_SHARE = `${ORIGIN}/api/planner/map/share`;
let workdir: string;
let share: typeof import('../src/app/api/planner/map/share/route');
let rotate: typeof import('../src/app/api/planner/map/share/rotate/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;

async function newSession() {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `mms-${(n += 1)}`, displayName: 'Người dùng', role: 'member' });
  return { id: issued.user.id, cookie: (await repo.signIn(issued.accessToken)).token };
}
const headers = (cookie: string, origin: string | null = ORIGIN) => ({
  'content-type': 'application/json',
  cookie: `${SESSION_COOKIE}=${cookie}`,
  ...(origin ? { origin } : {}),
});
const put = (cookie: string, body: unknown, origin: string | null = ORIGIN) =>
  share.PUT(new Request(URL_SHARE, { method: 'PUT', headers: headers(cookie, origin), body: JSON.stringify(body) }));
const get = (cookie: string) => share.GET(new Request(URL_SHARE, { headers: headers(cookie) }));
const del = (cookie: string, origin: string | null = ORIGIN) =>
  share.DELETE(new Request(URL_SHARE, { method: 'DELETE', headers: headers(cookie, origin) }));
const post = (cookie: string, origin: string | null = ORIGIN) =>
  rotate.POST(new Request(`${URL_SHARE}/rotate`, { method: 'POST', headers: headers(cookie, origin) }));
const ON = { enabled: true, shareName: 'anonymous' };

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'map-share-routes-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  share = await import('../src/app/api/planner/map/share/route');
  rotate = await import('../src/app/api/planner/map/share/rotate/route');
  planner = await import('../src/server/planner/instance');
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('/api/planner/map/share (ADR 0030 §4)', () => {
  it('issues a token once on enable, never shows it again, and stores only the digest', async () => {
    const u = await newSession();
    expect(await (await get(u.cookie)).json()).toMatchObject({ enabled: false, shareName: 'anonymous' });
    const first = await put(u.cookie, ON);
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    const body = (await first.json()) as { token: string; enabled: boolean };
    expect(body.enabled).toBe(true);
    expect(body.token).toMatch(SHARE_TOKEN_PATTERN);
    const second = await (await put(u.cookie, ON)).json();
    expect(second).not.toHaveProperty('token');
    const status = await (await get(u.cookie)).json();
    expect(status).toMatchObject({ enabled: true });
    expect(JSON.stringify(status)).not.toContain(body.token);
    const repo = await planner.getPlannerRepository();
    expect(await repo.getSharedMemberMap(body.token)).toEqual({ displayName: null, points: [] });
  });

  it('rotates, revokes and repeats the revoke; the old link answers nothing', async () => {
    const u = await newSession();
    const repo = await planner.getPlannerRepository();
    const { token } = (await (await put(u.cookie, ON)).json()) as { token: string };
    const rotated = (await (await post(u.cookie)).json()) as { token: string };
    expect(rotated.token).not.toBe(token);
    expect(await repo.getSharedMemberMap(token)).toBeNull();
    expect(await repo.getSharedMemberMap(rotated.token)).not.toBeNull();
    expect((await del(u.cookie)).status).toBe(200);
    expect((await del(u.cookie)).status).toBe(200);
    expect(await repo.getSharedMemberMap(rotated.token)).toBeNull();
    // Rotating a map that is not shared is a conflict, not a new link.
    expect((await post(u.cookie)).status).toBe(409);
  });

  it('refuses anonymous callers on every method with the same 401', async () => {
    const anon = { 'content-type': 'application/json', origin: ORIGIN };
    const results = await Promise.all([
      share.GET(new Request(URL_SHARE, { headers: anon })),
      share.PUT(new Request(URL_SHARE, { method: 'PUT', headers: anon, body: JSON.stringify(ON) })),
      share.DELETE(new Request(URL_SHARE, { method: 'DELETE', headers: anon })),
      rotate.POST(new Request(`${URL_SHARE}/rotate`, { method: 'POST', headers: anon })),
    ]);
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401]);
  });

  it('refuses a cross-origin or origin-less mutation and changes nothing', async () => {
    const u = await newSession();
    expect((await put(u.cookie, ON, 'https://evil.test')).status).toBe(403);
    expect((await put(u.cookie, ON, null)).status).toBe(403);
    expect((await del(u.cookie, 'https://evil.test')).status).toBe(403);
    expect((await post(u.cookie, 'https://evil.test')).status).toBe(403);
    expect(await (await get(u.cookie)).json()).toMatchObject({ enabled: false });
  });

  it('is strict: a userId, a token or an unknown key in the body is a 422, and the same envelope applies', async () => {
    const u = await newSession();
    for (const extra of [{ userId: 'usr_other' }, { token: 'x'.repeat(43) }, { slug: 'da-lat' }]) {
      const res = await put(u.cookie, { ...ON, ...extra });
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe('validation_failed');
    }
    expect((await put(u.cookie, { enabled: true })).status).toBe(422);
    expect((await put(u.cookie, { enabled: 'yes', shareName: 'anonymous' })).status).toBe(422);
    expect((await put(u.cookie, { enabled: true, shareName: 'bogus' })).status).toBe(422);
    expect(await (await get(u.cookie)).json()).toMatchObject({ enabled: false });
  });

  it('refuses `name` with 403 share_name_unavailable until it is built', async () => {
    const u = await newSession();
    const res = await put(u.cookie, { enabled: true, shareName: 'name' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatchObject({ code: 'forbidden', reason: 'share_name_unavailable' });
    expect(await (await get(u.cookie)).json()).toMatchObject({ enabled: false, shareName: 'anonymous' });
  });

  it('isolates members: B’s PUT/DELETE/rotate never change A, whatever B sends', async () => {
    const a = await newSession();
    const b = await newSession();
    const repo = await planner.getPlannerRepository();
    const { token } = (await (await put(a.cookie, ON)).json()) as { token: string };
    await put(b.cookie, { ...ON, userId: a.id });
    await del(b.cookie);
    await post(b.cookie);
    expect(await (await get(a.cookie)).json()).toMatchObject({ enabled: true });
    expect(await repo.getSharedMemberMap(token)).not.toBeNull();
    expect(await (await get(b.cookie)).json()).toMatchObject({ enabled: false });
  });

  it('rate-limits changes per member in their own bucket (429), without touching GET or another member', async () => {
    const u = await newSession();
    const other = await newSession();
    let last = 200;
    for (let i = 0; i < 21; i += 1) last = (await put(u.cookie, ON)).status;
    expect(last).toBe(429);
    expect((await get(u.cookie)).status).toBe(200);
    expect((await put(other.cookie, ON)).status).toBe(200);
  });

  it('still lets a member revoke after the change bucket is used up', async () => {
    const u = await newSession();
    for (let i = 0; i < 21; i += 1) await put(u.cookie, ON);
    expect((await put(u.cookie, ON)).status).toBe(429);
    expect((await del(u.cookie)).status).toBe(200);
    expect(await (await get(u.cookie)).json()).toMatchObject({ enabled: false });
  });

  it('writes audit rows on the user and none holds a token', async () => {
    const u = await newSession();
    const repo = await planner.getPlannerRepository();
    const { token } = (await (await put(u.cookie, ON)).json()) as { token: string };
    await del(u.cookie);
    const rows = (await repo.listEvents(u.id)).filter((e) => e.action.startsWith('map_share'));
    expect(rows.map((r) => r.action).sort()).toEqual(['map_share_off', 'map_share_on']);
    expect(JSON.stringify(rows)).not.toContain(token);
  });
});
