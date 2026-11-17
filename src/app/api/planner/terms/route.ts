import { parseJsonBody } from '@/server/content/http';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { acceptTermsSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/** Whether the signed-in member has accepted the current Creator Terms. */
export function GET(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) =>
    plannerJson(await repository.termsStatus(userId)),
  );
}

/**
 * Accepts the current Creator Terms for the session's own user (ADR 0019 §4).
 * Body `{ version, lang? }`; `version` must equal the current one. Idempotent.
 * The cookie same-origin rule is enforced by `plannerRoute`.
 */
export function POST(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { version, lang } = await parseJsonBody(request, acceptTermsSchema);
    return plannerJson(await repository.acceptTerms(userId, version, lang));
  });
}
