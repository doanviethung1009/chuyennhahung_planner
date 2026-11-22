import { describe, expect, it } from 'vitest';
import { itineraries } from '../src/content/itineraries';
import {
  itinerariesInProvince,
  itineraryProvinceSlugs,
  parseItineraryProvince,
  provincesWithItineraries,
} from '../src/lib/itineraries-filter';
import vi_ from '../messages/vi.json';
import en_ from '../messages/en.json';

describe('/itineraries province filter', () => {
  it('keeps an offered province, takes the first of repeated values', () => {
    const slug = provincesWithItineraries[0]!.slug;
    expect(parseItineraryProvince(slug)).toBe(slug);
    expect(parseItineraryProvince([slug, 'x'])).toBe(slug);
  });
  it('drops unknown, empty, missing and no-itinerary values', () => {
    for (const v of ['nowhere', '', undefined, 'cao-bang', [] as string[]]) {
      expect(parseItineraryProvince(v)).toBe('');
    }
  });
  it('every offered province yields at least one itinerary, and all itineraries are reachable', () => {
    for (const p of provincesWithItineraries) {
      expect(itinerariesInProvince(p.slug).length).toBeGreaterThan(0);
    }
    for (const i of itineraries) {
      const slugs = itineraryProvinceSlugs(i);
      expect(slugs.length).toBeGreaterThan(0);
      expect(slugs.some((s) => itinerariesInProvince(s).includes(i))).toBe(true);
    }
  });
  it('an empty province means all itineraries', () => {
    expect(itinerariesInProvince('')).toEqual(itineraries);
  });
  it('reuses labels that exist in both languages', () => {
    for (const m of [vi_, en_]) {
      expect(m.destinations.provinceFilterLabel.length).toBeGreaterThan(0);
      expect(m.destinations.allProvinces.length).toBeGreaterThan(0);
    }
  });
});
