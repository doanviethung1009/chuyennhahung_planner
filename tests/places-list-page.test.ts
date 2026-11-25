import { describe, expect, it } from 'vitest';
import { pathnames } from '../src/i18n/routing';
import { isIndexableList, listQuery, parsePlacesParams } from '../src/components/places/places-list-params';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

describe('/places routing', () => {
  it('maps to /dia-diem (vi) and /places (en)', () => {
    expect(pathnames['/places']).toEqual({ vi: '/dia-diem', en: '/places' });
  });
});

describe('parsePlacesParams', () => {
  it('trims q, cuts it to 80 characters, drops unknown filters and bad pages', () => {
    const p = parsePlacesParams({ q: '  ' + 'a'.repeat(100), destination: 'nowhere', category: 'bogus', page: '-3' });
    expect(p.q).toBe('a'.repeat(80));
    expect(p).toMatchObject({ destination: '', province: '', category: '', page: 1 });
    expect(parsePlacesParams({ page: 'abc' }).page).toBe(1);
  });
  it('keeps known destination and category, takes the first of repeated values', () => {
    const p = parsePlacesParams({ q: ['da lat', 'x'], destination: 'da-lat', category: 'cafe', page: '2' });
    expect(p).toEqual({ q: 'da lat', destination: 'da-lat', province: '', category: 'cafe', page: 2 });
  });
});

describe('province filter params', () => {
  it('keeps a province that has destinations, drops an unknown one or one with none', () => {
    expect(parsePlacesParams({ province: 'lam-dong' }).province).toBe('lam-dong');
    expect(parsePlacesParams({ province: 'nowhere' }).province).toBe('');
    expect(parsePlacesParams({ province: 'cao-bang' }).province).toBe('');
  });
  it('is not indexable and is kept in paging links', () => {
    const p = parsePlacesParams({ province: 'lam-dong', page: '2' });
    expect(isIndexableList(p)).toBe(false);
    expect(listQuery(p, 3)).toEqual({ province: 'lam-dong', page: '3' });
  });
});

describe('noindex rule and link query', () => {
  it('only the bare first page is indexable', () => {
    expect(isIndexableList(parsePlacesParams({}))).toBe(true);
    expect(isIndexableList(parsePlacesParams({ q: 'x' }))).toBe(false);
    expect(isIndexableList(parsePlacesParams({ category: 'cafe' }))).toBe(false);
    expect(isIndexableList(parsePlacesParams({ destination: 'da-lat' }))).toBe(false);
    expect(isIndexableList(parsePlacesParams({ page: '2' }))).toBe(false);
  });
  it('paging links keep q and filters; page 1 omits page', () => {
    const p = parsePlacesParams({ q: 'đà lạt', category: 'cafe', page: '2' });
    expect(listQuery(p, 3)).toEqual({ q: 'đà lạt', category: 'cafe', page: '3' });
    expect(listQuery(p, 1)).toEqual({ q: 'đà lạt', category: 'cafe' });
  });
});

describe('sitemap', () => {
  it('lists /places', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/app/sitemap.ts', 'utf8')).toContain("entry('/places'");
  });
});

describe('placesList messages', () => {
  it('has the same keys in vi and en', () => {
    expect(Object.keys(vi_.placesList).sort()).toEqual(Object.keys(en_.placesList).sort());
    expect(vi_.nav.places).toBeTruthy();
    expect(en_.nav.places).toBeTruthy();
  });
});

describe('province and destination consistency', () => {
  it('drops a destination that is outside the chosen province', () => {
    const lamDong = parsePlacesParams({ province: 'lam-dong', destination: 'da-lat' });
    expect(lamDong.destination).toBe('da-lat');
    const other = parsePlacesParams({ province: 'ha-noi', destination: 'da-lat' });
    expect(other.destination).toBe('');
  });
});
