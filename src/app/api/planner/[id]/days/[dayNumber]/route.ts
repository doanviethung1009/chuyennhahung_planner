import { z } from 'zod';
import { ContentError } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripDayUpdateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

const dayNumberParam = z.coerce.number().int().min(1).max(30);

/**
 * Titles and notes a day. A day's number and date are derived from the trip and
 * are not editable here — change `durationDays` or `startDate` on the trip.
 */
export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; dayNumber: string }> },
) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id, dayNumber } = await context.params;
    const parsed = dayNumberParam.safeParse(dayNumber);
    if (!parsed.success) {
      throw new ContentError('bad_request', `"${dayNumber}" is not a valid day number`);
    }
    const expected = ifMatchVersion(request);
    const patch = await parseJsonBody(request, tripDayUpdateSchema);
    return tripResponse(
      await repository.updateDay(userId, id, parsed.data, patch, expected),
    );
  });
}
