import { parseJsonBody, jsonOk } from '@/server/content/http';
import { adminPlannerRoute, type AdminPrincipal } from '@/server/planner/http';
import { listingDecisionSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

const actorOf = (principal: AdminPrincipal): string =>
  principal.kind === 'service' ? 'service' : principal.userId;

/** Approve, reject (pending) or remove (approved) a listing — ADR 0014. */
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminPlannerRoute(
    request,
    { action: 'community:moderate', session: true },
    async (repository, principal) => {
      const { id } = await context.params;
      const { decision, reason } = await parseJsonBody(request, listingDecisionSchema);
      const listing = await repository.decideListing(id, decision, actorOf(principal), reason ?? null);
      return jsonOk({ tripId: id, listing });
    },
  );
}
