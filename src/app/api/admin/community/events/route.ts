import { ContentError } from '@/server/content/errors';
import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * Staff read of the community audit log for one target (ADR 0019 §2). Read-only:
 * there is no write method on this route or in the repository. `targetId` is a
 * trip, review or user id (a guest restriction is its restriction id).
 */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'community:moderate', session: true }, async (repository) => {
    const targetId = new URL(request.url).searchParams.get('targetId')?.trim() ?? '';
    if (targetId === '' || targetId.length > 64) {
      throw new ContentError('bad_request', 'targetId is required (at most 64 characters)');
    }
    const items = await repository.listEvents(targetId);
    return jsonOk({ items, count: items.length });
  });
}
