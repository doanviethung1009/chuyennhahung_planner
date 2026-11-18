import { adminContentRoute } from '@/server/admin/content-route';
import { jsonOk } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';

export const dynamic = 'force-dynamic';

/**
 * Referential sweep over the whole store. The JSON store enforces no foreign
 * keys, so this is how a hand-edited file gets caught (ADR 0001, Consequences).
 */
export function GET(request: Request) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const repository = await getRepository();
    const issues = await repository.validateIntegrity();
    return jsonOk({ ok: issues.length === 0, issues });
  });
}
