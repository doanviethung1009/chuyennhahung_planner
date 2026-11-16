import { ContentError, rateLimited } from '@/server/content/errors';
import { slugSchema } from '@/server/content/schemas';
import { parseJsonBody } from '@/server/content/http';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { plannerReviewInputSchema } from '@/server/planner/schemas';
import { plannerReviewLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ placeSlug: string }> };

async function placeSlugOf(context: Context): Promise<string> {
  const parsed = slugSchema.safeParse((await context.params).placeSlug);
  if (!parsed.success) throw new ContentError('bad_request', 'placeSlug is not a valid slug');
  return parsed.data;
}

/**
 * Writes (or replaces) the signed-in author's review of a place. It is published
 * at once (`approved`); there is no pre-moderation, and staff can remove it
 * afterwards (ADR 0014, amended 2026-11-15).
 */
export function PUT(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const placeSlug = await placeSlugOf(context);
    const input = await parseJsonBody(request, plannerReviewInputSchema);
    const limit = plannerReviewLimiter.check(userId);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    return plannerJson(await repository.upsertPlannerReview(userId, placeSlug, input));
  });
}

/** Deletes the author's own review. Idempotent. */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const placeSlug = await placeSlugOf(context);
    await repository.deleteOwnReview(userId, placeSlug);
    return plannerJson({ ok: true });
  });
}
