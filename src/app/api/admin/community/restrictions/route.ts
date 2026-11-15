import { ContentError } from '@/server/content/errors';
import { jsonCreated, jsonOk, parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, type AdminPrincipal } from '@/server/planner/http';
import { createRestrictionSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

const actorOf = (principal: AdminPrincipal): string =>
  principal.kind === 'service' ? 'service' : principal.userId;

/** Staff list of restrictions (ADR 0015). No author ids or guest keys. `?active=1` hides lifted and expired. */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'community:restrict', session: true }, async (repository) => {
    const active = new URL(request.url).searchParams.get('active');
    if (active !== null && active !== '' && active !== '1' && active !== '0') {
      throw new ContentError('bad_request', 'active must be 1 or 0');
    }
    const items = await repository.listRestrictions(active === '1');
    return jsonOk({ items, count: items.length });
  });
}

/** Switch an author off, for one place or all, from one of their reviews (ADR 0015). */
export function POST(request: Request) {
  return adminPlannerRoute(
    request,
    { action: 'community:restrict', session: true },
    async (repository, principal) => {
      const input = await parseJsonBody(request, createRestrictionSchema);
      const created = await repository.createRestriction(input, actorOf(principal));
      return jsonCreated(created);
    },
  );
}
