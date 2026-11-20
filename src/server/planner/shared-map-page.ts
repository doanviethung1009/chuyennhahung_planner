import { getDestination } from '@/content/destinations';
import type { MapPin } from '@/components/map/vietnam-map';
import { checkMemberMapRead } from '@/server/rate-limit';
import { getPlannerRepository } from './instance';
import type { PublicMemberMap, PublicMemberMapPoint } from './member-map-share';

/**
 * Server half of the public shared-map page (ADR 0030 §5). The page has one
 * answer for every failure, so this returns `null` for all of them: a limiter
 * that fired, a malformed or unknown token, a revoked or unshared map, a banned,
 * soft-deleted or deleted owner, and a store that threw. The caller turns `null`
 * into the same 404 every time, so nothing tells a visitor which case it was.
 */
export async function loadSharedMemberMap(
  requestHeaders: Pick<Headers, 'get'>,
  token: string,
): Promise<PublicMemberMap | null> {
  try {
    if (!checkMemberMapRead(requestHeaders).ok) return null;
    return await (await getPlannerRepository()).getSharedMemberMap(token);
  } catch {
    return null;
  }
}

/** A bucket drawn with the map's existing three pin sizes (`pinRadius`): 1, 2 and 4 visits. */
const BUCKET_VISITS = { 1: 1, 2: 2, 3: 4 } as const;

/**
 * Turns the public points into what `VietnamMap` draws: catalog destinations
 * (coordinates, names, `featured`, `labelSide` — read only) with `visits` set from
 * the bucket. A slug the catalog does not know is dropped. Only visited points
 * exist in the projection, so every pin is solid.
 */
export function sharedMapDestinations(
  points: ReadonlyArray<PublicMemberMapPoint>,
): MapPin[] {
  const out: MapPin[] = [];
  for (const point of points) {
    const destination = getDestination(point.slug);
    if (!destination) continue;
    // Only the fields a pin needs: nothing else of the catalog entry travels.
    out.push({
      slug: destination.slug,
      name: destination.name,
      coords: destination.coords,
      featured: destination.featured,
      labelSide: destination.labelSide,
      visits: BUCKET_VISITS[point.visitsBucket],
    });
  }
  return out;
}
