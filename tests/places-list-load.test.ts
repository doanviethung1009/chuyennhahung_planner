import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import { bilingual, makeRepository, placeFixture } from './travel-content-helpers';
import { CATALOGUE_TTL_MS, invalidateCatalogueCache } from '../src/server/public-catalogue-cache';
import { invalidateOverviewCacheAfter } from '../src/server/overview-cache';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));

let repo: TravelContentRepository;
let reads: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  invalidateCatalogueCache();
  repo = makeRepository();
  holder.repo = repo;
  await repo.createPlace(placeFixture({ slug: 'a', name: bilingual('Quán Đà Lạt', 'Dalat cafe') }));
  await repo.createPlace(placeFixture({ slug: 'b', name: bilingual('Chợ', 'Market'), destinationSlug: 'hoi-an', category: 'market' }));
  reads = vi.spyOn(repo, 'listPlaces') as unknown as ReturnType<typeof vi.fn>;
});

afterEach(() => {
  vi.useRealTimers();
});

async function api() {
  return import('../src/server/content/public-places');
}

describe('public catalogue cache', () => {
  it('reads the store once for many different searches and pages', async () => {
    const { searchPublicPlaces, loadPublicPlaces } = await api();
    await searchPublicPlaces({ q: 'da lat', page: 1 });
    await searchPublicPlaces({ q: 'chợ', page: 1 });
    await searchPublicPlaces({ category: 'market', page: 2 });
    await Promise.all([searchPublicPlaces({ page: 1 }), searchPublicPlaces({ page: 1 })]);
    await loadPublicPlaces('hoi-an');
    expect(reads).toHaveBeenCalledTimes(1);
    expect(reads).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('filters by the province of the place destination, over the cached read', async () => {
    const { searchPublicPlaces } = await api();
    // 'a' sits in the fixture's default destination; 'b' in hoi-an, which is in Đà Nẵng.
    const danang = await searchPublicPlaces({ provinceSlug: 'da-nang', page: 1 });
    expect(danang.places.map((p) => p.slug)).toEqual(['b']);
    expect((await searchPublicPlaces({ provinceSlug: 'cao-bang', page: 1 })).total).toBe(0);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight read between cold concurrent requests', async () => {
    const { searchPublicPlaces } = await api();
    const results = await Promise.all([
      searchPublicPlaces({ page: 1 }),
      searchPublicPlaces({ q: 'chợ', page: 1 }),
      searchPublicPlaces({ category: 'market', page: 1 }),
    ]);
    expect(results.map((r) => r.total)).toEqual([2, 1, 1]);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('gives the same results as the store-side search', async () => {
    const { searchPublicPlaces } = await api();
    for (const q of ['da lat', 'Đà Lạt', 'MARKET', 'zzz']) {
      const viaCache = (await searchPublicPlaces({ q, page: 1 })).places.map((p) => p.slug);
      const viaStore = (await repo.listPlaces({ q })).map((p) => p.slug);
      expect(viaCache).toEqual(viaStore);
    }
    expect((await searchPublicPlaces({ destinationSlug: 'hoi-an', page: 1 })).places.map((p) => p.slug)).toEqual(['b']);
  });

  it('refetches once the entry is older than the TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { searchPublicPlaces } = await api();
    await searchPublicPlaces({ page: 1 });
    vi.setSystemTime(Date.now() + CATALOGUE_TTL_MS - 1);
    await searchPublicPlaces({ page: 1 });
    expect(reads).toHaveBeenCalledTimes(1);
    await repo.deletePlace('a');
    vi.setSystemTime(Date.now() + 2);
    expect((await searchPublicPlaces({ page: 1 })).total).toBe(1);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('treats an entry exactly TTL old as expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { searchPublicPlaces } = await api();
    await searchPublicPlaces({ page: 1 });
    vi.setSystemTime(Date.now() + CATALOGUE_TTL_MS);
    await searchPublicPlaces({ page: 1 });
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('shows an admin change at once after a state-changing request, not after a GET', async () => {
    const { searchPublicPlaces } = await api();
    expect((await searchPublicPlaces({ page: 1 })).total).toBe(2);
    await repo.deletePlace('a');
    invalidateOverviewCacheAfter(new Request('http://x/api', { method: 'GET' }));
    expect((await searchPublicPlaces({ page: 1 })).total).toBe(2);
    invalidateOverviewCacheAfter(new Request('http://x/api', { method: 'DELETE' }));
    expect((await searchPublicPlaces({ page: 1 })).total).toBe(1);
  });

  it('does not cache a failed read', async () => {
    const { searchPublicPlaces } = await api();
    reads.mockRejectedValueOnce(new Error('down'));
    await expect(searchPublicPlaces({ page: 1 })).rejects.toThrow('down');
    expect((await searchPublicPlaces({ page: 1 })).total).toBe(2);
  });

  it('keeps the allow-list: no affiliate links or timestamps', async () => {
    const { searchPublicPlaces } = await api();
    const keys = Object.keys((await searchPublicPlaces({ page: 1 })).places[0]!);
    expect(keys).not.toContain('affiliateLinks');
    expect(keys).not.toContain('updatedAt');
  });
});
