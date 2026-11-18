import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { can, ROLE_ACTIONS } from '../src/server/identity/permissions';
import { placeFixture, reviewFixture, storyFixture } from './travel-content-helpers';

// The routes and the page read the process-wide repository, which would hash at
// the production scrypt cost (N = 2^17, 128 MiB, ~0.75 s a hash uncontended).
// Alongside the other suites doing the same, that pushed a test here past the
// 5 s timeout. Nothing in this file is about the hash cost — that is
// tests/planner-password.test.ts — so new hashes here use N = 2^10.
vi.mock('../src/server/planner/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/planner/password')>()),
  DEFAULT_SCRYPT_COST_LOG2: 10,
}));

/** ADR 0011: browser-session editors/admins on the opted-in content routes. */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';

let workdir: string;
let r: {
  stories: typeof import('../src/app/api/admin/travel/stories/route');
  story: typeof import('../src/app/api/admin/travel/stories/[slug]/route');
  storyPlaces: typeof import('../src/app/api/admin/travel/stories/[slug]/places/route');
  storyStatus: typeof import('../src/app/api/admin/travel/stories/[slug]/status/route');
  places: typeof import('../src/app/api/admin/travel/places/route');
  place: typeof import('../src/app/api/admin/travel/places/[slug]/route');
  reviews: typeof import('../src/app/api/admin/travel/reviews/route');
  review: typeof import('../src/app/api/admin/travel/reviews/[id]/route');
  reviewStatus: typeof import('../src/app/api/admin/travel/reviews/[id]/status/route');
  templates: typeof import('../src/app/api/admin/travel/templates/route');
  integrity: typeof import('../src/app/api/admin/travel/integrity/route');
  collections: typeof import('../src/app/api/admin/travel/collections/route');
  collection: typeof import('../src/app/api/admin/travel/collections/[slug]/route');
  collectionStatus: typeof import('../src/app/api/admin/travel/collections/[slug]/status/route');
  plannerIntegrity: typeof import('../src/app/api/admin/planner/integrity/route');
};
let planner: typeof import('../src/server/planner/instance');
let content: typeof import('../src/server/content/instance');

interface Opts {
  method?: string;
  path?: string;
  body?: unknown;
  bearer?: string;
  cookie?: string;
  origin?: string | null;
  ifMatch?: string;
}

function req(o: Opts = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${SESSION_COOKIE}=${o.cookie}`;
  const origin = o.origin === undefined ? (o.cookie ? ORIGIN : null) : o.origin;
  if (origin) headers.origin = origin;
  if (o.ifMatch !== undefined) headers['if-match'] = o.ifMatch;
  return new Request(`${ORIGIN}${o.path ?? '/api/admin/travel/places'}`, {
    method: o.method ?? 'GET',
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
  });
}
const slugParams = (slug: string) => ({ params: Promise.resolve({ slug }) });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

let counter = 0;
async function makeUser(role: 'member' | 'editor' | 'admin' | 'super_admin', extra: Record<string, unknown> = {}) {
  const repo = await planner.getPlannerRepository();
  const handle = `cms-${role}-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;
  const issued = await repo.createUser({ handle, displayName: 'Biên tập viên', role, ...extra });
  const session = await repo.signIn(issued.accessToken);
  return { id: issued.user.id, accessToken: issued.accessToken, cookie: session.token, issued };
}

const getPlace = (slug: string, o: Opts = {}) =>
  r.place.GET(req({ path: `/api/admin/travel/places/${slug}`, ...o }), slugParams(slug));
const patchPlace = (slug: string, body: unknown, o: Opts = {}) =>
  r.place.PATCH(
    req({ method: 'PATCH', path: `/api/admin/travel/places/${slug}`, body, ...o }),
    slugParams(slug),
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'admin-content-session-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  delete process.env.PLANNER_DATABASE_URL;
  r = {
    stories: await import('../src/app/api/admin/travel/stories/route'),
    story: await import('../src/app/api/admin/travel/stories/[slug]/route'),
    storyPlaces: await import('../src/app/api/admin/travel/stories/[slug]/places/route'),
    storyStatus: await import('../src/app/api/admin/travel/stories/[slug]/status/route'),
    places: await import('../src/app/api/admin/travel/places/route'),
    place: await import('../src/app/api/admin/travel/places/[slug]/route'),
    reviews: await import('../src/app/api/admin/travel/reviews/route'),
    review: await import('../src/app/api/admin/travel/reviews/[id]/route'),
    reviewStatus: await import('../src/app/api/admin/travel/reviews/[id]/status/route'),
    templates: await import('../src/app/api/admin/travel/templates/route'),
    integrity: await import('../src/app/api/admin/travel/integrity/route'),
    collections: await import('../src/app/api/admin/travel/collections/route'),
    collection: await import('../src/app/api/admin/travel/collections/[slug]/route'),
    collectionStatus: await import('../src/app/api/admin/travel/collections/[slug]/status/route'),
    plannerIntegrity: await import('../src/app/api/admin/planner/integrity/route'),
  };
  planner = await import('../src/server/planner/instance');
  content = await import('../src/server/content/instance');
  const repo = await content.getRepository();
  await repo.createPlace(placeFixture({ slug: 'cms-place' }));
  await repo.createStory(storyFixture({ slug: 'cms-story' }));
  await repo.createReview(reviewFixture({ id: 'cms-review' }));
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('content:write permission', () => {
  it('is held by editor, admin and service, never member', () => {
    for (const role of ['editor', 'admin', 'service'] as const) {
      expect(can({ role }, 'content:write'), role).toBe(true);
    }
    expect(can({ role: 'member' }, 'content:write')).toBe(false);
    expect(ROLE_ACTIONS.member).toEqual([]);
    expect(ROLE_ACTIONS.editor).not.toContain('user:provision');
    expect(ROLE_ACTIONS.editor).not.toContain('user:promote');
  });
});

describe('guard matrix on opted-in routes', () => {
  it('admits service token, admin and editor sessions with no-store; refuses member 403 and nobody 401', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const member = await makeUser('member');
    for (const o of [{ bearer: ADMIN_TOKEN }, { cookie: admin.cookie }, { cookie: editor.cookie }]) {
      for (const response of [
        await r.stories.GET(req({ path: '/api/admin/travel/stories', ...o })),
        await r.places.GET(req({ path: '/api/admin/travel/places', ...o })),
        await r.reviews.GET(req({ path: '/api/admin/travel/reviews', ...o })),
        await getPlace('cms-place', o),
        await r.story.GET(req({ path: '/api/admin/travel/stories/cms-story', ...o }), slugParams('cms-story')),
        await r.review.GET(req({ path: '/api/admin/travel/reviews/cms-review', ...o }), idParams('cms-review')),
      ]) {
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
    }
    const forbidden = await getPlace('cms-place', { cookie: member.cookie });
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe('forbidden');
    expect((await patchPlace('cms-place', { rating: 3 }, { cookie: member.cookie })).status).toBe(403);
    const none = await getPlace('cms-place');
    expect(none.status).toBe(401);
    expect(none.headers.get('cache-control')).toBe('no-store');
    expect((await getPlace('cms-place', { cookie: 'not-a-real-session-token-not-a-real-one' })).status).toBe(401);
  });

  it('refuses a traveller access token in Authorization', async () => {
    const editor = await makeUser('editor');
    expect((await getPlace('cms-place', { bearer: editor.accessToken })).status).toBe(401);
  });

  it('refuses a cross-site cookie mutation and writes nothing', async () => {
    const editor = await makeUser('editor');
    const before = await (await getPlace('cms-place', { bearer: ADMIN_TOKEN })).json();
    const response = await patchPlace('cms-place', { rating: 1 }, { cookie: editor.cookie, origin: 'https://evil.test' });
    expect(response.status).toBe(403);
    const after = await (await getPlace('cms-place', { bearer: ADMIN_TOKEN })).json();
    expect(after).toEqual(before);
  });

  it('blocks a session whose temporary password is still pending', async () => {
    const repo = await planner.getPlannerRepository();
    const email = `cms${Date.now()}@example.test`;
    const issued = await repo.createUser({ handle: `cms-pend-${Date.now()}`, displayName: 'Chờ đổi', email, role: 'editor' });
    const pending = await repo.signInWithPassword(email, issued.temporaryPassword!);
    const response = await getPlace('cms-place', { cookie: pending.token });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('password_change_required');
  });

  it('rate-limits session mutations at 30 per minute per user, not the token', async () => {
    const editor = await makeUser('editor');
    for (let i = 0; i < 30; i += 1) {
      expect((await patchPlace('cms-place', { rating: 3 }, { cookie: editor.cookie })).status).toBe(200);
    }
    const limited = await patchPlace('cms-place', { rating: 3 }, { cookie: editor.cookie });
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('rate_limited');
    expect((await patchPlace('cms-place', { rating: 3 }, { bearer: ADMIN_TOKEN })).status).toBe(200);
  });

  it('keeps status POSTs on story:publish with session access and existing state rules', async () => {
    const editor = await makeUser('editor');
    const member = await makeUser('member');
    const post = (cookie: string) =>
      r.reviewStatus.POST(
        req({ method: 'POST', path: '/api/admin/travel/reviews/cms-review/status', body: { action: 'unpublish' }, cookie }),
        idParams('cms-review'),
      );
    expect((await post(member.cookie)).status).toBe(403);
    expect((await post(editor.cookie)).status).toBe(200);
    // Publishing a story that links an unpublished review is still refused.
    const repo = await content.getRepository();
    await repo.createStory(storyFixture({ slug: 'cms-linked', reviewIds: ['cms-review'] }));
    const publish = await r.storyStatus.POST(
      req({ method: 'POST', path: '/api/admin/travel/stories/cms-linked/status', body: { action: 'publish' }, cookie: editor.cookie }),
      slugParams('cms-linked'),
    );
    expect(publish.status).toBe(409);
    expect((await publish.json()).error.code).toBe('invalid_state');
  });
});

describe('create story and place (P07-16)', () => {
  const slug = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  const postStory = (body: unknown, o: Opts = {}) =>
    r.stories.POST(req({ method: 'POST', path: '/api/admin/travel/stories', body, ...o }));
  const postPlace = (body: unknown, o: Opts = {}) =>
    r.places.POST(req({ method: 'POST', path: '/api/admin/travel/places', body, ...o }));

  it('lets editor and admin create, refuses member (403) and anonymous (401)', async () => {
    const editor = await makeUser('editor');
    const admin = await makeUser('admin');
    const member = await makeUser('member');
    for (const who of [editor, admin]) {
      expect((await postPlace(placeFixture({ slug: slug('np') }), { cookie: who.cookie })).status).toBe(201);
      expect((await postStory(storyFixture({ slug: slug('ns') }), { cookie: who.cookie })).status).toBe(201);
    }
    expect((await postPlace(placeFixture({ slug: slug('np') }), { cookie: member.cookie })).status).toBe(403);
    expect((await postStory(storyFixture({ slug: slug('ns') }), { cookie: member.cookie })).status).toBe(403);
    expect((await postPlace(placeFixture({ slug: slug('np') }))).status).toBe(401);
    expect((await postStory(storyFixture({ slug: slug('ns') }))).status).toBe(401);
  });

  it('keeps the token path working', async () => {
    expect((await postPlace(placeFixture({ slug: slug('tp') }), { bearer: ADMIN_TOKEN })).status).toBe(201);
    expect((await postStory(storyFixture({ slug: slug('ts') }), { bearer: ADMIN_TOKEN })).status).toBe(201);
  });

  it('always creates a story as a draft, even when the body says published', async () => {
    const editor = await makeUser('editor');
    const name = slug('draft');
    const response = await postStory({ ...storyFixture({ slug: name }), status: 'published', publishedAt: '2024-01-01T00:00:00.000Z' }, { cookie: editor.cookie });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.status).toBe('draft');
    expect(created.publishedAt).toBeNull();
    const repo = await content.getRepository();
    expect((await repo.listStories({ status: 'published' } as never)).some((s) => s.slug === name)).toBe(false);
  });

  it('refuses a duplicate slug with slug_conflict and overwrites nothing', async () => {
    const editor = await makeUser('editor');
    const name = slug('dup');
    expect((await postStory(storyFixture({ slug: name }), { cookie: editor.cookie })).status).toBe(201);
    const again = await postStory(storyFixture({ slug: name, excerpt: { vi: 'Ghi đè', en: 'Overwrite' } }), { cookie: editor.cookie });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe('slug_conflict');
    const repo = await content.getRepository();
    expect((await repo.getStory(name))?.excerpt.en).not.toBe('Overwrite');

    const place = slug('dupp');
    expect((await postPlace(placeFixture({ slug: place }), { cookie: editor.cookie })).status).toBe(201);
    const dup = await postPlace(placeFixture({ slug: place }), { cookie: editor.cookie });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe('slug_conflict');
  });

  it('enforces same-origin and the body schema on the session path', async () => {
    const editor = await makeUser('editor');
    const name = slug('csrf');
    expect((await postStory(storyFixture({ slug: name }), { cookie: editor.cookie, origin: 'https://evil.test' })).status).toBe(403);
    const repo = await content.getRepository();
    expect(await repo.getStory(name).catch(() => null)).toBeFalsy();
    const bad = await postPlace({ slug: 'x' }, { cookie: editor.cookie });
    expect(bad.status).toBe(422);
  });

  it('refuses the reserved slug "new" on the server for session and token', async () => {
    const editor = await makeUser('editor');
    for (const o of [{ cookie: editor.cookie }, { bearer: ADMIN_TOKEN }]) {
      const story = await postStory(storyFixture({ slug: 'new' }), o);
      expect(story.status).toBe(422);
      expect((await story.json()).error.issues[0].path).toBe('slug');
      expect((await postPlace(placeFixture({ slug: 'new' }), o)).status).toBe(422);
    }
  });

  it('lets an editor archive a created story through the status route', async () => {
    const editor = await makeUser('editor');
    const name = slug('arch');
    await postStory(storyFixture({ slug: name }), { cookie: editor.cookie });
    const archived = await r.storyStatus.POST(
      req({ method: 'POST', path: `/api/admin/travel/stories/${name}/status`, body: { action: 'archive' }, cookie: editor.cookie }),
      slugParams(name),
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).status).toBe('archived');
  });
});

describe('routes that stay token-only', () => {
  it('reject a session (even admin) and still accept the token', async () => {
    const admin = await makeUser('admin');
    // Delete and templates never opted in (create did in P07-16; collections and
    // integrity moved to session access in P07-15, but collection DELETE stayed token-only).
    const del = (o: Opts) =>
      r.place.DELETE(req({ method: 'DELETE', path: '/api/admin/travel/places/cms-never', ...o }), slugParams('cms-never'));
    expect([401, 403]).toContain((await del({ cookie: admin.cookie })).status);
    expect((await del({ bearer: ADMIN_TOKEN })).status).toBe(404);
    expect([401, 403]).toContain((await r.templates.GET(req({ path: '/api/admin/travel/templates', cookie: admin.cookie }))).status);
    expect((await r.templates.GET(req({ path: '/api/admin/travel/templates', bearer: ADMIN_TOKEN }))).status).toBe(200);
  });
});

const collectionBody = (slug: string) => ({
  slug,
  title: { vi: 'Bộ sưu tập', en: 'Collection' },
  tagline: { vi: 'Khẩu hiệu', en: 'Tagline' },
  description: { vi: ['Mô tả.'], en: ['Description.'] },
  cover: '/images/covers/da-lat.svg',
  destinationSlugs: ['da-lat'],
  storySlugs: [],
  placeSlugs: [],
  seo: {
    title: null,
    description: { vi: 'Mô tả SEO.', en: 'SEO description.' },
    ogImage: null,
    canonicalPath: null,
    noindex: false,
    keywords: { vi: [], en: [] },
  },
});

describe('collections and integrity on session access (P07-15)', () => {
  const base = '/api/admin/travel/collections';
  const list = (o: Opts = {}) => r.collections.GET(req({ path: base, ...o }));
  const create = (slug: string, o: Opts = {}) =>
    r.collections.POST(req({ method: 'POST', path: base, body: collectionBody(slug), ...o }));
  const get = (slug: string, o: Opts = {}) =>
    r.collection.GET(req({ path: `${base}/${slug}`, ...o }), slugParams(slug));
  const patch = (slug: string, body: unknown, o: Opts = {}) =>
    r.collection.PATCH(req({ method: 'PATCH', path: `${base}/${slug}`, body, ...o }), slugParams(slug));
  const status = (slug: string, action: string, o: Opts = {}) =>
    r.collectionStatus.POST(
      req({ method: 'POST', path: `${base}/${slug}/status`, body: { action }, ...o }),
      slugParams(slug),
    );
  const integrity = (o: Opts = {}) => r.integrity.GET(req({ path: '/api/admin/travel/integrity', ...o }));
  const plannerIntegrity = (o: Opts = {}) =>
    r.plannerIntegrity.GET(req({ path: '/api/admin/planner/integrity', ...o }));

  it('admits editor, admin and service; refuses member 403 and nobody 401, on every handler', async () => {
    const editor = await makeUser('editor');
    const admin = await makeUser('admin');
    const member = await makeUser('member');
    expect((await create('col-guard', { bearer: ADMIN_TOKEN })).status).toBe(201);
    for (const o of [{ cookie: editor.cookie }, { cookie: admin.cookie }, { bearer: ADMIN_TOKEN }]) {
      for (const response of [await list(o), await get('col-guard', o), await integrity(o)]) {
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
    }
    const denied = { cookie: member.cookie };
    for (const response of [
      await list(denied),
      await create('col-member', denied),
      await get('col-guard', denied),
      await patch('col-guard', { cover: '/images/covers/da-lat.svg' }, denied),
      await status('col-guard', 'publish', denied),
      await integrity(denied),
    ]) {
      expect(response.status).toBe(403);
    }
    for (const response of [
      await list(),
      await create('col-anon'),
      await get('col-guard'),
      await patch('col-guard', {}),
      await status('col-guard', 'publish'),
      await integrity(),
    ]) {
      expect(response.status).toBe(401);
    }
  });

  it('lets an editor create, edit and change status; the token path still works', async () => {
    const editor = await makeUser('editor');
    expect((await create('col-edit', { cookie: editor.cookie })).status).toBe(201);
    const edited = await patch('col-edit', { tagline: { vi: 'Mới', en: 'New' } }, { cookie: editor.cookie });
    expect(edited.status).toBe(200);
    expect((await edited.json()).tagline.en).toBe('New');
    const published = await status('col-edit', 'publish', { cookie: editor.cookie });
    expect(published.status).toBe(200);
    expect((await published.json()).status).toBe('published');
    expect((await status('col-edit', 'unpublish', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await patch('col-edit', { cover: '/images/covers/da-lat.svg' }, { bearer: ADMIN_TOKEN })).status).toBe(200);
  });

  it('refuses a cross-site cookie mutation on every collection mutation and writes nothing', async () => {
    const editor = await makeUser('editor');
    const evil = { cookie: editor.cookie, origin: 'https://evil.test' };
    await create('col-csrf', { bearer: ADMIN_TOKEN });
    const before = await (await get('col-csrf', { bearer: ADMIN_TOKEN })).json();
    expect((await create('col-csrf-new', evil)).status).toBe(403);
    expect((await patch('col-csrf', { tagline: { vi: 'x', en: 'x' } }, evil)).status).toBe(403);
    expect((await status('col-csrf', 'publish', evil)).status).toBe(403);
    expect((await get('col-csrf', { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect(await (await get('col-csrf', { bearer: ADMIN_TOKEN })).json()).toEqual(before);
    expect((await get('col-csrf-new', { bearer: ADMIN_TOKEN })).status).toBe(404);
  });

  it('applies If-Match to collection PATCH: match 200, stale 412 writing nothing, absent last-write-wins, empty 400', async () => {
    const editor = await makeUser('editor');
    await create('col-ifmatch', { bearer: ADMIN_TOKEN });
    const current = await (await get('col-ifmatch', { bearer: ADMIN_TOKEN })).json();
    const next = { tagline: { vi: 'Khác', en: 'Other' } };

    const stale = await patch('col-ifmatch', next, { cookie: editor.cookie, ifMatch: '"2000-01-01T00:00:00.000Z"' });
    expect(stale.status).toBe(412);
    const staleBody = await stale.json();
    expect(staleBody.error.code).toBe('version_conflict');
    expect(staleBody.error.message).not.toContain('2000-01-01');
    expect(await (await get('col-ifmatch', { bearer: ADMIN_TOKEN })).json()).toEqual(current);

    const ok = await patch('col-ifmatch', next, { cookie: editor.cookie, ifMatch: `"${current.updatedAt}"` });
    expect(ok.status).toBe(200);
    expect((await ok.json()).tagline.en).toBe('Other');

    expect((await patch('col-ifmatch', { tagline: { vi: 'A', en: 'A' } }, { bearer: ADMIN_TOKEN })).status).toBe(200);
    expect((await patch('col-ifmatch', next, { bearer: ADMIN_TOKEN, ifMatch: '""' })).status).toBe(400);
  });

  it('lets exactly one of two concurrent collection PATCHes with the same stamp win', async () => {
    await create('col-race', { bearer: ADMIN_TOKEN });
    const current = await (await get('col-race', { bearer: ADMIN_TOKEN })).json();
    const results = await Promise.all(
      ['a', 'b'].map((n) =>
        patch('col-race', { tagline: { vi: n, en: n } }, { bearer: ADMIN_TOKEN, ifMatch: `"${current.updatedAt}"` }),
      ),
    );
    expect(results.map((x) => x.status).sort()).toEqual([200, 412]);
  });

  it('keeps collection DELETE token-only: sessions refused, token follows the state rule', async () => {
    const editor = await makeUser('editor');
    const admin = await makeUser('admin');
    const superAdmin = await makeUser('super_admin');
    const del = (slug: string, o: Opts = {}) =>
      r.collection.DELETE(req({ method: 'DELETE', path: `${base}/${slug}`, ...o }), slugParams(slug));
    await create('col-del', { bearer: ADMIN_TOKEN });
    for (const who of [editor, admin, superAdmin]) {
      expect([401, 403]).toContain((await del('col-del', { cookie: who.cookie })).status);
    }
    expect((await del('col-del', { cookie: editor.cookie, origin: 'https://evil.test' })).status).not.toBe(204);
    expect((await del('col-del', { bearer: 'not-the-admin-token-not-the-admin-token' })).status).toBe(401);
    expect((await del('col-del')).status).toBe(401);
    expect((await get('col-del', { bearer: ADMIN_TOKEN })).status).toBe(200);

    // A published collection is refused even for the token.
    expect((await status('col-del', 'publish', { bearer: ADMIN_TOKEN })).status).toBe(200);
    const published = await del('col-del', { bearer: ADMIN_TOKEN });
    expect(published.status).toBe(409);
    expect((await published.json()).error.code).toBe('invalid_state');
    expect((await status('col-del', 'unpublish', { bearer: ADMIN_TOKEN })).status).toBe(200);

    expect((await del('col-del', { bearer: ADMIN_TOKEN })).status).toBe(204);
    expect((await get('col-del', { bearer: ADMIN_TOKEN })).status).toBe(404);
  });

  it('planner integrity: admin session and token 200, editor 403, member 403, nobody 401', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const member = await makeUser('member');
    for (const o of [{ cookie: admin.cookie }, { bearer: ADMIN_TOKEN }]) {
      const response = await plannerIntegrity(o);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.ok).toBe('boolean');
      expect(Array.isArray(body.issues)).toBe(true);
    }
    expect((await plannerIntegrity({ cookie: editor.cookie })).status).toBe(403);
    expect((await plannerIntegrity({ cookie: member.cookie })).status).toBe(403);
    expect((await plannerIntegrity()).status).toBe(401);
  });
});

describe('If-Match on content PATCH', () => {
  it('applies on match, refuses stale with version_conflict and writes nothing', async () => {
    const editor = await makeUser('editor');
    const current = await (await getPlace('cms-place', { bearer: ADMIN_TOKEN })).json();
    expect(typeof current.updatedAt).toBe('string');

    const stale = await patchPlace('cms-place', { rating: 2 }, { bearer: ADMIN_TOKEN, ifMatch: '"2000-01-01T00:00:00.000Z"' });
    expect(stale.status).toBe(412);
    const staleBody = await stale.json();
    expect(staleBody.error.code).toBe('version_conflict');
    // The client-supplied stamp is not echoed back (sec review W1).
    expect(staleBody.error.message).not.toContain('2000-01-01');
    const unchanged = await (await getPlace('cms-place', { bearer: ADMIN_TOKEN })).json();
    expect(unchanged).toEqual(current);

    const ok = await patchPlace('cms-place', { rating: 2 }, { cookie: editor.cookie, ifMatch: `"${current.updatedAt}"` });
    expect(ok.status).toBe(200);
    const updated = await ok.json();
    expect(updated.rating).toBe(2);
    expect(updated.updatedAt).not.toBe('');

    // The old stamp is now stale.
    const again = await patchPlace('cms-place', { rating: 5 }, { bearer: ADMIN_TOKEN, ifMatch: `"${current.updatedAt}"` });
    expect(again.status === 412 || current.updatedAt === updated.updatedAt).toBe(true);
  });

  it('treats an absent header as last-write-wins and an empty one as 400', async () => {
    expect((await patchPlace('cms-place', { rating: 4 }, { bearer: ADMIN_TOKEN })).status).toBe(200);
    const empty = await patchPlace('cms-place', { rating: 4 }, { bearer: ADMIN_TOKEN, ifMatch: '""' });
    expect(empty.status).toBe(400);
  });

  it('covers story, review and story-places PATCH', async () => {
    const stale = '"2000-01-01T00:00:00.000Z"';
    const s = await r.story.PATCH(
      req({ method: 'PATCH', path: '/api/admin/travel/stories/cms-story', body: { readingMinutes: 7 }, bearer: ADMIN_TOKEN, ifMatch: stale }),
      slugParams('cms-story'),
    );
    expect(s.status).toBe(412);
    const rv = await r.review.PATCH(
      req({ method: 'PATCH', path: '/api/admin/travel/reviews/cms-review', body: { rating: 3 }, bearer: ADMIN_TOKEN, ifMatch: stale }),
      idParams('cms-review'),
    );
    expect(rv.status).toBe(412);
    const sp = await r.storyPlaces.PATCH(
      req({ method: 'PATCH', path: '/api/admin/travel/stories/cms-story/places', body: { add: ['cms-place'], remove: [] }, bearer: ADMIN_TOKEN, ifMatch: stale }),
      slugParams('cms-story'),
    );
    expect(sp.status).toBe(412);
    const story = await (await r.story.GET(req({ path: '/api/admin/travel/stories/cms-story', bearer: ADMIN_TOKEN }), slugParams('cms-story'))).json();
    expect(story.readingMinutes).not.toBe(7);
    expect(story.placeSlugs).toEqual([]);
    const fresh = await r.story.PATCH(
      req({ method: 'PATCH', path: '/api/admin/travel/stories/cms-story', body: { readingMinutes: 7 }, bearer: ADMIN_TOKEN, ifMatch: `"${story.updatedAt}"` }),
      slugParams('cms-story'),
    );
    expect(fresh.status).toBe(200);
  });

  it('lets exactly one of two concurrent PATCHes with the same stamp win', async () => {
    const current = await (await getPlace('cms-place', { bearer: ADMIN_TOKEN })).json();
    const results = await Promise.all(
      [1, 2].map((n) => patchPlace('cms-place', { rating: n }, { bearer: ADMIN_TOKEN, ifMatch: `"${current.updatedAt}"` })),
    );
    expect(results.map((x) => x.status).sort()).toEqual([200, 412]);
  });
});

describe('readStaffPageAccess', () => {
  async function accessFor(cookieValue: string | null) {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) =>
          name === SESSION_COOKIE && cookieValue ? { name, value: cookieValue } : undefined,
      }),
    }));
    const page = await import('../src/server/planner/admin-page');
    return page.readStaffPageAccess();
  }

  it('maps anonymous, invalid, member, pending password, editor and admin', async () => {
    const admin = await makeUser('admin');
    const editor = await makeUser('editor');
    const member = await makeUser('member');
    const repo = await planner.getPlannerRepository();
    const email = `staff${Date.now()}@example.test`;
    const issued = await repo.createUser({ handle: `staff-${Date.now()}`, displayName: 'Chờ đổi', email, role: 'editor' });
    const pending = await repo.signInWithPassword(email, issued.temporaryPassword!);

    expect(await accessFor(null)).toEqual({ status: 'anonymous' });
    expect(await accessFor('garbage-session-token-garbage-session')).toEqual({ status: 'anonymous' });
    expect(await accessFor(member.cookie)).toEqual({ status: 'forbidden' });
    expect(await accessFor(pending.token)).toEqual({ status: 'must-change-password' });
    expect(await accessFor(editor.cookie)).toMatchObject({ status: 'staff', principal: { kind: 'session', userId: editor.id, role: 'editor' } });
    expect(await accessFor(admin.cookie)).toMatchObject({ status: 'staff', principal: { role: 'admin' } });
    vi.doUnmock('next/headers');
  });
});

describe('update schemas keep absent keys absent', () => {
  it('parses {} to {} for every content update schema', async () => {
    const s = await import('../src/server/content/schemas');
    for (const schema of [
      s.storyUpdateSchema,
      s.placeUpdateSchema,
      s.reviewUpdateSchema,
      s.collectionUpdateSchema,
      s.templateUpdateSchema,
    ]) {
      expect(schema.parse({})).toEqual({});
    }
    expect(s.storyUpdateSchema.parse({ readingMinutes: 8 })).toEqual({ readingMinutes: 8 });
  });

  it('a one-field PATCH leaves defaulted fields untouched', async () => {
    const repo = await content.getRepository();
    await repo.createPlace(placeFixture({ slug: 'keep-place', rating: 4, personalNote: { vi: 'ghi chú', en: 'note' } }));
    await repo.createReview(reviewFixture({ id: 'keep-review', pros: { vi: ['tốt'], en: ['good'] }, cons: { vi: ['xa'], en: ['far'] }, costVnd: 1000 }));
    await repo.createStory(storyFixture({ slug: 'keep-story', placeSlugs: ['keep-place'], reviewIds: ['keep-review'], gallery: ['/images/covers/story-da-lat.svg'] }));

    const place = await (await patchPlace('keep-place', { suggestedMinutes: 90 }, { bearer: ADMIN_TOKEN })).json();
    expect(place).toMatchObject({ suggestedMinutes: 90, rating: 4, personalNote: { vi: 'ghi chú', en: 'note' } });
    const review = await (
      await r.review.PATCH(
        req({ method: 'PATCH', path: '/api/admin/travel/reviews/keep-review', body: { rating: 3 }, bearer: ADMIN_TOKEN }),
        idParams('keep-review'),
      )
    ).json();
    expect(review).toMatchObject({ rating: 3, pros: { vi: ['tốt'], en: ['good'] }, cons: { vi: ['xa'], en: ['far'] }, costVnd: 1000 });
    const story = await (
      await r.story.PATCH(
        req({ method: 'PATCH', path: '/api/admin/travel/stories/keep-story', body: { readingMinutes: 8 }, bearer: ADMIN_TOKEN }),
        slugParams('keep-story'),
      )
    ).json();
    expect(story).toMatchObject({ readingMinutes: 8, placeSlugs: ['keep-place'], reviewIds: ['keep-review'], gallery: ['/images/covers/story-da-lat.svg'] });
  });
});
