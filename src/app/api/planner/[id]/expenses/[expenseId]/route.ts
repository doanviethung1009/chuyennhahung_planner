import { parseJsonBody } from '@/server/content/http';
import { ifMatchVersion, plannerRoute, tripResponse } from '@/server/planner/http';
import { tripExpenseUpdateSchema } from '@/server/planner/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; expenseId: string }> };

export function PATCH(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id, expenseId } = await context.params;
    const expected = ifMatchVersion(request);
    const patch = await parseJsonBody(request, tripExpenseUpdateSchema);
    return tripResponse(
      await repository.updateExpense(userId, id, expenseId, patch, expected),
    );
  });
}

export function DELETE(request: Request, context: Context) {
  return plannerRoute(request, async ({ userId }, repository) => {
    const { id, expenseId } = await context.params;
    const expected = ifMatchVersion(request);
    return tripResponse(await repository.deleteExpense(userId, id, expenseId, expected));
  });
}
