import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * What a permanent delete would remove with this account (ADR 0017): the
 * number of its trips and community reviews, counted at request time.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson({ impact: await repository.accountImpact(userId, actor) });
  });
}
