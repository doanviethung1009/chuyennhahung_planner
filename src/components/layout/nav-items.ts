import type messages from '../../../messages/vi.json';
import type { StaticPathname } from '@/i18n/routing';

/** A key that must exist under the `nav` namespace in both catalogues. */
export type NavKey = keyof (typeof messages)['nav'];

/** Message key under `nav` → canonical pathname. */
export interface NavItem {
  key: NavKey;
  href: StaticPathname;
}

/** A labelled group of links: one trigger in the header, a list in the drawer. */
export interface NavGroup {
  key: 'groupExplore' | 'groupPlan';
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

/**
 * The primary navigation, in order. Five links would not fit the header row at
 * 1280px (VI leaves 17px spare), so the two content areas are groups: one
 * trigger each on desktop, so everything stays one click (or tap) away.
 */
export const primaryNav: NavEntry[] = [
  { key: 'home', href: '/' },
  { key: 'stories', href: '/stories' },
  {
    key: 'groupExplore',
    items: [
      { key: 'destinations', href: '/destinations' },
      { key: 'places', href: '/places' },
      { key: 'map', href: '/map' },
    ],
  },
  {
    key: 'groupPlan',
    items: [
      { key: 'itineraries', href: '/itineraries' },
      { key: 'tripTemplates', href: '/trip-templates' },
    ],
  },
  { key: 'communityTrips', href: '/community-trips' },
  { key: 'reviews', href: '/reviews' },
  { key: 'about', href: '/about' },
];

/** Every link of the primary navigation, groups expanded. */
export const primaryLinks: NavItem[] = primaryNav.flatMap((entry) =>
  isGroup(entry) ? entry.items : [entry],
);

/** Secondary entries surfaced in the footer only. */
export const footerExtraNav: NavItem[] = [{ key: 'planTrip', href: '/plan-your-trip' }];
