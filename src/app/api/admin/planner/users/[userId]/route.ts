import { ContentError } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, plannerJson, plannerNoContent } from '@/server/planner/http';
import { plannerUserRoleUpdateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Sets a traveller's role. The first privilege-granting route (ADR 0006): it
 * rests on the admin token alone. Strict body — an unknown key is a 422.
 * Idempotent: repeating the same role is a 200 and writes nothing.
 */
export function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:promote', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    const { role } = await parseJsonBody(request, plannerUserRoleUpdateSchema);
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson({ user: await repository.setUserRole(userId, role, actor) });
  });
}

/**
 * Removes a traveller (ADR 0017). `?mode=soft` hides and disables the account
 * but keeps its data, and can be undone with `POST .../restore`; `?mode=hard`
 * (the default, as before) deletes it for good and refuses while they still
 * own trips. A session may hard-delete only an account that was soft-deleted
 * first; the service token keeps the direct path. Staff accounts only from a
 * session; never yourself.
 */
export function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const { userId } = await context.params;
    const mode = new URL(request.url).searchParams.get('mode') ?? 'hard';
    if (mode !== 'soft' && mode !== 'hard') {
      throw new ContentError('validation_failed', 'mode must be "soft" or "hard"', [
        { path: 'mode', message: 'must be soft or hard' },
      ]);
    }
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    if (mode === 'soft') {
      return plannerJson({ user: await repository.changeAccountState(userId, 'delete', actor) });
    }
    await repository.deleteUser(userId, actor);
    return plannerNoContent();
  });
}
