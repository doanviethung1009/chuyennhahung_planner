import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Issues a new temporary password (shown once) and ends every session of the
 * user (ADR 0007). There is no self-service reset: no email sender exists.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, async (repository) => {
    const { userId } = await context.params;
    return plannerJson(await repository.resetUserPassword(userId));
  });
}
