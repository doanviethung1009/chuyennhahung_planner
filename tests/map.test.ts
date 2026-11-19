import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The localized Link needs a Next request; a plain anchor stand-in keeps the markup.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, className, style, children }: { href: { params: { slug: string } }; className?: string; style?: React.CSSProperties; children: React.ReactNode }) =>
    createElement('a', { href: `/destinations/${href.params.slug}`, className, style }, children),
}));

const { VietnamMap } = await import('../src/components/map/vietnam-map');
import {
  MAP_HEIGHT,
  MAP_TARGET_PX,
  labelSide,
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

  it('flips the label left only for pins in the right half', () => {
    expect(labelSide(MAP_WIDTH / 2)).toBe('right');
    expect(labelSide(MAP_WIDTH / 2 + 0.1)).toBe('left');
    expect(labelSide(0)).toBe('right');
  });

  for (const variant of ['full', 'preview'] as const) {
    it(`renders every ${variant} pin as a real anchor sized to the target`, () => {
      const html = renderToStaticMarkup(
        createElement(VietnamMap, { destinations, locale: 'vi', mapLabel: 'Bản đồ', variant }),
      );
      const anchors = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);

      expect(anchors).toHaveLength(destinations.length);
      for (const a of anchors) {
        expect(a).toContain(`width:${MAP_TARGET_PX}px`);
        expect(a).toContain(`height:${MAP_TARGET_PX}px`);
        expect(a).not.toContain('href="#"');
      }
      expect(html).not.toContain('href="#"');
    });
  }

  it('puts each label beside the 44px box and on the side labelSide picks', () => {
    const html = renderToStaticMarkup(
      createElement(VietnamMap, { destinations, locale: 'vi', mapLabel: 'Bản đồ', variant: 'full' }),
    );
    for (const d of destinations) {
      const { x } = project(d.coords.lat, d.coords.lng);
      const label = html.match(new RegExp(`<span class="([^"]*)">${d.name.vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`));
      expect(label, d.slug).not.toBeNull();
      const cls = label![1]!;
      expect(cls, d.slug).toContain(labelSide(x) === 'left' ? 'right-full' : 'left-full');
      expect(cls, d.slug).toContain('absolute');
    }
  });
});
