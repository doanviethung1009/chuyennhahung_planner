import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Restores a soft-deleted account (ADR 0017).
 * Staff targets only; never yourself; an admin acts only on editors.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson({ user: await repository.changeAccountState(userId, 'restore', actor) });
  });
}
