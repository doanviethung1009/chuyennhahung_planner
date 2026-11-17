import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentError } from '../src/server/content/errors';

vi.mock('../src/server/planner/instance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/server/planner/instance')>();
  const failing = {
    check: async () => {
      throw new ContentError('service_unavailable', 'the rate limiter database is unavailable');
    },
  };
  return { ...actual, getWriteLimiters: async () => ({ report: failing }) };
});

let workdir: string;
beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'reports-failclosed-'));
  process.env.TRAVEL_CONTENT_STORE = join(workdir, 'content.json');
  process.env.TRAVEL_CONTENT_AUTOSEED = 'false';
  process.env.PLANNER_STORE = join(workdir, 'planner.json');
  delete process.env.PLANNER_DATABASE_URL;
});
afterAll(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe('POST /api/community/reports fails closed', () => {
  it('503 service_unavailable when the limiter database is down, and nothing is stored', async () => {
    const route = await import('../src/app/api/community/reports/route');
    const planner = await import('../src/server/planner/instance');
    const response = await route.POST(
      new Request('https://example.test/api/community/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetKind: 'review', targetId: 'rev_1', reason: 'spam' }),
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('service_unavailable');
    expect(await (await planner.getPlannerRepository()).listReports()).toEqual([]);
  });
});
