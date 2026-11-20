import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import { makeRepository, placeFixture } from './travel-content-helpers';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));

const PUBLIC_KEYS = [
  'category', 'description', 'destinationSlug', 'estimatedCostVnd', 'images', 'location',
  'name', 'personalNote', 'rating', 'slug', 'suggestedMinutes',
];

let repo: TravelContentRepository;

beforeEach(async () => {
  repo = makeRepository();
  holder.repo = repo;
  await repo.createPlace(
    placeFixture({
      slug: 'with-links',
      affiliateLinks: [{ partner: 'Acme', label: { vi: 'Đặt', en: 'Book' }, url: 'https://example.com/x' }],
    }),
  );
  await repo.createPlace(placeFixture({ slug: 'other', destinationSlug: 'hoi-an', category: 'restaurant' }));
});

describe('public places API projection', () => {
  it('list: only allow-listed fields, values intact, filters and paging unchanged', async () => {
    const { GET } = await import('../src/app/api/travel/places/route');
    const res = await GET(new Request('https://example.test/api/travel/places'));
    const body = await res.json();
    expect(body.count).toBe(2);
    for (const p of body.places) expect(Object.keys(p).sort()).toEqual(PUBLIC_KEYS);
    const stored = await repo.getPlace('with-links');
    const got = body.places.find((p: { slug: string }) => p.slug === 'with-links');
    expect(got.name).toEqual(stored.name);
    expect(got.estimatedCostVnd).toBe(stored.estimatedCostVnd);
    expect(JSON.stringify(body)).not.toMatch(/affiliate|createdAt|updatedAt|coords|example\.com\/x/);

    const byDest = await (await GET(new Request('https://example.test/api/travel/places?destinationSlug=hoi-an'))).json();
    expect(byDest.places.map((p: { slug: string }) => p.slug)).toEqual(['other']);
    const byCat = await (await GET(new Request('https://example.test/api/travel/places?category=restaurant'))).json();
    expect(byCat.count).toBe(1);
    const paged = await (await GET(new Request('https://example.test/api/travel/places?limit=1&offset=1'))).json();
    expect(paged.places.map((p: { slug: string }) => p.slug)).toEqual(['with-links']);
    const q = await (await GET(new Request('https://example.test/api/travel/places?q=zzzz'))).json();
    expect(q).toEqual({ places: [], count: 0 });
  });

  it('detail: only allow-listed fields; unknown slug is still 404', async () => {
    const { GET } = await import('../src/app/api/travel/places/[slug]/route');
    const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
    const res = await GET(new Request('https://example.test/api/travel/places/with-links'), ctx('with-links'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
    expect(JSON.stringify(body)).not.toMatch(/affiliate|createdAt|updatedAt|coords/);
    expect((await GET(new Request('https://example.test/x'), ctx('nope'))).status).toBe(404);
  });

  it('admin routes still return the full record', async () => {
    const stored = await repo.getPlace('with-links');
    expect(stored.affiliateLinks).toHaveLength(1);
    expect(stored.createdAt).toBeTruthy();
    expect(stored.coords).toBeTruthy();
  });
});
