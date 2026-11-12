import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { adminRoute, jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { reviewUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export function GET(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { id } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getReview(id));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { id } = await context.params;
    const patch = await parseJsonBody(request, reviewUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updateReview(id, patch, ifMatchStamp(request)));
  });
}

export function DELETE(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { id } = await context.params;
    const repository = await getRepository();
    await repository.deleteReview(id);
    return noContent();
  });
}
