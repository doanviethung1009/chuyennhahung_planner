import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/** Issues a new link token; the previous one stops working immediately. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    return plannerJson(await repository.rotateShareToken(userId, id));
  });
}
