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
 * Removes a traveller. Refuses while they still own trips — their plans are not
 * collateral damage of a user cleanup.
 */
export function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return adminPlannerRoute(request, async (repository) => {
    const { userId } = await context.params;
    await repository.deleteUser(userId);
    return plannerNoContent();
  });
}
