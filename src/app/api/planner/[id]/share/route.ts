import { parseJsonBody } from '@/server/content/http';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { shareSettingsSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Sets visibility. This is the only way `visibility` or a share token changes
 * (ADR 0005). The token is returned to the owner here and nowhere is it logged.
 */
export function PUT(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const { visibility } = await parseJsonBody(request, shareSettingsSchema);
    return plannerJson(await repository.setVisibility(userId, id, visibility));
  });
}

/** Stops sharing and kills the link. Idempotent. */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    return plannerJson(await repository.revokeShare(userId, id));
  });
}
