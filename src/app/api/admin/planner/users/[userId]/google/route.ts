import { adminPlannerRoute, plannerJson } from '@/server/planner/http';
import { assertMayManageUser } from '@/server/planner/manage-user';

export const dynamic = 'force-dynamic';

/**
 * Removes the user's Google link and ends their sessions (ADR 0007). Also
 * reachable from the admin session (P07-12): an admin acts only on members and
 * editors (ADR 0017 §3), checked here before anything is written.
 */
export function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    await assertMayManageUser(repository, principal, userId);
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson({ user: await repository.unlinkGoogle(userId, actor) });
  });
}
