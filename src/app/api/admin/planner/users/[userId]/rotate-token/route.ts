import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Issues a new access token and invalidates the previous one immediately. This
 * is the answer to a leaked or forgotten token.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, async (repository) => {
    const { userId } = await context.params;
    return plannerJson(await repository.rotateUserToken(userId));
  });
}
