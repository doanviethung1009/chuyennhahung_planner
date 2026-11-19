import { cache } from 'react';
import { getRepository } from './instance';
import { foldText, foldedIncludes } from '@/lib/fold';
import { readCatalogueCache } from '@/server/public-catalogue-cache';
import { isContentError } from './repository';
import type { LocalizedText, Place } from './schemas';

/**
 * Public read of the place catalogue (ADR 0026). A place has no publish state,
 * so every place in the catalogue is public; the projection below is the
 * allow-list of fields a page may show — affiliate links and timestamps stay out.
 */
export interface PublicPlace {
  slug: string;
  name: LocalizedText;
  destinationSlug: string;
  location: LocalizedText;
  category: Place['category'];
  images: string[];
  description: Place['description'];
  suggestedMinutes: number;
  estimatedCostVnd: number;
  rating: number | null;
  personalNote: LocalizedText | null;
}

function toPublicPlace(place: Place): PublicPlace {
  return {
    slug: place.slug,
    name: place.name,
    destinationSlug: place.destinationSlug,
    location: place.location,
    category: place.category,
    images: place.images,
    description: place.description,
    suggestedMinutes: place.suggestedMinutes,
    estimatedCostVnd: place.estimatedCostVnd,
    rating: place.rating,
    personalNote: place.personalNote,
  };
}

/**
 * The whole catalogue, projected, read once per cache window (places-list-load).
 * One store read serves every search, filter and page until the entry is 10 s
 * old or a write drops it (`invalidateCatalogueCache`). Ordered by slug, as
 * `listPlaces` returns it.
 */
function loadCatalogue(): Promise<PublicPlace[]> {
  return readCatalogueCache(async () => {
    const repository = await getRepository();
    // `limit` is only validated at the HTTP edge; this is one read, not a 100-item loop.
    const all = await repository.listPlaces({ limit: Number.MAX_SAFE_INTEGER, offset: 0 });
    return all.map(toPublicPlace);
  });
}

/** Same rule as `listPlaces`: folded substring over name and location, vi and en. */
function matches(place: PublicPlace, filter: Pick<PlaceSearch, 'q' | 'destinationSlug' | 'category'>, needle: string): boolean {
  if (filter.destinationSlug && place.destinationSlug !== filter.destinationSlug) return false;
  if (filter.category && place.category !== filter.category) return false;
  if (!needle) return true;
  return foldedIncludes([place.name.vi, place.name.en, place.location.vi, place.location.en], needle);
}

async function readAll(filter: Pick<PlaceSearch, 'q' | 'destinationSlug' | 'category'>): Promise<PublicPlace[]> {
  const needle = filter.q ? foldText(filter.q.trim()) : '';
  const catalogue = await loadCatalogue();
  return catalogue.filter((place) => matches(place, filter, needle));
}

/** Strict read: a store failure rejects. The sitemap uses it so an outage is not read by crawlers as "all places removed". */
export const loadPublicPlaces = cache(async (destinationSlug?: string): Promise<PublicPlace[]> => {
  return readAll({ ...(destinationSlug ? { destinationSlug } : {}) });
});

export const PLACES_PAGE_SIZE = 24;

export interface PlaceSearch {
  /** Free text, 1–80 characters after trimming; anything else is ignored by the caller's validation. */
  q?: string;
  destinationSlug?: string;
  category?: Place['category'];
  /** 1-based. */
  page: number;
}

export interface PlaceSearchResult {
  places: PublicPlace[];
  /** Matches before paging. */
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Search and filter, then page (ADR 0026, PLACES-UI-S6). The search runs over the
 * whole catalogue before paging, so `total` and the page window are exact. The
 * match is an in-memory substring scan; a store failure rejects so the page errors
 * instead of showing an empty list as if nothing matched.
 */
export async function searchPublicPlaces(search: PlaceSearch): Promise<PlaceSearchResult> {
  const matches = await readAll({
    ...(search.q ? { q: search.q } : {}),
    ...(search.destinationSlug ? { destinationSlug: search.destinationSlug } : {}),
    ...(search.category ? { category: search.category } : {}),
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / PLACES_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(search.page) || 1), pageCount);
  const start = (page - 1) * PLACES_PAGE_SIZE;
  return { places: matches.slice(start, start + PLACES_PAGE_SIZE), total: matches.length, page, pageCount };
}

/**
 * Places of one destination (or all). A store failure yields an empty list so
 * the destination page keeps working and simply hides its section.
 */
export async function getPublicPlaces(destinationSlug?: string): Promise<PublicPlace[]> {
  try {
    return await loadPublicPlaces(destinationSlug);
  } catch (error) {
    console.error('[places] could not read the catalogue', error instanceof Error ? error.name : 'error');
    return [];
  }
}

/** Null for an unknown slug. A store failure rejects, so the page errors instead of lying with a 404. */
export const getPublicPlace = cache(async (slug: string): Promise<PublicPlace | null> => {
  try {
    return toPublicPlace(await (await getRepository()).getPlace(slug));
  } catch (error) {
    if (isContentError(error) && error.code === 'not_found') return null;
    throw error;
  }
});
