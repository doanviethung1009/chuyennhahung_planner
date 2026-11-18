import { parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, plannerJson } from '@/server/planner/http';
import { plannerUserCreateSchema } from '@/server/planner/schemas';
import { pageUsers, parseUserPageQuery } from '@/server/planner/user-page';

export const dynamic = 'force-dynamic';

/**
 * Lists travellers. Token digests are never part of the response.
 *
 * With no query, every account, as ever. `limit` (1–200, capped), `cursor`
 * (opaque, from `nextCursor`; a bad one is 422) and `sort` (`handle`,
 * `created`, `-created`) switch on keyset paging.
 */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository) => {
    const users = await repository.listUsers();
    const query = parseUserPageQuery(new URL(request.url));
    if (query) {
      const page = pageUsers(users, query);
      return plannerJson({ users: page.users, count: page.users.length, total: page.total, nextCursor: page.nextCursor });
    }
    return plannerJson({ users, count: users.length });
  });
}

/**
 * Provisions a traveller and issues their access token.
 *
 * The token is in this response and in no other: only its SHA-256 digest is
 * stored. If it is lost, rotate it — it cannot be read back.
 */
export function POST(request: Request) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository, principal) => {
    const input = await parseJsonBody(request, plannerUserCreateSchema);
    const actor = principal.kind === 'session' ? { userId: principal.userId } : undefined;
    return plannerJson(await repository.createUser(input, actor), 201);
  });
}
