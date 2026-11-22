import { describe, expect, it } from 'vitest';
import { destinations } from '../src/content/destinations';
import { parseDestinationProvince } from '../src/lib/destinations-filter';
import { provincesWithDestinations } from '../src/content/provinces';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

describe('/destinations province filter', () => {
  it('keeps a province that holds a destination, takes the first of repeated values', () => {
    expect(parseDestinationProvince('da-nang')).toBe('da-nang');
    expect(parseDestinationProvince(['lam-dong', 'x'])).toBe('lam-dong');
  });
  it('drops unknown, empty, missing and empty-province values', () => {
    for (const v of ['nowhere', '', undefined, 'cao-bang', [] as string[]]) {
      expect(parseDestinationProvince(v)).toBe('');
    }
  });
  it('every offered province yields at least one destination, and all destinations are covered', () => {
    for (const p of provincesWithDestinations) {
      expect(destinations.some((d) => d.provinceSlug === p.slug)).toBe(true);
    }
    const covered = new Set(provincesWithDestinations.map((p) => p.slug));
    expect(destinations.every((d) => covered.has(d.provinceSlug))).toBe(true);
  });
  it('has the new labels in both languages', () => {
    for (const m of [vi_, en_]) {
      expect(m.destinations.provinceFilterLabel.length).toBeGreaterThan(0);
      expect(m.destinations.allProvinces.length).toBeGreaterThan(0);
    }
  });
});
