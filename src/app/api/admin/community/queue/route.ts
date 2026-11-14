import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/** Staff queue of listing requests (ADR 0014): pending first. */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'community:moderate', session: true }, async (repository) => {
    const items = await repository.listListingQueue();
    return jsonOk({ items, count: items.length });
  });
}
