import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Bans a staff account (ADR 0017): ends every session at once and blocks cookie, access-token and Google sign-in. Reversible with `unban`.
 * Staff targets only; never yourself; an admin acts only on editors.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson({ user: await repository.changeAccountState(userId, 'ban', actor) });
  });
}
