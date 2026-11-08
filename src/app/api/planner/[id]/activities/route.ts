import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripActivityCreateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Adds an activity to a day — a catalog place (`placeSlug`) or something the
 * traveller invented (`title`). `If-Match` is optional: appending cannot
 * overwrite anyone's edit. It is still checked when supplied.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    const input = await parseJsonBody(request, tripActivityCreateSchema);
    return tripResponse(await repository.addActivity(userId, id, input, expected), 201);
  });
}
