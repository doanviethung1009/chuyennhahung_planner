import { jsonOk, parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, type AdminPrincipal } from '@/server/planner/http';
import { reviewDecisionSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

const actorOf = (principal: AdminPrincipal): string =>
  principal.kind === 'service' ? 'service' : principal.userId;

/** Approve or reject a pending review, or remove an approved one (ADR 0014). */
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminPlannerRoute(
    request,
    { action: 'community:moderate', session: true },
    async (repository, principal) => {
      const { id } = await context.params;
      const { decision, reason } = await parseJsonBody(request, reviewDecisionSchema);
      const status = await repository.decideReview(id, decision, actorOf(principal), reason ?? null);
      return jsonOk({ id, status });
    },
  );
}
