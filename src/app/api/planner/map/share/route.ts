import { rateLimited } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import { getWriteLimiters } from '@/server/planner/instance';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { memberMapShareInputSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Member-map sharing for the session's own user (ADR 0030 §4). The principal is
 * the session: no user id or slug is read from a body or a path. `plannerRoute`
 * enforces the cookie same-origin rule. Responses never carry a stored token;
 * only the response that issues one returns it, once.
 */

/** `{ enabled, shareName, visitedPlaces, sparse }` — never the token. */
export function GET(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) =>
    plannerJson(await repository.getMemberMapShare(userId)),
  );
}

/**
 * Strict body `{ enabled, shareName }`. Idempotent: enabling a map that already
 * has a token keeps it and returns no token; enabling one without issues a token
 * and returns it once. `name` is refused until it is available (403
 * `share_name_unavailable`) and when the display name looks like contact details
 * (422 `display_name_unsuitable`).
 */
export function PUT(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const input = await parseJsonBody(request, memberMapShareInputSchema);
    const limit = await (await getWriteLimiters()).memberMapShare.check(userId);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    return plannerJson(await repository.setMemberMapShare(userId, input));
  });
}

/**
 * Revokes the link at once. Repeating it succeeds. Deliberately **not** rate
 * limited: it is idempotent, writes an audit row only when it changes something,
 * and a member must always be able to kill a leaked link, even after an hour of
 * toggling has used up the change bucket (sec-check L6).
 */
export function DELETE(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) =>
    plannerJson(await repository.revokeMemberMapShare(userId)),
  );
}
