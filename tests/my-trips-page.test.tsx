import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

/**
 * ADR 0032 behaviour of the member home page: which sections render for a guest
 * and for a member, per `?tab=`. The page is called as a function and its element
 * tree is read; the heavy children are replaced by named markers.
 */

const state = vi.hoisted(() => ({
  map: { status: 'ready', points: [{ slug: 'da-lat', visits: 1 }] } as { status: string; points?: unknown[] },
  session: true,
  overview: { points: [], unfinishedTrips: 2 } as { points: unknown[]; unfinishedTrips: number } | null,
  calls: [] as string[],
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}));
vi.mock('@/lib/metadata', () => ({ buildPageMetadata: () => ({}) }));
vi.mock('@/server/planner/member-map', () => ({
  getMemberMap: async () => {
    state.calls.push('getMemberMap');
    return state.map;
  },
  getMemberSession: async () => {
    state.calls.push('getMemberSession');
    return state.session;
  },
}));
vi.mock('@/server/planner/member-map-share-preview', () => ({
  getMemberMapShareOverview: async () => {
    state.calls.push('getMemberMapShareOverview');
    return state.overview;
  },
}));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: function PageHeader() { return null; } }));
vi.mock('@/components/ui/container', () => ({ Container: function Container({ children }: { children?: ReactNode }) { return children; } }));
vi.mock('@/components/map/member-map-view', () => ({ MemberMapView: function MemberMapView() { return null; } }));
vi.mock('@/components/map/member-map-share-panel', () => ({ MemberMapSharePanel: function MemberMapSharePanel() { return null; } }));
vi.mock('@/components/map/member-map-share-preview', () => ({ MemberMapSharePreview: function MemberMapSharePreview() { return null; } }));
vi.mock('@/components/planner/my-trips', () => ({ MyTrips: function MyTrips() { return null; } }));
vi.mock('@/components/planner/member-home-tabs', () => ({ MemberHomeTabs: function MemberHomeTabs() { return null; } }));

import MyTripsPage from '../src/app/[locale]/my-trips/page';

type Node = { type?: unknown; props?: { children?: unknown; preview?: unknown; active?: string } } | null | undefined;

/** Names (and the tab bar's `active`) of every component in the returned tree. */
function render(tree: unknown): { names: string[]; active: string | null } {
  const names: string[] = [];
  let active: string | null = null;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    const el = node as Node;
    if (!el || typeof el !== 'object') return;
    if (typeof el.type === 'function') names.push(el.type.name);
    if (typeof el.type === 'function' && el.type.name === 'MemberHomeTabs') active = el.props?.active ?? null;
    walk(el.props?.children);
    walk(el.props?.preview);
  };
  walk(tree);
  return { names, active };
}

async function page(tab?: string | string[]) {
  const tree = await MyTripsPage({
    params: Promise.resolve({ locale: 'vi' as const }),
    searchParams: Promise.resolve(tab === undefined ? {} : { tab }),
  });
  return render(tree);
}

describe('/my-trips page (ADR 0032)', () => {
  beforeEach(() => {
    state.map = { status: 'ready', points: [{ slug: 'da-lat', visits: 1 }] };
    state.session = true;
    state.overview = { points: [], unfinishedTrips: 2 };
    state.calls = [];
  });

  it('shows the map on ?tab=map, reading only the map', async () => {
    const { names, active } = await page('map');
    expect(names).toContain('MemberMapView');
    expect(names).not.toContain('MyTrips');
    expect(names).not.toContain('MemberMapSharePanel');
    expect(active).toBe('map');
    expect(state.calls).toEqual(['getMemberMap']);
  });

  it('shows only the trip list by default, on ?tab=trips and for an unknown tab, reading the session but not the map or the overview', async () => {
    for (const tab of [undefined, 'trips', 'nope', ['nope', 'share']]) {
      state.calls = [];
      const { names, active } = await page(tab);
      expect(names).toContain('MyTrips');
      expect(names).not.toContain('MemberMapView');
      expect(names).not.toContain('MemberMapSharePanel');
      expect(active).toBe('trips');
      expect(state.calls).toEqual(['getMemberSession']);
    }
  });

  it('shows the sharing panel with its preview on ?tab=share', async () => {
    const { names, active } = await page('share');
    expect(names).toEqual(expect.arrayContaining(['MemberMapSharePanel', 'MemberMapSharePreview']));
    expect(names).not.toContain('MyTrips');
    expect(active).toBe('share');
  });

  it('gives a guest the empty map and no tab bar, never the list or the panel, on every tab', async () => {
    state.session = false;
    state.map = { status: 'guest' };
    state.overview = null;
    for (const tab of [undefined, 'map', 'trips', 'share']) {
      const { names, active } = await page(tab);
      expect(names).toContain('MemberMapView');
      expect(names).not.toContain('MemberHomeTabs');
      expect(names).not.toContain('MyTrips');
      expect(names).not.toContain('MemberMapSharePanel');
      expect(active).toBeNull();
    }
  });

  it('does not read the sharing overview for a guest on ?tab=share', async () => {
    state.session = false;
    state.map = { status: 'guest' };
    await page('share');
    expect(state.calls).not.toContain('getMemberMapShareOverview');
  });

  it('falls back to the map when a member\'s sharing overview cannot be read', async () => {
    state.overview = null;
    const { names, active } = await page('share');
    expect(names).toContain('MemberMapView');
    expect(names).not.toContain('MemberMapSharePanel');
    expect(active).toBe('map');
  });
});
