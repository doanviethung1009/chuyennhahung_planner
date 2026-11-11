import { parseJsonBody } from '@/server/content/http';
import { adminPlannerRoute, plannerJson } from '@/server/planner/http';
import { plannerUserCreateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/** Lists travellers. Token digests are never part of the response. */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository) => {
    const users = await repository.listUsers();
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
  return adminPlannerRoute(request, { action: 'user:provision', session: true }, async (repository) => {
    const input = await parseJsonBody(request, plannerUserCreateSchema);
    return plannerJson(await repository.createUser(input), 201);
  });
}
