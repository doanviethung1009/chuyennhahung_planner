import { parseOptionalJsonBody } from '@/server/content/http';
import { plannerRoute, tripResponse } from '@/server/planner/http';
import { tripDuplicateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Copies one of the caller's active trips into a new, independent draft. The
 * body is optional (`{ title? }`); a bodiless POST is a plain duplicate. No
 * `If-Match`: the source is only read, never changed.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const input = await parseOptionalJsonBody(request, tripDuplicateSchema);
    return tripResponse(await repository.duplicateTrip(userId, id, input), 201);
  });
}
