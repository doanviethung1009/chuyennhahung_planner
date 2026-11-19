import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAP_HEIGHT,
  MAP_TARGET_PX,
  MAP_WIDTH,
  VIETNAM_OUTLINE_PATH,
  pinRadius,
  project,
} from '../src/lib/map';
import { destinations } from '../src/content/destinations';

describe('travel map', () => {
  it('projects every destination inside the visible frame', () => {
    for (const destination of destinations) {
      const { x, y } = project(destination.coords.lat, destination.coords.lng);
      const r = pinRadius(destination.visits);

      expect(x - r, `${destination.slug} overflows left`).toBeGreaterThanOrEqual(0);
      expect(x + r, `${destination.slug} overflows right`).toBeLessThanOrEqual(MAP_WIDTH);
      expect(y - r, `${destination.slug} overflows top`).toBeGreaterThanOrEqual(0);
      expect(y + r, `${destination.slug} overflows bottom`).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });

  it('keeps north above south and east right of west', () => {
    const haGiang = destinations.find((d) => d.slug === 'ha-giang')!;
    const phuQuoc = destinations.find((d) => d.slug === 'phu-quoc')!;
    const hoiAn = destinations.find((d) => d.slug === 'hoi-an')!;

    const north = project(haGiang.coords.lat, haGiang.coords.lng);
    const south = project(phuQuoc.coords.lat, phuQuoc.coords.lng);
    const east = project(hoiAn.coords.lat, hoiAn.coords.lng);

    expect(north.y).toBeLessThan(south.y);
    expect(east.x).toBeGreaterThan(south.x);
  });

  it('gives every destination real coordinates within Vietnam', () => {
    for (const d of destinations) {
      expect(d.coords.lat, d.slug).toBeGreaterThan(8);
      expect(d.coords.lat, d.slug).toBeLessThan(24);
      expect(d.coords.lng, d.slug).toBeGreaterThan(102);
      expect(d.coords.lng, d.slug).toBeLessThan(110);
    }
  });

  it('builds a closed outline path', () => {
    expect(VIETNAM_OUTLINE_PATH.startsWith('M ')).toBe(true);
    expect(VIETNAM_OUTLINE_PATH.endsWith(' Z')).toBe(true);
    expect(VIETNAM_OUTLINE_PATH).not.toContain('NaN');
  });

  it('caps pin growth so a frequent destination cannot dominate', () => {
    expect(pinRadius(1)).toBeLessThan(pinRadius(4));
    expect(pinRadius(100)).toBeLessThanOrEqual(11);
  });
});

describe('map pin touch targets', () => {
  it('declares a 44px minimum target', () => {
    expect(MAP_TARGET_PX).toBeGreaterThanOrEqual(44);
  });

  it('sizes the pin anchor itself to the target, not a child span', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/components/map/vietnam-map.tsx'),
      'utf8',
    );
    expect(src).toMatch(/className="group absolute flex size-11 /);
    expect(src).not.toContain('href="#"');
  });
});
