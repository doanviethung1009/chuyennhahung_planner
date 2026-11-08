import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripActivityUpdateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; activityId: string }> };

/** Edits an activity in place. Moving it between days is `PATCH /reorder`. */
export function PATCH(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id, activityId } = await context.params;
    const expected = ifMatchVersion(request);
    const patch = await parseJsonBody(request, tripActivityUpdateSchema);
    return tripResponse(
      await repository.updateActivity(userId, id, activityId, patch, expected),
    );
  });
}

/**
 * Removes an activity. An expense that pointed at it keeps its amount and its
 * day and simply loses the link — a payment is not undone by deleting a plan.
 */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id, activityId } = await context.params;
    const expected = ifMatchVersion(request);
    return tripResponse(await repository.deleteActivity(userId, id, activityId, expected));
  });
}
