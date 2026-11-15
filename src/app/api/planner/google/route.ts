import { rateLimited } from '@/server/content/errors';
import { googleUnlinkLimiter } from '@/server/rate-limit';
import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * The signed-in user removes the Google link from their own account (ADR 0007).
 * Refused with 409 when the account has no password, so it cannot be locked
 * out. Rate-limited per user. Their other sessions end; this one stays.
 */
export function DELETE(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const limit = googleUnlinkLimiter.check(userId);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    return plannerJson({ user: await repository.unlinkOwnGoogle(request, userId) });
  });
}
