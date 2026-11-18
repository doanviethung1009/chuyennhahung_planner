import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// admin-gate pulls in next-intl navigation, which needs a request: stub it.
vi.mock('next/navigation', () => ({ notFound: () => undefined, useParams: () => ({}) }));
vi.mock('../src/i18n/navigation', () => ({ redirect: vi.fn() }));

import { SESSION_COOKIE } from '../src/server/planner/auth';
import { adminSidebarGroups } from '../src/lib/admin-gate';
import { loadSystemStatus, type SystemSources } from '../src/server/admin/system';

const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
// Sentinels: if any of these shows up in a response, a value was serialised.
const SENTINELS = {
  PLANNER_DATABASE_URL: 'postgres://sentinel_user:SENTINEL_PW_1@sentinel-planner-host.invalid:1/sentineldb',
  CONTENT_DATABASE_URL: 'postgres://sentinel_user:SENTINEL_PW_2@sentinel-content-host.invalid:1/sentineldb',
  GOOGLE_CLIENT_ID: 'SENTINEL_GOOGLE_ID',
  GOOGLE_CLIENT_SECRET: 'SENTINEL_GOOGLE_SECRET',
  NEXT_PUBLIC_SITE_URL: 'https://sentinel-site.invalid',
  PLANNER_STORE: '/SENTINEL/path/planner.json',
} as const;

let route: typeof import('../src/app/api/admin/system/route');
let planner: typeof import('../src/server/planner/instance');
let n = 0;

const get = (o: { bearer?: string; cookie?: string } = {}) =>
  route.GET(
    new Request(`${ORIGIN}/api/admin/system`, {
      headers: {
        ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
        ...(o.cookie ? { cookie: `${SESSION_COOKIE}=${o.cookie}` } : {}),
      },
    }),
  );

async function makeUser(role: 'member' | 'editor' | 'admin' | 'super_admin') {
  const repo = await planner.getPlannerRepository();
  const issued = await repo.createUser({ handle: `sys-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`, displayName: 'Người dùng', role });
  return (await repo.signIn(issued.accessToken)).token;
}

beforeAll(async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'admin-system-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  delete process.env.CONTENT_DATABASE_URL;
  route = await import('../src/app/api/admin/system/route');
  planner = await import('../src/server/planner/instance');
});

describe('GET /api/admin/system (runbook:read)', () => {
  it('401 anonymous, 403 member, editor, admin and the service token; 200 super admin; no-store', async () => {
    expect((await get()).status).toBe(401);
    for (const role of ['member', 'editor', 'admin'] as const) {
      expect((await get({ cookie: await makeUser(role) })).status, role).toBe(403);
    }
    expect((await get({ bearer: ADMIN_TOKEN })).status).toBe(403);
    const ok = await get({ cookie: await makeUser('super_admin') });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
  });

  it('reports file stores, a fixed set of fields and a backups line that never claims a backup', async () => {
    const body = await (await get({ cookie: await makeUser('super_admin') })).json();
    expect(Object.keys(body).sort()).toEqual(['backups', 'build', 'content', 'health', 'integrations', 'planner']);
    expect(body.planner).toEqual({ store: 'file', database: 'not_applicable', lastMigration: null });
    expect(body.content.store).toBe('file');
    expect(body.health).toBe('ok');
    expect(body.backups).toEqual({ state: 'not_configured' });
    expect(Object.keys(body.integrations).sort()).toEqual(['adminApiToken', 'googleSignIn', 'publicContentSource', 'siteUrl']);
  });

  it('serialises no env value, URL, host, token or path', async () => {
    const cookie = await makeUser('super_admin');
    const saved = { ...process.env };
    try {
      for (const [key, value] of Object.entries(SENTINELS)) {
        if (key !== 'PLANNER_STORE') process.env[key] = value; // the planner instance is already built on its file
      }
      const res = await get({ cookie });
      expect(res.status).toBe(200);
      const text = JSON.stringify(await res.json());
      for (const value of [...Object.values(SENTINELS), ADMIN_TOKEN, 'sentinel', 'SENTINEL', process.env.PLANNER_STORE!]) {
        expect(text).not.toContain(value);
      }
      const body = JSON.parse(text);
      // Presence only: the flags flip, the values never appear.
      expect(body.integrations.googleSignIn).toBe(true);
      expect(body.integrations.siteUrl).toBe(true);
      expect(body.integrations.adminApiToken).toBe(true);
      // Databases are "configured" and (being .invalid) unreachable, not a 500.
      expect(body.planner.store).toBe('postgres');
      expect(body.planner.database).toBe('unreachable');
      expect(body.content.database).toBe('unreachable');
    } finally {
      for (const key of Object.keys(SENTINELS)) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  }, 30_000);
});

describe('loadSystemStatus', () => {
  const sources = (over: Partial<SystemSources> = {}): SystemSources => ({
    databaseUrl: () => 'postgres://x',
    probe: async () => ({ database: 'ok', lastMigration: '0015_audit_admin_events.sql' }),
    health: async () => true,
    buildId: async () => 'abc123',
    ...over,
  });

  it('shows the last applied migration and the store mode from the probe', async () => {
    const s = await loadSystemStatus(sources());
    expect(s.planner).toEqual({ store: 'postgres', database: 'ok', lastMigration: '0015_audit_admin_events.sql' });
    expect(s.build.buildId).toBe('abc123');
  });

  it('turns a throwing probe, health or build lookup into "unreachable" / "failed" / null — never a throw', async () => {
    const boom = async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');
    };
    const s = await loadSystemStatus(sources({ probe: boom, health: boom, buildId: boom }));
    expect(s.planner.database).toBe('unreachable');
    expect(s.content.database).toBe('unreachable');
    expect(s.health).toBe('failed');
    expect(s.build.buildId).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/hunter2|10\.0\.0\.5|ECONNREFUSED/);
  });
});

describe('a database that accepts the connection but never answers', () => {
  it('reports "unreachable" within a bound instead of hanging', async () => {
    const sockets: Array<{ destroy(): void }> = [];
    const server = createServer((socket) => sockets.push(socket)); // accepts, never replies
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    const saved = process.env.CONTENT_DATABASE_URL;
    process.env.CONTENT_DATABASE_URL = `postgres://u:p@127.0.0.1:${port}/db`;
    try {
      const started = Date.now();
      const s = await loadSystemStatus();
      expect(s.content).toEqual({ store: 'postgres', database: 'unreachable', lastMigration: null });
      expect(Date.now() - started).toBeLessThan(6_000);
    } finally {
      if (saved === undefined) delete process.env.CONTENT_DATABASE_URL;
      else process.env.CONTENT_DATABASE_URL = saved;
      sockets.forEach((socket) => socket.destroy());
      server.close();
    }
  }, 15_000);
});

describe('system page wiring', () => {
  it('is super-admin only in the sidebar and gated by requireStaff(runbook)', async () => {
    const hrefs = (role: 'editor' | 'admin' | 'super_admin') =>
      adminSidebarGroups({ role }).flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs('editor')).not.toContain('/admin/system');
    expect(hrefs('admin')).not.toContain('/admin/system');
    expect(hrefs('super_admin')).toContain('/admin/system');
    const page = await readFile(join(import.meta.dirname, '../src/app/(admin)/[locale]/admin/system/page.tsx'), 'utf8');
    expect(page).toMatch(/requireStaff\([\s\S]*?'runbook'\)/);
  });
});
