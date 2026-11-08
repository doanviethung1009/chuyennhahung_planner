import { adminPlannerRoute, plannerNoContent } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

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
