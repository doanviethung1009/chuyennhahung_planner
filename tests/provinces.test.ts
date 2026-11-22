import { describe, expect, it } from 'vitest';
import { destinations } from '@/content/destinations';
import { destinationSlugsInProvince, getProvince, provinces, provincesWithDestinations } from '@/content/provinces';

describe('Vietnam provinces reference data', () => {
  it('has the 34 units (6 cities + 28 provinces) with unique slugs', () => {
    expect(provinces).toHaveLength(34);
    expect(provinces.filter((p) => p.kind === 'city')).toHaveLength(6);
    expect(new Set(provinces.map((p) => p.slug)).size).toBe(34);
  });

  it('accounts for exactly the 63 pre-2025 units, each once', () => {
    const former = provinces.flatMap((p) => p.formerNames);
    expect(former).toHaveLength(63);
    expect(new Set(former).size).toBe(63);
  });

  it('keeps every unit named in both locales with coordinates inside Vietnam', () => {
    for (const p of provinces) {
      expect(p.name.vi.length).toBeGreaterThan(0);
      expect(p.name.en.length).toBeGreaterThan(0);
      expect(p.coords.lat).toBeGreaterThan(8.5);
      expect(p.coords.lat).toBeLessThan(23.5);
      expect(p.coords.lng).toBeGreaterThan(102);
      expect(p.coords.lng).toBeLessThan(110);
    }
  });

  it('looks a unit up by slug', () => {
    expect(getProvince('da-nang')?.formerNames).toContain('Quảng Nam');
    expect(getProvince('nope')).toBeUndefined();
  });
});

describe('destinations are placed in a province', () => {
  it('every destination points at a real province', () => {
    for (const d of destinations) expect(getProvince(d.provinceSlug), d.slug).toBeDefined();
  });
  it('offers only provinces that hold a destination, and finds their destinations', () => {
    expect(provincesWithDestinations.every((p) => destinationSlugsInProvince(p.slug).length > 0)).toBe(true);
    expect(destinationSlugsInProvince('da-nang').sort()).toEqual(['da-nang', 'hoi-an']);
  });
});
