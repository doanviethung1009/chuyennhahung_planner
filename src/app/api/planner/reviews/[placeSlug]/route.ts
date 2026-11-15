import { rateLimited } from '@/server/content/errors';
import { parseJsonBody } from '@/server/content/http';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { plannerReviewInputSchema } from '@/server/planner/schemas';
import { plannerReviewLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ placeSlug: string }> };

/**
 * Writes (or replaces) the signed-in author's review of a place. It always
 * lands `pending`: a Planner review waits for staff (ADR 0014).
 */
export function PUT(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { placeSlug } = await context.params;
    const input = await parseJsonBody(request, plannerReviewInputSchema);
    const limit = plannerReviewLimiter.check(userId);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    return plannerJson(await repository.upsertPlannerReview(userId, placeSlug, input));
  });
}

/** Deletes the author's own review. Idempotent. */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { placeSlug } = await context.params;
    await repository.deleteOwnReview(userId, placeSlug);
    return plannerJson({ ok: true });
  });
}
