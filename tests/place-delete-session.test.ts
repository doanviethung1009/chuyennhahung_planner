import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { can, ROLE_ACTIONS } from '../src/server/identity/permissions';
import { activityInput, daLatTripInput } from './planner-helpers';
import { placeFixture, storyFixture } from './travel-content-helpers';

// Same cheap scrypt cost as the other session suites; nothing here is about hashing.
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** CORE-10 / ADR 0028: `content:delete` lets admin and super admin sessions (and the token) delete a place. */
const TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

let workdir: string;
let route: typeof import('../src/app/api/admin/travel/places/[slug]/route');
let content: Awaited<ReturnType<typeof import('../src/server/content/instance').getRepository>>;
let planner: Awaited<ReturnType<typeof import('../src/server/planner/instance').getPlannerRepository>>;
let n = 0;

type Role = 'member' | 'editor' | 'admin' | 'super_admin';
async function makeUser(role: Role) {
  const handle = `del-${role}-${(n += 1)}-${Math.random().toString(36).slice(2, 7)}`;
  const issued = await planner.createUser({ handle, displayName: 'Người thử', role });
  const session = await planner.signIn(issued.accessToken);
  return session.token;
}

const newPlace = async () => {
  const slug = `del-place-${(n += 1)}`;
  await content.createPlace(placeFixture({ slug }));
  return slug;
};

function del(slug: string, o: { bearer?: string; cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
  const origin = o.origin === undefined ? (o.cookie ? ORIGIN : null) : o.origin;
  if (origin) headers.origin = origin;
  return route.DELETE(new Request(`${ORIGIN}/api/admin/travel/places/${slug}`, { method: 'DELETE', headers }), {
    params: Promise.resolve({ slug }),
  });
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'place-delete-session-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = TOKEN;
  process.env.GUEST_KEY_SECRET = 'place-delete-guest-secret-0123456789';
  delete process.env.PLANNER_DATABASE_URL;
  delete process.env.CONTENT_DATABASE_URL;
  route = await import('../src/app/api/admin/travel/places/[slug]/route');
  content = await (await import('../src/server/content/instance')).getRepository();
  planner = await (await import('../src/server/planner/instance')).getPlannerRepository();
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('content:delete permission matrix', () => {
  it('is held by admin, super_admin and the service token only', () => {
    for (const role of ['admin', 'super_admin', 'service'] as const) expect(can({ role }, 'content:delete'), role).toBe(true);
    for (const role of ['editor', 'member'] as const) expect(can({ role }, 'content:delete'), role).toBe(false);
    expect(ROLE_ACTIONS.editor).not.toContain('content:delete');
  });
});

describe('DELETE /api/admin/travel/places/[slug] with a session', () => {
  for (const role of ['admin', 'super_admin'] as const) {
    it(`${role} session deletes an unreferenced place (204, no-store)`, async () => {
      const slug = await newPlace();
      const response = await del(slug, { cookie: await makeUser(role) });
      expect(response.status).toBe(204);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(content.getPlace(slug)).rejects.toMatchObject({ code: 'not_found' });
    });
  }

  for (const role of ['editor', 'member'] as const) {
    it(`${role} session is refused 403 and the place stays`, async () => {
      const slug = await newPlace();
      const response = await del(slug, { cookie: await makeUser(role) });
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('forbidden');
      expect((await content.getPlace(slug)).slug).toBe(slug);
    });
  }

  it('no credentials: 401; unknown session: 401', async () => {
    const slug = await newPlace();
    expect((await del(slug)).status).toBe(401);
    expect((await del(slug, { cookie: 'not-a-real-session-token-not-a-real-one' })).status).toBe(401);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('refuses a cross-site cookie request and deletes nothing', async () => {
    const slug = await newPlace();
    const response = await del(slug, { cookie: await makeUser('admin'), origin: 'https://evil.test' });
    expect(response.status).toBe(403);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('the service token still deletes', async () => {
    const slug = await newPlace();
    expect((await del(slug, { bearer: TOKEN })).status).toBe(204);
  });

  it('a referenced place answers 409 place_in_use with counts for an admin session', async () => {
    const slug = await newPlace();
    await content.createStory(storyFixture({ slug: `story-${slug}`, placeSlugs: [slug] }));
    const response = await del(slug, { cookie: await makeUser('admin') });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('place_in_use');
    expect(body.error.details.counts.stories).toBe(1);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('refuses a session still holding a temporary password, and deletes nothing', async () => {
    const slug = await newPlace();
    const email = `del${Date.now()}@example.test`;
    const issued = await planner.createUser({ handle: `del-pend-${Date.now()}`, displayName: 'Chờ đổi', email, role: 'admin' });
    const pending = await planner.signInWithPassword(email, issued.temporaryPassword!);
    const response = await del(slug, { cookie: pending.token });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('password_change_required');
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('refuses a cookie request that carries neither Origin nor Sec-Fetch-Site', async () => {
    const slug = await newPlace();
    const response = await del(slug, { cookie: await makeUser('admin'), origin: null });
    expect(response.status).toBe(403);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });

  it('rate-limits session deletes at 30 per minute per user, not the token', async () => {
    const cookie = await makeUser('admin');
    for (let i = 0; i < 30; i += 1) expect((await del(`absent-${i}`, { cookie })).status).toBe(404);
    const limited = await del('absent-31', { cookie });
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('rate_limited');
    expect((await del('absent-32', { bearer: TOKEN })).status).toBe(404);
  });

  it('answers 409 for a Planner trip activity under a session, with counts only', async () => {
    const slug = await newPlace();
    const owner = await planner.createUser({ handle: `owner-${slug}`, displayName: 'Chủ chuyến' });
    const trip = await planner.createTrip(owner.user.id, daLatTripInput());
    await planner.addActivity(owner.user.id, trip.trip.id, activityInput({ placeSlug: slug }), trip.trip.version);
    const response = await del(slug, { cookie: await makeUser('super_admin') });
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(JSON.parse(text).error.details.counts.tripActivities).toBe(1);
    expect(text).not.toContain(owner.user.id);
    expect((await content.getPlace(slug)).slug).toBe(slug);
  });
});
