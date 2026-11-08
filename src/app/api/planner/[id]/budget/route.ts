import { plannerJson, plannerRoute } from '@/server/planner/http';

export const dynamic = 'force-dynamic';

/**
 * The budget on its own, for a client that only needs the numbers. Computed on
 * read from activities and expenses — never stored, so it cannot go stale.
 */
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    return plannerJson({ budget: await repository.getBudget(userId, id) });
  });
}
