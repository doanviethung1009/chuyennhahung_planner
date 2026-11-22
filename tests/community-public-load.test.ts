import { beforeEach, describe, expect, it, vi } from 'vitest';

// `react`'s `cache` only dedupes inside a request; outside one it calls through.
const listCommunityTrips = vi.fn();
vi.mock('../src/server/planner/instance', () => ({
  getPlannerRepository: async () => ({ listCommunityTrips }),
}));
vi.mock('../src/server/content/instance', () => ({ getRepository: async () => ({}) }));

import { getCommunityTrips, loadCommunityTrips } from '../src/server/community/public';

describe('community trips public read (UXS-1)', () => {
  beforeEach(() => {
    listCommunityTrips.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reports a store failure as not-ok, so the page can say "could not load" instead of "empty"', async () => {
    listCommunityTrips.mockRejectedValue(new Error('connect ECONNREFUSED db.internal:5432'));
    expect(await loadCommunityTrips(48)).toEqual({ ok: false });
  });

  it('keeps the home-page contract: the same failure is still an empty list there', async () => {
    listCommunityTrips.mockRejectedValue(new Error('down'));
    expect(await getCommunityTrips(3)).toEqual([]);
  });

  it('logs only the error class, never its message', async () => {
    listCommunityTrips.mockRejectedValue(new TypeError('password=hunter2'));
    await loadCommunityTrips(24);
    expect(console.error).toHaveBeenCalledWith('[community] could not read the gallery', 'TypeError');
  });

  it('returns the trips on success', async () => {
    listCommunityTrips.mockResolvedValue([]);
    expect(await loadCommunityTrips(5)).toEqual({ ok: true, trips: [] });
    expect(listCommunityTrips).toHaveBeenCalledWith(5);
  });
});
