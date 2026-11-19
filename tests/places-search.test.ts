import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import { bilingual, makeRepository, placeFixture } from './travel-content-helpers';
import { foldText, foldedIncludes } from '../src/lib/fold';
import { listQuerySchema } from '../src/server/content/schemas';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));

let repo: TravelContentRepository;

async function seed() {
  await repo.createPlace(
    placeFixture({ slug: 'cafe-a', name: bilingual('Quán Cà Phê Đà Lạt', 'Dalat Coffee'), location: bilingual('Đường Trần Phú', 'Tran Phu street') }),
  );
  await repo.createPlace(
    placeFixture({ slug: 'cafe-b', name: bilingual('Hội An Quán', 'Hoi An Eatery'), destinationSlug: 'hoi-an', category: 'restaurant', location: bilingual('Phố cổ', 'Old town') }),
  );
  await repo.createPlace(
    placeFixture({ slug: 'cafe-c', name: bilingual('Chợ đêm', 'Night market'), category: 'market', location: bilingual('Trung tâm Đà Lạt', 'Central Da Lat') }),
  );
}

beforeEach(() => {
  repo = makeRepository();
  holder.repo = repo;
});

describe('foldText / foldedIncludes', () => {
  it('drops tone marks, case and maps đ/Đ', () => {
    expect(foldText('Đà Lạt')).toBe('da lat');
    expect(foldText('ĐƯỜNG Điện Biên')).toBe('duong dien bien');
    expect(foldText('Phở')).toBe('pho');
  });
  it('matches by plain substring across several fields', () => {
    expect(foldedIncludes(['Quán Cà Phê', 'x'], foldText('CA phe'))).toBe(true);
    expect(foldedIncludes(['abc'], foldText('d'))).toBe(false);
  });
  it('never interprets the needle as a pattern', () => {
    expect(foldedIncludes(['abc'], '.*')).toBe(false);
    expect(foldedIncludes(['a.*b'], '.*')).toBe(true);
    expect(foldedIncludes(['100%'], '%')).toBe(true);
    expect(foldedIncludes(['abc'], '%')).toBe(false);
    expect(foldedIncludes(['abc'], '_')).toBe(false);
  });
});

describe('listPlaces with q', () => {
  it('finds the same places with and without diacritics', async () => {
    await seed();
    const a = await repo.listPlaces({ q: 'da lat' });
    const b = await repo.listPlaces({ q: 'Đà Lạt' });
    expect(a.map((p) => p.slug)).toEqual(['cafe-a', 'cafe-c']);
    expect(b.map((p) => p.slug)).toEqual(['cafe-a', 'cafe-c']);
  });
  it('matches English and location text, not the category label', async () => {
    await seed();
    expect((await repo.listPlaces({ q: 'old town' })).map((p) => p.slug)).toEqual(['cafe-b']);
    expect(await repo.listPlaces({ q: 'restaurant' })).toEqual([]);
  });
  it('combines with filters and runs before paging', async () => {
    await seed();
    expect((await repo.listPlaces({ q: 'da lat', category: 'market' })).map((p) => p.slug)).toEqual(['cafe-c']);
    const second = await repo.listPlaces({ q: 'da lat', limit: 1, offset: 1 });
    expect(second.map((p) => p.slug)).toEqual(['cafe-c']);
  });
  it('is unchanged when q is omitted', async () => {
    await seed();
    expect(await repo.listPlaces({ limit: 100 })).toHaveLength(3);
  });
});

describe('q bounds', () => {
  it('trims, and rejects empty-after-trim and over 80 characters', () => {
    expect(listQuerySchema.parse({ q: '  da lat  ' }).q).toBe('da lat');
    expect(listQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ q: 'a'.repeat(80) }).success).toBe(true);
    expect(listQuerySchema.safeParse({ q: 'a'.repeat(81) }).success).toBe(false);
    expect(listQuerySchema.parse({}).q).toBeUndefined();
  });
});

describe('GET /api/travel/places?q=', () => {
  it('filters, keeps the response shape, and 422s an over-long q', async () => {
    await seed();
    const { GET } = await import('../src/app/api/travel/places/route');
    const ok = await GET(new Request('https://example.test/api/travel/places?q=da%20lat'));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(['count', 'places']);
    expect(body.count).toBe(2);
    const bad = await GET(new Request(`https://example.test/api/travel/places?q=${'a'.repeat(81)}`));
    expect(bad.status).toBe(422);
    const all = await GET(new Request('https://example.test/api/travel/places'));
    expect((await all.json()).count).toBe(3);
  });
  it('ignores q on another list endpoint', async () => {
    const { GET } = await import('../src/app/api/travel/stories/route');
    expect((await GET(new Request('https://example.test/api/travel/stories?q=zzz'))).status).toBe(200);
  });
});

describe('searchPublicPlaces', () => {
  it('pages after searching and clamps the page', async () => {
    await seed();
    const { searchPublicPlaces } = await import('../src/server/content/public-places');
    const r = await searchPublicPlaces({ q: 'Đà Lạt', page: 1 });
    expect(r.total).toBe(2);
    expect(r.pageCount).toBe(1);
    expect((await searchPublicPlaces({ page: 99 })).page).toBe(1);
    expect(Object.keys(r.places[0]!)).not.toContain('affiliateLinks');
    expect((await searchPublicPlaces({ q: 'zzz', page: 1 })).total).toBe(0);
  });
  it('rejects on a store failure', async () => {
    holder.repo = { listPlaces: () => Promise.reject(new Error('down')) };
    const { searchPublicPlaces } = await import('../src/server/content/public-places');
    await expect(searchPublicPlaces({ page: 1 })).rejects.toThrow();
  });
});
