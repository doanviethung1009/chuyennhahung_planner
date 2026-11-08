import { adminPlannerRoute, plannerJson } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Referential and structural sweep over the Planner document. The JSON store
 * enforces no foreign keys and no unique constraints, so this is how a
 * hand-edited `planner.json` gets caught (ADR 0002, Consequences).
 *
 * It answers identifiers and issue descriptions only — never trip content. The
 * operator token that reaches this route deliberately cannot read a trip
 * (ADR 0002 §3), and an integrity sweep is not a way around that.
 */
export function GET(request: Request) {
  return adminPlannerRoute(request, async (repository) => {
    const issues = await repository.validateIntegrity();
    return plannerJson({ ok: issues.length === 0, issues });
  });
}
