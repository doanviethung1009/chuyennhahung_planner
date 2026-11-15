import { ContentError } from '@/server/content/errors';
import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';
import { reviewStatusSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/** Staff review queue (ADR 0014). `?status=` filters; pending first. */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'community:moderate', session: true }, async (repository) => {
    const raw = new URL(request.url).searchParams.get('status');
    const status = raw === null || raw === '' ? undefined : reviewStatusSchema.safeParse(raw);
    if (status && !status.success) throw new ContentError('bad_request', 'unknown status');
    const items = await repository.listReviewQueue(status?.data);
    return jsonOk({ items, count: items.length });
  });
}
