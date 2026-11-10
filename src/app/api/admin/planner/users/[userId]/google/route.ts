import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/** Removes the user's Google link and ends their sessions (ADR 0007). */
export function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, async (repository) => {
    const { userId } = await context.params;
    return plannerJson({ user: await repository.unlinkGoogle(userId) });
  });
}
