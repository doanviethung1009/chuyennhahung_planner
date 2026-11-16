import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Exercises the real route handlers against temp JSON file stores, so the
 * authentication wrapper, the zod boundary, the `If-Match` plumbing and the
 * error→status mapping are all covered by the same path a request takes in
 * production.
 */
const ADMIN_TOKEN = 'test-admin-token-at-least-32-chars-long';
const BASE = 'https://example.test';

let workdir: string;
let routes: {
  trips: typeof import('../src/app/api/planner/route');
  trip: typeof import('../src/app/api/planner/[id]/route');
  restore: typeof import('../src/app/api/planner/[id]/restore/route');
  budget: typeof import('../src/app/api/planner/[id]/budget/route');
  day: typeof import('../src/app/api/planner/[id]/days/[dayNumber]/route');
  activities: typeof import('../src/app/api/planner/[id]/activities/route');
  activity: typeof import('../src/app/api/planner/[id]/activities/[activityId]/route');
  reorder: typeof import('../src/app/api/planner/[id]/reorder/route');
  expenses: typeof import('../src/app/api/planner/[id]/expenses/route');
  adminUsers: typeof import('../src/app/api/admin/planner/users/route');
  adminUser: typeof import('../src/app/api/admin/planner/users/[userId]/route');
  adminRotate: typeof import('../src/app/api/admin/planner/users/[userId]/rotate-token/route');
  adminIntegrity: typeof import('../src/app/api/admin/planner/integrity/route');
};

interface RequestOptions {
  token?: string;
  body?: unknown;
  ifMatch?: number | string;
  path?: string;
}

function req(method: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.ifMatch !== undefined) headers['if-match'] = `"${options.ifMatch}"`;

  return new Request(`${BASE}${options.path ?? '/api/planner'}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const params = <T extends Record<string, string>>(value: T) => ({
  params: Promise.resolve(value),
});

/** Response bodies are navigated loosely here on purpose — these tests assert
 * the wire shape, which is exactly what a typed view would paper over. */
const json = (response: Response) => response.json();

/** Provisions a traveller through the admin API and returns their token. */
async function provision(handle: string): Promise<string> {
  const response = await routes.adminUsers.POST(
    req('POST', { token: ADMIN_TOKEN, body: { handle, displayName: 'Người đi chơi' } }),
  );
  expect(response.status).toBe(201);
  return (await json(response)).accessToken as string;
}

const tripBody = (overrides: Record<string, unknown> = {}) => ({
  source: 'blank',
  title: 'Đà Lạt 3 ngày 2 đêm',
  destinationSlug: 'da-lat',
  startDate: '2026-04-10',
  durationDays: 3,
  partySize: 2,
  travelStyle: 'romantic',
  pace: 'relaxed',
  budget: { targetTotalVnd: 5_000_000 },
  ...overrides,
});

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'planner-api-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  // The seed supplies the approved Đà Lạt template the clone test uses.
  delete process.env.TRAVEL_CONTENT_AUTOSEED;
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  routes = {
    trips: await import('../src/app/api/planner/route'),
    trip: await import('../src/app/api/planner/[id]/route'),
    restore: await import('../src/app/api/planner/[id]/restore/route'),
    budget: await import('../src/app/api/planner/[id]/budget/route'),
    day: await import('../src/app/api/planner/[id]/days/[dayNumber]/route'),
    activities: await import('../src/app/api/planner/[id]/activities/route'),
    activity: await import('../src/app/api/planner/[id]/activities/[activityId]/route'),
    reorder: await import('../src/app/api/planner/[id]/reorder/route'),
    expenses: await import('../src/app/api/planner/[id]/expenses/route'),
    adminUsers: await import('../src/app/api/admin/planner/users/route'),
    adminUser: await import('../src/app/api/admin/planner/users/[userId]/route'),
    adminRotate: await import(
      '../src/app/api/admin/planner/users/[userId]/rotate-token/route'
    ),
    adminIntegrity: await import('../src/app/api/admin/planner/integrity/route'),
  };
});

afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('authentication', () => {
  it('rejects a planner request with no token, a short token or a wrong scheme', async () => {
    expect((await routes.trips.GET(req('GET'))).status).toBe(401);
    expect((await routes.trips.GET(req('GET', { token: 'short' }))).status).toBe(401);

    const basic = new Request(`${BASE}/api/planner`, {
      headers: { authorization: 'Basic abcdefghijklmnopqrstuvwxyz1234567890' },
    });
    expect((await routes.trips.GET(basic)).status).toBe(401);
  });

  it('does not let the admin token reach a traveller’s trips', async () => {
    // The admin token provisions users. It is not a planner identity, so it
    // cannot list or read trips at all.
    const response = await routes.trips.GET(req('GET', { token: ADMIN_TOKEN }));
    expect(response.status).toBe(401);
  });

  it('requires the admin token for provisioning, and never returns a digest', async () => {
    expect((await routes.adminUsers.GET(req('GET'))).status).toBe(401);

    const listed = await routes.adminUsers.GET(req('GET', { token: ADMIN_TOKEN }));
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await json(listed))).not.toContain('tokenHash');
  });

  it('invalidates the previous token when one is rotated', async () => {
    const token = await provision('rotate-me');
    const listed = await json(await routes.adminUsers.GET(req('GET', { token: ADMIN_TOKEN })));
    const user = listed.users.find((row: { handle: string }) => row.handle === 'rotate-me');

    const rotated = await json(
      await routes.adminRotate.POST(
        req('POST', { token: ADMIN_TOKEN }),
        params({ userId: user.id }),
      ),
    );

    expect((await routes.trips.GET(req('GET', { token }))).status).toBe(401);
    expect((await routes.trips.GET(req('GET', { token: rotated.accessToken }))).status).toBe(200);
  });
});

describe('trip lifecycle over HTTP', () => {
  it('creates a trip with its days and advertises the version as an ETag', async () => {
    const token = await provision('create-flow');

    const response = await routes.trips.POST(req('POST', { token, body: tripBody() }));
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const { trip, days, budget } = await json(response);
    expect(days).toHaveLength(3);
    expect(trip.endDate).toBe('2026-04-12');
    expect(budget.targetTotalVnd).toBe(5_000_000);
    // Money is a JSON number, not a string — the BigInt boundary holds.
    expect(typeof budget.targetTotalVnd).toBe('number');
  });

  it('rejects a malformed body with 422 and a field path', async () => {
    const token = await provision('bad-body');

    const response = await routes.trips.POST(
      req('POST', { token, body: tripBody({ durationDays: 99, partySize: 0 }) }),
    );

    expect(response.status).toBe(422);
    const body = await json(response);
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.issues.map((issue: { path: string }) => issue.path)).toContain(
      'durationDays',
    );
  });

  it('walks the whole flow: activity, reorder, expense, budget', async () => {
    const token = await provision('full-flow');
    const created = await json(await routes.trips.POST(req('POST', { token, body: tripBody() })));
    const id = created.trip.id;

    const first = await routes.activities.POST(
      req('POST', {
        token,
        path: `/api/planner/${id}/activities`,
        body: {
          dayNumber: 1,
          title: 'Ăn sáng bánh ướt lòng gà',
          durationMinutes: 45,
          estimatedCostVnd: 90_000,
          category: 'food',
        },
      }),
      params({ id }),
    );
    expect(first.status).toBe(201);

    const second = await json(
      await routes.activities.POST(
        req('POST', {
          token,
          path: `/api/planner/${id}/activities`,
          body: {
            dayNumber: 1,
            placeSlug: 'vuon-ca-phe-me-linh',
            durationMinutes: 120,
            estimatedCostVnd: 250_000,
          },
        }),
        params({ id }),
      ),
    );
    // Title and category inferred from the catalog place: the title is the
    // place's own Vietnamese name, not a template's prose.
    expect(second.days[0].activities[1].title).toBe('Cà phê Mê Linh');
    expect(second.days[0].activities[1].category).toBe('food');

    const ids = second.days[0].activities.map((a: { id: string }) => a.id);
    const reordered = await routes.reorder.PATCH(
      req('PATCH', {
        token,
        path: `/api/planner/${id}/reorder`,
        ifMatch: second.trip.version,
        body: { op: 'reorder-day', dayNumber: 1, activityIds: [ids[1], ids[0]] },
      }),
      params({ id }),
    );
    expect(reordered.status).toBe(200);
    const afterReorder = await json(reordered);
    expect(afterReorder.days[0].activities.map((a: { id: string }) => a.id)).toEqual([
      ids[1],
      ids[0],
    ]);

    const moved = await json(
      await routes.reorder.PATCH(
        req('PATCH', {
          token,
          path: `/api/planner/${id}/reorder`,
          ifMatch: afterReorder.trip.version,
          body: { op: 'move-activity', activityId: ids[0], toDayNumber: 2, toIndex: 0 },
        }),
        params({ id }),
      ),
    );
    expect(moved.days[0].activities).toHaveLength(1);
    expect(moved.days[1].activities.map((a: { id: string }) => a.id)).toEqual([ids[0]]);

    const paid = await routes.expenses.POST(
      req('POST', {
        token,
        path: `/api/planner/${id}/expenses`,
        body: {
          label: 'Cà phê Mê Linh',
          category: 'food',
          amountVnd: 310_000,
          activityId: ids[1],
        },
      }),
      params({ id }),
    );
    expect(paid.status).toBe(201);

    const { budget } = await json(
      await routes.budget.GET(
        req('GET', { token, path: `/api/planner/${id}/budget` }),
        params({ id }),
      ),
    );
    expect(budget.estimatedTotalVnd).toBe(340_000);
    expect(budget.actualTotalVnd).toBe(310_000);
    // 310.000 paid + 90.000 still unpaid — not 650.000.
    expect(budget.projectedTotalVnd).toBe(400_000);

    const titled = await routes.day.PATCH(
      req('PATCH', {
        token,
        path: `/api/planner/${id}/days/1`,
        ifMatch: (await json(await routes.trip.GET(req('GET', { token }), params({ id })))).trip
          .version,
        body: { title: 'Ngày nhẹ nhàng' },
      }),
      params({ id, dayNumber: '1' }),
    );
    expect(titled.status).toBe(200);
    expect((await json(titled)).days[0].title).toBe('Ngày nhẹ nhàng');
  });

  it('clones the approved template through the API', async () => {
    const token = await provision('clone-flow');

    const response = await routes.trips.POST(
      req('POST', {
        token,
        body: {
          source: 'template',
          templateSlug: 'da-lat-3-ngay-lang-man',
          startDate: '2026-04-10',
          partySize: 2,
          budget: { targetTotalVnd: 5_000_000 },
        },
      }),
    );

    expect(response.status).toBe(201);
    const { trip, days } = await json(response);
    expect(days).toHaveLength(3);
    expect(days.flatMap((day: { activities: unknown[] }) => day.activities)).toHaveLength(8);
    expect(trip.sourceTemplate.templateSlug).toBe('da-lat-3-ngay-lang-man');
  });

  it('refuses to clone a template that is not approved', async () => {
    const token = await provision('clone-denied');

    const response = await routes.trips.POST(
      req('POST', {
        token,
        body: {
          source: 'template',
          templateSlug: 'khong-ton-tai',
          startDate: null,
          partySize: 2,
          budget: { targetTotalVnd: 5_000_000 },
        },
      }),
    );

    expect(response.status).toBe(422);
    expect((await json(response)).error.code).toBe('invalid_reference');
  });
});

describe('optimistic concurrency over HTTP', () => {
  it('answers 428 with no If-Match and 412 on a stale one', async () => {
    const token = await provision('concurrency');
    const created = await json(await routes.trips.POST(req('POST', { token, body: tripBody() })));
    const id = created.trip.id;

    const missing = await routes.trip.PATCH(
      req('PATCH', { token, path: `/api/planner/${id}`, body: { title: 'Không If-Match' } }),
      params({ id }),
    );
    expect(missing.status).toBe(428);
    expect((await json(missing)).error.code).toBe('precondition_required');

    const ok = await routes.trip.PATCH(
      req('PATCH', {
        token,
        path: `/api/planner/${id}`,
        ifMatch: 1,
        body: { partySize: 4 },
      }),
      params({ id }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('etag')).toBe('"2"');

    const stale = await routes.trip.PATCH(
      req('PATCH', {
        token,
        path: `/api/planner/${id}`,
        ifMatch: 1,
        body: { partySize: 6 },
      }),
      params({ id }),
    );
    expect(stale.status).toBe(412);
    expect((await json(stale)).error.code).toBe('version_conflict');

    // The accepted write stands.
    const current = await json(await routes.trip.GET(req('GET', { token }), params({ id })));
    expect(current.trip.partySize).toBe(4);
  });

  it('rejects an If-Match that is not a version', async () => {
    const token = await provision('bad-if-match');
    const created = await json(await routes.trips.POST(req('POST', { token, body: tripBody() })));
    const id = created.trip.id;

    const response = await routes.trip.PATCH(
      req('PATCH', { token, path: `/api/planner/${id}`, ifMatch: 'abc', body: { partySize: 3 } }),
      params({ id }),
    );
    expect(response.status).toBe(400);
  });
});

describe('isolation between travellers', () => {
  it('answers 404 for another traveller’s trip on every verb', async () => {
    const mine = await provision('owner-a');
    const theirs = await provision('owner-b');
    const created = await json(
      await routes.trips.POST(req('POST', { token: mine, body: tripBody() })),
    );
    const id = created.trip.id;

    const get = await routes.trip.GET(req('GET', { token: theirs }), params({ id }));
    expect(get.status).toBe(404);

    const patch = await routes.trip.PATCH(
      req('PATCH', { token: theirs, path: `/api/planner/${id}`, ifMatch: 1, body: { partySize: 9 } }),
      params({ id }),
    );
    expect(patch.status).toBe(404);

    const add = await routes.activities.POST(
      req('POST', {
        token: theirs,
        path: `/api/planner/${id}/activities`,
        body: { dayNumber: 1, title: 'Chiếm quyền', durationMinutes: 30, estimatedCostVnd: 0 },
      }),
      params({ id }),
    );
    expect(add.status).toBe(404);

    const remove = await routes.trip.DELETE(
      req('DELETE', { token: theirs, path: `/api/planner/${id}`, ifMatch: 1 }),
      params({ id }),
    );
    expect(remove.status).toBe(404);

    // Untouched, and still only in the owner's list.
    const owned = await json(await routes.trip.GET(req('GET', { token: mine }), params({ id })));
    expect(owned.trip.partySize).toBe(2);
    expect(owned.trip.version).toBe(1);

    const theirList = await json(await routes.trips.GET(req('GET', { token: theirs })));
    expect(theirList.trips).toHaveLength(0);
  });
});

describe('archive, restore and permanent delete', () => {
  it('archives on DELETE, restores on request, and erases only when asked twice', async () => {
    const token = await provision('lifecycle');
    const created = await json(await routes.trips.POST(req('POST', { token, body: tripBody() })));
    const id = created.trip.id;

    // A permanent delete of a live trip is refused.
    const early = await routes.trip.DELETE(
      req('DELETE', { token, path: `/api/planner/${id}?purge=true`, ifMatch: 1 }),
      params({ id }),
    );
    expect(early.status).toBe(409);

    const archived = await routes.trip.DELETE(
      req('DELETE', { token, path: `/api/planner/${id}`, ifMatch: 1 }),
      params({ id }),
    );
    expect(archived.status).toBe(200);
    const archivedBody = await json(archived);
    expect(archivedBody.trip.status).toBe('archived');

    // Gone from the default list, findable with ?status=archived.
    expect((await json(await routes.trips.GET(req('GET', { token })))).trips).toHaveLength(0);
    const listed = await json(
      await routes.trips.GET(req('GET', { token, path: '/api/planner?status=archived' })),
    );
    expect(listed.trips.map((trip: { id: string }) => trip.id)).toEqual([id]);

    const restored = await routes.restore.POST(
      req('POST', {
        token,
        path: `/api/planner/${id}/restore`,
        ifMatch: archivedBody.trip.version,
      }),
      params({ id }),
    );
    expect(restored.status).toBe(200);
    const restoredBody = await json(restored);
    expect(restoredBody.trip.status).toBe('active');

    // Archive again, then purge for real.
    const reArchived = await json(
      await routes.trip.DELETE(
        req('DELETE', {
          token,
          path: `/api/planner/${id}`,
          ifMatch: restoredBody.trip.version,
        }),
        params({ id }),
      ),
    );
    const purged = await routes.trip.DELETE(
      req('DELETE', {
        token,
        path: `/api/planner/${id}?purge=true`,
        ifMatch: reArchived.trip.version,
      }),
      params({ id }),
    );
    expect(purged.status).toBe(204);
    expect((await routes.trip.GET(req('GET', { token }), params({ id }))).status).toBe(404);
  });
});

describe('provisioning', () => {
  it('deletes a traveller together with their trips, and 404s on an unknown one', async () => {
    const token = await provision('still-owns');
    await routes.trips.POST(req('POST', { token, body: tripBody() }));

    const listed = await json(await routes.adminUsers.GET(req('GET', { token: ADMIN_TOKEN })));
    const user = listed.users.find((row: { handle: string }) => row.handle === 'still-owns');

    const blocked = await routes.adminUser.DELETE(
      req('DELETE', { token: ADMIN_TOKEN }),
      params({ userId: user.id }),
    );
    expect(blocked.status).toBe(204);
    const after = await json(await routes.adminUsers.GET(req('GET', { token: ADMIN_TOKEN })));
    expect(after.users.some((row: { handle: string }) => row.handle === 'still-owns')).toBe(false);

    const unknown = await routes.adminUser.DELETE(
      req('DELETE', { token: ADMIN_TOKEN }),
      params({ userId: 'usr_nope' }),
    );
    expect(unknown.status).toBe(404);
  });

  it('rejects a duplicate handle with 409', async () => {
    await provision('duplicate-me');
    const again = await routes.adminUsers.POST(
      req('POST', {
        token: ADMIN_TOKEN,
        body: { handle: 'duplicate-me', displayName: 'Ai đó khác' },
      }),
    );
    expect(again.status).toBe(409);
  });
});

describe('integrity sweep', () => {
  it('is operator-only and reports a clean document as ok', async () => {
    const token = await provision('integrity-flow');
    await routes.trips.POST(req('POST', { token, body: tripBody() }));

    // A traveller token is not an operator token, even for a read-only sweep.
    expect((await routes.adminIntegrity.GET(req('GET', { token }))).status).toBe(401);
    expect((await routes.adminIntegrity.GET(req('GET'))).status).toBe(401);

    const response = await routes.adminIntegrity.GET(req('GET', { token: ADMIN_TOKEN }));
    expect(response.status).toBe(200);
    const body = await json(response);
    // Earlier tests in this file left trips behind in the same store; they were
    // all written through the repository, so the sweep must find nothing.
    expect(body).toEqual({ ok: true, issues: [] });
  });
});

describe('duplicate over HTTP', () => {
  it('accepts a POST with an empty body, as a browser or curl sends it', async () => {
    const token = await provision('duplicate-bare-post');
    const created = await routes.trips.POST(req('POST', { token, body: tripBody() }));
    const { trip } = await json(created);
    const duplicate = await import('../src/app/api/planner/[id]/duplicate/route');

    // Under Next an empty POST still has a (zero-length) body stream, so the
    // handler cannot rely on `request.body === null`.
    const bare = new Request(`${BASE}/api/planner/${trip.id}/duplicate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: '',
    });
    const response = await duplicate.POST(bare, params({ id: trip.id }));

    expect(response.status).toBe(201);
    const copy = (await json(response)).trip;
    expect(copy.id).not.toBe(trip.id);
    expect(copy.duplicatedFromTripId).toBe(trip.id);
    expect(copy.startDate).toBe(trip.startDate);
  });
});
