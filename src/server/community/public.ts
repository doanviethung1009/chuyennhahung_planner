import { cache } from 'react';
import { getRepository } from '@/server/content/instance';
import { getPlannerRepository } from '@/server/planner/instance';
import type {
  CommunityTripCard,
  PlaceReviewSummary,
  PublicCommunityReview,
} from '@/server/planner/schemas';

/**
 * The only way public pages read community trips (ADR 0014): approved, public,
 * still-shared listings, already projected to the allow-listed card.
 *
 * A store failure yields an empty list rather than an error: the home page must
 * keep working when the Planner store is unavailable, and an empty gallery
 * simply hides its section.
 */
export const getCommunityTrips = cache(async (limit = 24): Promise<CommunityTripCard[]> => {
  try {
    return await (await getPlannerRepository()).listCommunityTrips(limit);
  } catch (error) {
    console.error('[community] could not read the gallery', error instanceof Error ? error.name : 'error');
    return [];
  }
});

export interface ReviewPlace {
  slug: string;
  name: { vi: string; en: string };
  destinationSlug: string;
}

/** Catalogue places a visitor may review (the form's picker). Empty on a store failure. */
export const getReviewPlaces = cache(async (): Promise<ReviewPlace[]> => {
  try {
    const places = await (await getRepository()).listPlaces();
    return places.map((place) => ({
      slug: place.slug,
      name: place.name,
      destinationSlug: place.destinationSlug,
    }));
  } catch (error) {
    console.error('[community] could not read places', error instanceof Error ? error.name : 'error');
    return [];
  }
});

export interface ApprovedReviews {
  items: PublicCommunityReview[];
  summary: PlaceReviewSummary;
}

/**
 * Approved reviews, optionally for a set of places (ADR 0014). A failure gives
 * an empty result, so a page never breaks because reviews could not load.
 */
export async function getApprovedReviews(
  placeSlugs?: readonly string[],
  limit = 12,
): Promise<ApprovedReviews> {
  try {
    return await (await getPlannerRepository()).listApprovedReviews(placeSlugs, limit);
  } catch (error) {
    console.error('[community] could not read reviews', error instanceof Error ? error.name : 'error');
    return { items: [], summary: { count: 0, average: null } };
  }
}
