import { parseJsonBody } from '@/server/content/http';
import {
  ifMatchVersion,
  plannerNoContent,
  plannerRoute,
  tripResponse,
} from '@/server/planner/http';
import { tripUpdateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** The whole trip: days with their activities, expenses, and the budget. */
export function GET(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    return tripResponse(await repository.getTrip(userId, id));
  });
}

/** Updates the trip header. Requires `If-Match` with the version last read. */
export function PATCH(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    const patch = await parseJsonBody(request, tripUpdateSchema);
    return tripResponse(await repository.updateTrip(userId, id, patch, expected));
  });
}

/**
 * Archives the trip — nothing is destroyed, and `POST /restore` brings it back.
 *
 * `?purge=true` deletes it permanently, with every day, activity and expense,
 * and only works on a trip that is already archived. Destroying a plan takes
 * two deliberate requests, never one.
 */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    const purge = new URL(request.url).searchParams.get('purge') === 'true';

    if (purge) {
      await repository.purgeTrip(userId, id, expected);
      return plannerNoContent();
    }
    const trip = await repository.archiveTrip(userId, id, expected);
    return tripResponse(await repository.getTrip(trip.ownerId, trip.id));
  });
}
