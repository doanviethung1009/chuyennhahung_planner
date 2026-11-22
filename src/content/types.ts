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
  /**
   * Our own visit, for the "Destinations we've explored" framing. Both are
   * omitted for a destination we have NOT been to yet: such an entry carries only
   * an objective description (no first-person account, date or visit count) —
   * CLAUDE.md rule 8. Use `isVisited()` rather than testing the fields.
   */
  firstVisited?: string;
  visits?: number;
  tags: Localized<string[]>;
  cover: string;
  /**
   * Big or popular destinations keep a permanent name label on the full travel
   * map; every other pin shows its name as a tooltip on hover/focus. Independent
   * of `visits` — an unvisited city can be featured. Owner-curated.
   */
  featured?: boolean;
  /**
   * Optional override of the side (left, right or above the dot) a featured pin's permanent label sits on, for
   * the rare pin whose default side (`labelSide(x)`) collides with a neighbour's
   * label at 375px. Leave unset otherwise.
   */
  labelSide?: 'left' | 'right' | 'top';
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
  /**
   * Slug of a public Planner template (Travel Content System) that is this
   * story's real itinerary. When set and the template is still public, the story
   * page renders the itinerary and a "plan a trip like ours" call to action; when
   * the template is missing or withdrawn both silently disappear. See ADR 0005.
   */
  plannerTemplateSlug?: string;
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

/** True when we have actually been to the destination (it has a visit count). */
export function isVisited(
  destination: Pick<Destination, 'visits'>,
): destination is Pick<Destination, 'visits'> & { visits: number } {
  return typeof destination.visits === 'number' && destination.visits > 0;
}

/**
 * One of Vietnam's first-level administrative units. This is a reference list,
 * not a destination: it carries no story, visit or cover. `coords` is a
 * representative point (a well-known city inside the unit), NOT a boundary or a
 * geometric centre. `formerNames` lists the units merged in on 1 July 2025
 * (Nghị quyết 202/2025/QH15) so old addresses and trips can still be matched.
 */
export interface Province {
  slug: string;
  name: Localized<string>;
  kind: 'province' | 'city';
  region: 'north' | 'central' | 'south';
  coords: { lat: number; lng: number };
  /** Vietnamese names of every pre-2025 unit now inside this one, itself included. */
  formerNames: string[];
}
