import type { Locale } from '@/i18n/routing';

/** A value that must exist in every supported locale. */
export type Localized<T> = Record<Locale, T>;

export type Terrain =
  | 'mountain'
  | 'coast'
  | 'island'
  | 'city'
  | 'countryside'
  | 'highland';

export interface Destination {
  slug: string;
  name: Localized<string>;
  /**
   * Geographic area label shown as the card kicker (e.g. "Đông Bắc",
   * "Cao nguyên đá Đồng Văn"). Deliberately geographic rather than
   * administrative, so it survives province reorganisations.
   */
  area: Localized<string>;
  region: 'north' | 'central' | 'south';
  terrain: Terrain;
  /** WGS84 coordinates, used by the travel map projection. */
  coords: { lat: number; lng: number };
  summary: Localized<string>;
  body: Localized<string[]>;
  bestSeason: Localized<string>;
  /** Our own visit, for the "Destinations we've explored" framing. */
  firstVisited: string;
  visits: number;
  tags: Localized<string[]>;
  cover: string;
}

export interface Story {
  slug: string;
  title: Localized<string>;
  excerpt: Localized<string>;
  body: Localized<string[]>;
  /** ISO date, used for `datePublished` and sorting. */
  publishedAt: string;
  readingMinutes: number;
  destinationSlugs: string[];
  cover: string;
  featured: boolean;
}

export interface ItineraryDay {
  day: number;
  title: Localized<string>;
  detail: Localized<string>;
}

/**
 * An itinerary IS the tour entity for this site — see CLAUDE.md "Tour routes".
 * Legacy `/tour/:slug` URLs redirect here.
 */
export interface Itinerary {
  slug: string;
  title: Localized<string>;
  summary: Localized<string>;
  days: number;
  nights: number;
  /** Indicative price per person in VND. */
  priceFromVnd: number;
  groupSize: Localized<string>;
  pace: 'relaxed' | 'balanced' | 'active';
  bestFor: Localized<string>;
  destinationSlugs: string[];
  highlights: Localized<string[]>;
  dayByDay: ItineraryDay[];
  cover: string;
  featured: boolean;
}

export type VideoPlatform = 'tiktok' | 'facebook' | 'youtube';

export interface VideoReview {
  id: string;
  title: Localized<string>;
  platform: VideoPlatform;
  durationSeconds: number;
  destinationSlug: string;
  cover: string;
  publishedAt: string;
}

export interface SocialLink {
  platform: VideoPlatform | 'instagram' | 'email' | 'zalo';
  label: string;
  url: string;
}
