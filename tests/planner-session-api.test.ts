import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/server/planner/auth';

/**
 * The HTTP half of ADR 0004: the cookie's attributes, and the same-origin rule
 * that cookie authentication obliges us to enforce (§4). Run against the real
 * route handlers, because that rule lives in `plannerRoute` and a test that
 * called the repository directly would not exercise it at all.
 */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const ORIGIN = 'https://example.test';
const EVIL = 'https://not-our-site.test';

let workdir: string;
let routes: {
  trips: typeof import('../src/app/api/planner/route');
  trip: typeof import('../src/app/api/planner/[id]/route');
  session: typeof import('../src/app/api/planner/session/route');
  adminUsers: typeof import('../src/app/api/admin/planner/users/route');
};

interface Options {
  method?: string;
  path?: string;
  body?: unknown;
  bearer?: string;
  cookie?: string;
  origin?: string;
  fetchSite?: string;
  ifMatch?: number;
}

function req(options: Options = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
  if (options.cookie) headers.cookie = `${SESSION_COOKIE}=${options.cookie}`;
  if (options.origin) headers.origin = options.origin;
  if (options.fetchSite) headers['sec-fetch-site'] = options.fetchSite;
  if (options.ifMatch !== undefined) headers['if-match'] = `"${options.ifMatch}"`;

  return new Request(`${ORIGIN}${options.path ?? '/api/planner'}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const params = <T extends Record<string, string>>(value: T) => ({
  params: Promise.resolve(value),
});

const json = (response: Response) => response.json();

/** Parses `Set-Cookie` into the value and a lowercase attribute set. */
function setCookie(response: Response): { value: string; attributes: string[] } {
  const header = response.headers.get('set-cookie');
  expect(header, 'no Set-Cookie on the response').toBeTruthy();
  const [pair, ...rest] = header!.split(';');
  return {
    value: pair!.slice(pair!.indexOf('=') + 1),
    attributes: rest.map((part) => part.trim().toLowerCase()),
  };
}

const tripBody = {
  source: 'blank',
  title: 'Đà Lạt 3 ngày 2 đêm',
  destinationSlug: 'da-lat',
  startDate: '2026-04-10',
  durationDays: 3,
  partySize: 2,
  budget: { targetTotalVnd: 5_000_000 },
};

async function provision(handle: string): Promise<string> {
  const response = await routes.adminUsers.POST(
    req({
      method: 'POST',
      bearer: ADMIN_TOKEN,
      body: { handle, displayName: 'Người đi chơi' },
    }),
  );
  expect(response.status).toBe(201);
  return (await json(response)).accessToken as string;
}

/** Provisions a traveller, signs them in, and returns both credentials. */
async function signedIn(handle: string): Promise<{ bearer: string; cookie: string }> {
  const bearer = await provision(handle);
  const response = await routes.session.POST(
    req({ method: 'POST', path: '/api/planner/session', body: { accessToken: bearer } }),
  );
  expect(response.status).toBe(201);
  return { bearer, cookie: setCookie(response).value };
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-session-api-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  routes = {
    trips: await import('../src/app/api/planner/route'),
    trip: await import('../src/app/api/planner/[id]/route'),
    session: await import('../src/app/api/planner/session/route'),
    adminUsers: await import('../src/app/api/admin/planner/users/route'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('the session cookie', () => {
  it('is HttpOnly, Secure, SameSite=Lax and scoped to the whole site', async () => {
    const bearer = await provision('cookie-shape');

    const response = await routes.session.POST(
      req({ method: 'POST', path: '/api/planner/session', body: { accessToken: bearer } }),
    );

    expect(response.status).toBe(201);
    const { value, attributes } = setCookie(response);
    // HttpOnly is the whole point: JavaScript must never read this.
    expect(attributes).toContain('httponly');
    expect(attributes).toContain('samesite=lax');
    expect(attributes).toContain('path=/');
    // The request is https, so Secure is set.
    expect(attributes).toContain('secure');
    expect(attributes.some((a) => a.startsWith('max-age='))).toBe(true);
    expect(value.length).toBeGreaterThanOrEqual(32);
  });

  it('never puts the session token in the response body', async () => {
    const bearer = await provision('no-token-in-body');
    const response = await routes.session.POST(
      req({ method: 'POST', path: '/api/planner/session', body: { accessToken: bearer } }),
    );

    const { value } = setCookie(response);
    const body = await json(response);
    expect(body.user.handle).toBe('no-token-in-body');
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(body)).not.toContain(value);
  });

  it('authenticates a read, with no Origin needed', async () => {
    const { cookie } = await signedIn('cookie-reads');

    const response = await routes.trips.GET(req({ cookie }));
    expect(response.status).toBe(200);
    expect((await json(response)).trips).toEqual([]);
  });

  it('refuses a bad access token with 401 and sets no cookie', async () => {
    const response = await routes.session.POST(
      req({
        method: 'POST',
        path: '/api/planner/session',
        body: { accessToken: 'x'.repeat(64) },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears the cookie on sign-out, and the cookie stops working', async () => {
    const { cookie } = await signedIn('sign-out-flow');

    const out = await routes.session.DELETE(
      req({ method: 'DELETE', path: '/api/planner/session', cookie, fetchSite: 'same-origin' }),
    );
    expect(out.status).toBe(204);
    expect(setCookie(out).attributes).toContain('max-age=0');

    expect((await routes.trips.GET(req({ cookie }))).status).toBe(401);
  });
});

describe('the same-origin rule on mutations', () => {
  it('refuses a cookie-authenticated mutation that states no origin', async () => {
    const { cookie, bearer } = await signedIn('csrf-silent');
    const created = await json(
      await routes.trips.POST(req({ method: 'POST', bearer, body: tripBody })),
    );
    const id = created.trip.id;

    // A browser always states its origin on a non-GET. Something that does not
    // is not a browser, and should be using the token instead.
    const response = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        cookie,
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );

    expect(response.status).toBe(403);
    expect((await json(response)).error.code).toBe('forbidden');
  });

  it('refuses a cross-site Origin and a cross-site Sec-Fetch-Site', async () => {
    const { cookie, bearer } = await signedIn('csrf-cross');
    const created = await json(
      await routes.trips.POST(req({ method: 'POST', bearer, body: tripBody })),
    );
    const id = created.trip.id;

    const byOrigin = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        cookie,
        origin: EVIL,
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );
    expect(byOrigin.status).toBe(403);

    const byFetchSite = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        cookie,
        fetchSite: 'cross-site',
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );
    expect(byFetchSite.status).toBe(403);

    // Nothing was applied by either attempt.
    const current = await json(await routes.trip.GET(req({ cookie }), params({ id })));
    expect(current.trip.partySize).toBe(2);
    expect(current.trip.version).toBe(1);
  });

  it('allows a same-origin mutation, stated either way', async () => {
    const { cookie, bearer } = await signedIn('csrf-ok');
    const created = await json(
      await routes.trips.POST(req({ method: 'POST', bearer, body: tripBody })),
    );
    const id = created.trip.id;

    const byOrigin = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        cookie,
        origin: ORIGIN,
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );
    expect(byOrigin.status).toBe(200);

    const byFetchSite = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        cookie,
        fetchSite: 'same-origin',
        ifMatch: 2,
        body: { partySize: 5 },
      }),
      params({ id }),
    );
    expect(byFetchSite.status).toBe(200);
    expect((await json(byFetchSite)).trip.partySize).toBe(5);
  });

  it('leaves the bearer path working without an Origin, but still refuses a cross-site one', async () => {
    const bearer = await provision('bearer-unchanged');
    const created = await json(
      await routes.trips.POST(req({ method: 'POST', bearer, body: tripBody })),
    );
    const id = created.trip.id;

    // Scripts and curl send no Origin and carry no CSRF risk.
    const plain = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        bearer,
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );
    expect(plain.status).toBe(200);

    // But if a request *does* state a cross-site origin, it is refused whatever
    // credential it used — a browser should never be able to drive this API
    // from another site.
    const crossSite = await routes.trip.PATCH(
      req({
        method: 'PATCH',
        path: `/api/planner/${id}`,
        bearer,
        origin: EVIL,
        ifMatch: 2,
        body: { partySize: 6 },
      }),
      params({ id }),
    );
    expect(crossSite.status).toBe(403);
  });

  it('refuses a cross-site sign-in, which would otherwise fixate a session', async () => {
    const bearer = await provision('login-csrf');

    const response = await routes.session.POST(
      req({
        method: 'POST',
        path: '/api/planner/session',
        origin: EVIL,
        body: { accessToken: bearer },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
