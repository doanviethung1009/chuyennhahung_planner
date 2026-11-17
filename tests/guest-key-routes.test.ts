import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BODY = 'Hồ rất đẹp vào buổi sáng, nước trong, đi bộ quanh hồ mất khoảng một tiếng, nên đi sớm.';
let workdir: string;
let route: typeof import('../src/app/api/community/reviews/route');
let planner: typeof import('../src/server/planner/instance');
const secret = process.env.GUEST_KEY_SECRET;

const post = () =>
  route.POST(
    new Request('https://example.test/api/community/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ placeSlug: 'ho-xuan-huong', rating: 5, body: BODY, lang: 'vi', visitedOn: '2026-02-20', authorName: null, website: '' }),
    }),
  );

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'guest-key-routes-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'true';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
  route = await import('../src/app/api/community/reviews/route');
  planner = await import('../src/server/planner/instance');
});
afterAll(async () => {
  process.env.GUEST_KEY_SECRET = secret;
  await rm(workdir, { recursive: true, force: true });
});

describe('POST /api/community/reviews without the guest-key secret (ADR 0024)', () => {
  it('answers 503 service_unavailable, names no value, and stores nothing', async () => {
    delete process.env.GUEST_KEY_SECRET;
    const response = await post();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('service_unavailable');
    expect((await (await planner.getPlannerRepository()).listApprovedReviews()).items).toHaveLength(0);
  });

  it('with the secret the same request is accepted', async () => {
    process.env.GUEST_KEY_SECRET = 'route-test-secret-0123456789abcdef0123';
    expect((await post()).status).toBe(201);
  });
});
