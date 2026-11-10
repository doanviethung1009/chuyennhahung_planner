import { rateLimited } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import { plannerNoContent, plannerRoute } from '@/server/planner/http';
import { passwordChangeSchema } from '@/server/planner/schemas';
import { clientKey, signInLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Changes the signed-in user's password (ADR 0007). Needs the current one,
 * clears the temporary-password flag, and ends every other session of the
 * user; this one stays signed in. Reachable while a temporary password is
 * pending — it is the way out of that state.
 */
export function POST(request: Request) {
  return plannerRoute(
    request,
    async ({ userId }, repository) => {
      const limit = signInLimiter.check(clientKey(request.headers));
      if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
      const { currentPassword, newPassword } = await parseJsonBody(request, passwordChangeSchema);
      await repository.changePassword(request, userId, currentPassword, newPassword);
      return plannerNoContent();
    },
    { allowPendingPasswordChange: true },
  );
}
