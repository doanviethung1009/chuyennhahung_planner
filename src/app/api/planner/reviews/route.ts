import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/** The signed-in author's own reviews, with their moderation status (ADR 0014). */
export function GET(request: Request) {
  return plannerRoute(request, async ({ userId }, repository) =>
    plannerJson({
      items: await repository.listOwnReviews(userId),
      // Why writing is closed, if staff switched this account off (ADR 0015).
      restrictions: await repository.listOwnRestrictions(userId),
    }),
  );
}
