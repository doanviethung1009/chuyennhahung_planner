import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * The signed-in user removes the Google link from their own account (ADR 0007).
 * Refused with 409 when the account has no password, so it cannot be locked
 * out. Their other sessions end; this one stays.
 */
export function DELETE(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) => {
    return plannerJson({ user: await repository.unlinkOwnGoogle(request, userId) });
  });
}
