import { destinationBySlug } from '@/content/destinations';
import { provincesWithDestinations } from '@/content/provinces';
import { placeCategorySchema } from '@/server/content/schemas';

export const Q_MAX = 80;
export const placeCategories = placeCategorySchema.options;
export type PlaceCategory = (typeof placeCategories)[number];

type Raw = string | string[] | undefined;

export interface PlacesListParams {
  q: string;
  destination: string;
  province: string;
  category: PlaceCategory | '';
  page: number;
}

const first = (value: Raw): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

/**
 * Reads the visible query string defensively. The page never 422s: an unknown
 * destination or category is dropped, `q` is trimmed and cut to 80 characters,
 * a bad `page` falls back to 1. The values are data — they are only ever compared
 * and rendered through React, never built into a pattern.
 */
export function parsePlacesParams(raw: { q?: Raw; destination?: Raw; province?: Raw; category?: Raw; page?: Raw }): PlacesListParams {
  const destination = first(raw.destination);
  const province = first(raw.province);
  const category = first(raw.category);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: first(raw.q).trim().slice(0, Q_MAX).trim(),
    destination: destinationBySlug.has(destination) ? destination : '',
    province: provincesWithDestinations.some((p) => p.slug === province) ? province : '',
    category: (placeCategories as readonly string[]).includes(category) ? (category as PlaceCategory) : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Noindex rule: only the unfiltered first page is indexable. */
export function isIndexableList(params: PlacesListParams): boolean {
  return !params.q && !params.destination && !params.province && !params.category && params.page === 1;
}

/** Query object for a link; empty values are left out so URLs stay clean. */
export function listQuery(params: PlacesListParams, page = params.page): Record<string, string> {
  return {
    ...(params.q ? { q: params.q } : {}),
    ...(params.destination ? { destination: params.destination } : {}),
    ...(params.province ? { province: params.province } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  };
}
