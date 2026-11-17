import { jsonOk } from '@/server/content/http';
import { adminContentRoute } from '@/server/admin/content-route';
import { loadOverview } from '@/server/admin/overview';

export const dynamic = 'force-dynamic';

/**
 * Dashboard counts for the signed-in staff member (P07-11). `content:write` is
 * the lowest action any card needs (editor and up, and the service token); each
 * card is then filtered by its own action. Counts only: no rows, no handles.
 */
export function GET(request: Request) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async (principal) => {
    const role = principal.kind === 'service' ? 'service' : principal.role;
    return jsonOk(await loadOverview({ role }));
  });
}
