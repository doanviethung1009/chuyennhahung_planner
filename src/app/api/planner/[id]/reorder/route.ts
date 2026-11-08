import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { plannerReorderSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Two operations, one endpoint, discriminated by `op`:
 *
 * - `{ "op": "reorder-day", "dayNumber": 2, "activityIds": [...] }` — the ids
 *   must be a permutation of that day's activities: no additions, no removals.
 * - `{ "op": "move-activity", "activityId": "...", "toDayNumber": 3, "toIndex": 0 }`
 *   — moves one activity to another day, or to a new index within its own.
 *
 * Both rewrite existing rows, so both require `If-Match`.
 */
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    const input = await parseJsonBody(request, plannerReorderSchema);
    return tripResponse(await repository.reorder(userId, id, input, expected));
  });
}
