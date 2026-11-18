import { adminPlannerRoute, plannerJson } from '@/server/planner/http';
import { assertMayManageUser } from '@/server/planner/manage-user';

export const dynamic = 'force-dynamic';

/**
 * Issues a new access token and invalidates the previous one immediately. This
 * is the answer to a leaked or forgotten token. Also reachable from the admin
 * session (P07-12): an admin acts only on members and editors (ADR 0017 §3).
 * The token is in this response only, `no-store`.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    await assertMayManageUser(repository, principal, userId);
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson(await repository.rotateUserToken(userId, actor));
  });
}
