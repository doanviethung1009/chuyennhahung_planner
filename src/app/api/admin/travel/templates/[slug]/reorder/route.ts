import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { reorderActivitiesSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/**
 * Reorders the activities inside one day:
 * `{ "day": 2, "activityIds": ["act_b", "act_a", "act_c"] }`.
 * The ids must be a permutation of that day's existing activities.
 */
export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'template:write', session: true }, async () => {
    const { slug } = await context.params;
    const input = await parseJsonBody(request, reorderActivitiesSchema);
    const repository = await getRepository();
    return jsonOk(await repository.reorderActivities(slug, input, ifMatchStamp(request)));
  });
}
