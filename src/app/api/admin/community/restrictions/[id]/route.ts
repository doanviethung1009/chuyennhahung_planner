import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute, type AdminPrincipal } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

const actorOf = (principal: AdminPrincipal): string =>
  principal.kind === 'service' ? 'service' : principal.userId;

/** Lifts a restriction (ADR 0015). Idempotent; the row stays as the audit record. */
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminPlannerRoute(
    request,
    { action: 'community:restrict', session: true },
    async (repository, principal) => {
      const { id } = await context.params;
      await repository.liftRestriction(id, actorOf(principal));
      return jsonOk({ id, lifted: true });
    },
  );
}
