import { parseJsonBody } from '@/server/content/http';
import { parseTripListQuery, plannerJson, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripCreateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * The caller's own trips. Active only unless `?status=archived` asks otherwise.
 * The owner comes from the bearer token, never from the query — there is no way
 * to ask for somebody else's list.
 */
export function GET(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const trips = await repository.listTrips(userId, parseTripListQuery(request));
    return plannerJson({ trips, count: trips.length });
  });
}

/**
 * Creates a trip, with its days, in one transaction.
 *
 * `source: "blank"` plans from scratch — days are generated from
 * `durationDays`. `source: "template"` clones an approved (public) template
 * into independent rows; the template is never modified.
 */
export function POST(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const input = await parseJsonBody(request, tripCreateSchema);
    return tripResponse(await repository.createTrip(userId, input), 201);
  });
}
