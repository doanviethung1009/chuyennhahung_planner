import { jsonOk, parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';
import { reviewEraseSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Erase a guest review's content on a data-removal request (ADR 0024 §8).
 * Irreversible, so `community:erase` (admin and up), not `community:moderate`.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminPlannerRoute(
    request,
    { action: 'community:erase', session: true },
    async (repository, principal) => {
      const { id } = await context.params;
      const { reason } = await parseJsonBody(request, reviewEraseSchema);
      await repository.eraseGuestReview(id, principal.kind === 'service' ? 'service' : principal.userId, reason);
      return jsonOk({ id, status: 'removed', erased: true });
    },
  );
}
