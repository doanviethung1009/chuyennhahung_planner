import { parseJsonBody } from '@/server/content/http';
import { plannerJson, plannerRoute } from '@/server/planner/http';
import { listingRequestSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * The owner asks to appear on the home page and gallery (ADR 0014). The result
 * is always `pending`; only staff approve. No `If-Match`: it is not a content edit.
 */
export function PUT(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const { authorDisplay } = await parseJsonBody(request, listingRequestSchema);
    return plannerJson(await repository.requestListing(userId, id, authorDisplay));
  });
}

/** Withdraws the listing. Idempotent. */
export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    return plannerJson(await repository.withdrawListing(userId, id));
  });
}
