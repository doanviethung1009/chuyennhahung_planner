import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { placeFixture } from './travel-content-helpers';
import { guestKeyOf, readGuestKeySecret } from '../src/server/community/guest-key';

/**
 * QC F3: the hourly guest review limit leaves a `guest_limit` audit event on the
 * guest's latest review, through the real route (ADR 0014, ADR 0024). The unit
 * coverage is in `community-reviews.test.ts`; this guards the wiring in the route
 * and that the staff queue shows the time but never the client key or address.
 */
const ORIGIN = 'https://example.test';
const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
const IP = '198.51.100.7';

const ENV_KEYS = ['TRAVEL_CONTENT_STORE', 'TRAVEL_CONTENT_AUTOSEED', 'PLANNER_STORE', 'PLANNER_DATABASE_URL'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

let workdir: string;
let guestRoute: typeof import('../src/app/api/community/reviews/route');
let planner: typeof import('../src/server/planner/instance');

function guestPost(ip: string) {
  return new Request(`${ORIGIN}/api/community/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ placeSlug: 'gl-place', rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorName: null }),
  });
}

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'guest-limit-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  guestRoute = await import('../src/app/api/community/reviews/route');
  planner = await import('../src/server/planner/instance');
  const content = await import('../src/server/content/instance');
  await (await content.getRepository()).createPlace(placeFixture({ slug: 'gl-place' }));
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await rm(workdir, { recursive: true, force: true });
});

describe('guest_limit over HTTP', () => {
  it('records one event on the refused guest\'s latest review only, with no key or address', async () => {
    const OTHER = '198.51.100.8';
    expect((await guestRoute.POST(guestPost(OTHER))).status).toBe(201); // a different client, never refused
    for (let i = 0; i < 10; i += 1) expect((await guestRoute.POST(guestPost(IP))).status).toBe(201);
    // Two refused posts in the same hour: still a single event.
    expect((await guestRoute.POST(guestPost(IP))).status).toBe(429);
    expect((await guestRoute.POST(guestPost(IP))).status).toBe(429);

    const repo = await planner.getPlannerRepository();
    const queue = await repo.listReviewQueue();
    expect(queue).toHaveLength(11);
    const withLimit = queue.filter((r) => r.guestLimitAt);
    expect(withLimit).toHaveLength(1);
    const events = (await repo.listEvents(withLimit[0]!.id)).filter((e) => e.action === 'guest_limit');
    expect(events).toHaveLength(1);
    expect(events[0]!.actorId).toBe('system');

    const secret = readGuestKeySecret();
    const output = JSON.stringify([events, queue]);
    for (const leaked of [IP, OTHER, guestKeyOf(secret, IP)]) expect(output).not.toContain(leaked);
  });
});
