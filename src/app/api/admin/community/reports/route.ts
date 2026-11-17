import { ContentError } from '@/server/content/errors';
import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';
import { reportStatusSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/** Staff list of reports, open first (batch 10.5). No reporter id, no client key. `?status=open|actioned|dismissed`. */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'community:moderate', session: true }, async (repository) => {
    const raw = new URL(request.url).searchParams.get('status');
    let status;
    if (raw !== null && raw !== '') {
      const parsed = reportStatusSchema.safeParse(raw);
      if (!parsed.success) throw new ContentError('bad_request', 'status must be open, actioned or dismissed');
      status = parsed.data;
    }
    const items = await repository.listReports(status);
    return jsonOk({ items, count: items.length });
  });
}
