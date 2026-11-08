import type messages from '../../../messages/vi.json';
import type { StaticPathname } from '@/i18n/routing';

/** A key that must exist under the `nav` namespace in both catalogues. */
export type NavKey = keyof (typeof messages)['nav'];

/** Message key under `nav` → canonical pathname. */
export interface NavItem {
  key: NavKey;
  href: StaticPathname;
}

/** The six primary navigation entries, in order. */
export const primaryNav: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'stories', href: '/stories' },
  { key: 'destinations', href: '/destinations' },
  { key: 'itineraries', href: '/itineraries' },
  { key: 'reviews', href: '/reviews' },
  { key: 'about', href: '/about' },
];

/** Secondary entries surfaced in the footer only. */
export const footerExtraNav: NavItem[] = [
  { key: 'map', href: '/map' },
  { key: 'planTrip', href: '/plan-your-trip' },
];
