import { jsonOk, parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, type AdminPrincipal } from '@/server/planner/http';
import { resolveReportSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

const actorOf = (principal: AdminPrincipal): string =>
  principal.kind === 'service' ? 'service' : principal.userId;

/**
 * Close a report as dismissed or actioned (batch 10.5). `actioned` only marks the
 * report; removing the content is the existing remove action. Idempotent.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminPlannerRoute(
    request,
    { action: 'community:moderate', session: true },
    async (repository, principal) => {
      const { id } = await context.params;
      const input = await parseJsonBody(request, resolveReportSchema);
      const status = await repository.resolveReport(id, input, actorOf(principal));
      return jsonOk({ id, status });
    },
  );
}
