import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripExpenseCreateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

/**
 * Records money actually paid. Linking an expense to its `activityId` marks
 * that activity settled, so the projection counts the payment instead of the
 * estimate — that link is what keeps activity and expense from being
 * double-counted.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id } = await context.params;
    const expected = ifMatchVersion(request);
    const input = await parseJsonBody(request, tripExpenseCreateSchema);
    return tripResponse(await repository.addExpense(userId, id, input, expected), 201);
  });
}
