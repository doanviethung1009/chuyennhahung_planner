import { jsonOk } from '@/server/content/http';
import { adminContentRoute } from '@/server/admin/content-route';
import { loadSystemStatus } from '@/server/admin/system';

export const dynamic = 'force-dynamic';

/**
 * Operator system status (P07-17). `runbook:read` is the super admin alone: an
 * admin or editor gets 403, and the service token gets 403 too (it does not
 * hold that action). Read-only; the body is the allow-listed `SystemStatus`.
 */
export function GET(request: Request) {
  return adminContentRoute(request, { action: 'runbook:read', session: true }, async () =>
    jsonOk(await loadSystemStatus()),
  );
}
