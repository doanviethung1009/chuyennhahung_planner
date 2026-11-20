import { rateLimited } from '@/server/content/errors';
import { getWriteLimiters } from '@/server/planner/instance';
import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Issues a new link for a map that is shared; the old one dies in the same
 * transaction. The new token is returned once and never stored (ADR 0030 §4).
 * No body: the user is the session's.
 */
export function POST(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const limit = await (await getWriteLimiters()).memberMapShare.check(userId);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    return plannerJson(await repository.rotateMemberMapShare(userId));
  });
}
