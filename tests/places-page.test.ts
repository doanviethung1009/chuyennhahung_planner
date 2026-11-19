import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelContentRepository } from '../src/server/content/repository';
import { bilingual, makeRepository, placeFixture } from './travel-content-helpers';
import { invalidateCatalogueCache } from '../src/server/public-catalogue-cache';
import { pathnames } from '../src/i18n/routing';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

const holder = vi.hoisted(() => ({ repo: null as unknown }));
vi.mock('../src/server/content/instance', () => ({
  getRepository: () => Promise.resolve(holder.repo),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  setRequestLocale: () => undefined,
}));
vi.mock('../src/i18n/navigation', () => ({
  Link: 'a',
  getPathname: ({ href }: { href: string | { pathname: string; params?: Record<string, string> } }) =>
    typeof href === 'string'
      ? href
      : href.pathname.replace(/\[(\w+)\]/g, (_m, k: string) => href.params?.[k] ?? ''),
}));

const src = resolve(import.meta.dirname, '../src');
let repo: TravelContentRepository;
beforeEach(() => {
  invalidateCatalogueCache();
  repo = makeRepository();
  holder.repo = repo;
});

describe('public places read', () => {
  it('lists every place, filters by destination and drops internal fields', async () => {
    await repo.createPlace(
      placeFixture({
        slug: 'a-place',
        affiliateLinks: [{ partner: 'Partner', label: bilingual('x', 'x'), url: 'https://example.com' }],
      }),
    );
    await repo.createPlace(placeFixture({ slug: 'b-place', destinationSlug: 'hoi-an' }));
    const { getPublicPlaces } = await import('../src/server/content/public-places');
    expect((await getPublicPlaces()).map((p) => p.slug)).toEqual(['a-place', 'b-place']);
    const dalat = await getPublicPlaces('da-lat');
    expect(dalat.map((p) => p.slug)).toEqual(['a-place']);
    expect(Object.keys(dalat[0]!)).not.toContain('affiliateLinks');
    expect(Object.keys(dalat[0]!)).not.toContain('createdAt');
  });

  it('returns null for an unknown slug and an empty list when the store fails', async () => {
    const { getPublicPlace, getPublicPlaces } = await import('../src/server/content/public-places');
    expect(await getPublicPlace('nope')).toBeNull();
    holder.repo = { listPlaces: () => Promise.reject(new Error('down')) };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await getPublicPlaces('x-fail')).toEqual([]);
  });
});

describe('sitemap on a store failure', () => {
  it('fails instead of silently dropping every place', async () => {
    holder.repo = { listPlaces: () => Promise.reject(new Error('down')), listStories: () => Promise.resolve([]) };
    const { default: sitemap } = await import('../src/app/sitemap');
    await expect(sitemap()).rejects.toThrow();
  });
});

describe('place card', () => {
  it('links to the place route and shows category, duration and cost', async () => {
    await repo.createPlace(placeFixture({ slug: 'card-place', images: ['/images/x.svg'] }));
    const { getPublicPlace } = await import('../src/server/content/public-places');
    const { PlaceCard } = await import('../src/components/cards/place-card');
    const place = (await getPublicPlace('card-place'))!;
    const html = renderToStaticMarkup(await PlaceCard({ place, locale: 'vi' }));
    expect(html).toContain('Địa điểm thử');
    expect(html).toContain('categories.cafe');
    expect(html).toContain('50.000 đ');
    expect(html).not.toContain('href="#"');
  });
});

describe('route, sitemap and messages', () => {
  it('registers /dia-diem/[slug] and /places/[slug]', () => {
    expect(pathnames['/places/[slug]']).toEqual({ vi: '/dia-diem/[slug]', en: '/places/[slug]' });
  });

  it('puts places in the sitemap', async () => {
    await repo.createPlace(placeFixture({ slug: 'map-place' }));
    const { default: sitemap } = await import('../src/app/sitemap');
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/places/map-place'))).toBe(true);
  });

  it('has the same places keys in vi and en', () => {
    expect(Object.keys(vi_.places).sort()).toEqual(Object.keys(en_.places).sort());
    expect(Object.keys(vi_.places.categories).sort()).toEqual(Object.keys(en_.places.categories).sort());
  });

  it('place page is force-dynamic and has one h1', () => {
    const page = readFileSync(join(src, 'app/[locale]/places/[slug]/page.tsx'), 'utf8');
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page).toContain('notFound()');
    expect(page).not.toContain('href="#"');
  });
});
