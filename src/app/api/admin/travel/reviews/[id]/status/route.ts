import { adminContentRoute } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { publishActionSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminContentRoute(request, { action: 'story:publish', session: true }, async () => {
    const { id } = await context.params;
    const action = await parseJsonBody(request, publishActionSchema);
    const repository = await getRepository();
    return jsonOk(await repository.setReviewStatus(id, action));
  });
}
