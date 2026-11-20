import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { destinations } from '../src/content/destinations';
import type { MemberMapState } from '../src/server/planner/member-map';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/i18n/navigation', () => ({
  getPathname: ({ href }: { href: string }) => href,
  Link: ({
    href,
    className,
    style,
    children,
  }: {
    href: string | { pathname: string; params: Record<string, string> };
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
  }) =>
    createElement(
      'a',
      {
        href:
          typeof href === 'string'
            ? href
            : href.pathname.replace(/\[(\w+)\]/g, (_m, key: string) => href.params[key] ?? ''),
        className,
        style,
      },
      children,
    ),
}));

const { MemberMapView } = await import('../src/components/map/member-map-view');
const { VietnamMap } = await import('../src/components/map/vietnam-map');

async function render(state: MemberMapState): Promise<string> {
  return renderToStaticMarkup(await MemberMapView({ state, locale: 'vi' }));
}
const pinHrefs = (html: string) => [...html.matchAll(/href="\/destinations\/([^"]+)"/g)].map((m) => m[1]);

describe('MemberMapView', () => {
  it('shows a guest an empty map, the invitation and a sign-in link, with no pin', async () => {
    const html = await render({ status: 'guest' });
    expect(pinHrefs(html)).toEqual([]);
    expect(html).toContain('memberMap.guestPrompt');
    expect(html).toContain('href="/sign-in?returnTo=%2Fmy-trips"');
    expect(html).not.toContain('memberMap.privateNote');
  });

  it('shows an empty member the invitation and a link to start a trip', async () => {
    const html = await render({ status: 'empty' });
    expect(pinHrefs(html)).toEqual([]);
    expect(html).toContain('href="/my-trips/new"');
  });

  it('draws solid and hollow pins, bigger for more visits, with text states beyond colour', async () => {
    const html = await render({
      status: 'ready',
      points: [{ slug: 'da-lat', visits: 3 }, { slug: 'moc-chau' }, { slug: 'khong-co' }],
    });
    // Map pin + list entry for each known point; the unknown slug is dropped.
    expect(pinHrefs(html).sort()).toEqual(['da-lat', 'da-lat', 'moc-chau', 'moc-chau']);
    expect(html).toContain('memberMap.visited');
    expect(html).toContain('memberMap.planned');
    expect(html).toContain('bg-primary');
    expect(html).toContain('bg-cream-50');
    expect(html.match(/width:44px;height:44px/g)?.length).toBe(2);
  });

  it('keeps permanent labels to featured destinations only', async () => {
    const featured = destinations.filter((d) => d.featured).map((d) => d.slug);
    expect(featured.length).toBeGreaterThan(0);
    const html = await render({
      status: 'ready',
      points: [{ slug: featured[0]!, visits: 1 }, { slug: 'da-lat', visits: 1 }],
    });
    expect(html.match(/rounded-pill bg-cream-50\/90/g)?.length).toBe(1);
  });
});

describe('VietnamMap with the narrowed pin type', () => {
  it('renders exactly the same for whole destinations and for their projection', () => {
    const full = renderToStaticMarkup(createElement(VietnamMap, { destinations, locale: 'vi', mapLabel: 'm' }));
    const projected = destinations.map(({ slug, name, coords, visits, featured, labelSide }) => ({
      slug,
      name,
      coords,
      visits,
      featured,
      labelSide,
    }));
    expect(renderToStaticMarkup(createElement(VietnamMap, { destinations: projected, locale: 'vi', mapLabel: 'm' }))).toBe(
      full,
    );
  });
});
