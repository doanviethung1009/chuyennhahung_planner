import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/** Brings an archived trip back, exactly as it was. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    return tripResponse(await repository.restoreTrip(userId, id, expected));
  });
}
