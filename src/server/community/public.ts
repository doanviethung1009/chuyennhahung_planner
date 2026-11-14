import { cache } from 'react';
import { getPlannerRepository } from '@/server/planner/instance';
import type { CommunityTripCard } from '@/server/planner/schemas';

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
