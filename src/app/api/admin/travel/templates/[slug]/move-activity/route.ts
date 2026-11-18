import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { moveActivitySchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/** Moves one activity to another day or index: `{ activityId, toDay, toIndex }`. */
export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'template:write', session: true }, async () => {
    const { slug } = await context.params;
    const input = await parseJsonBody(request, moveActivitySchema);
    const repository = await getRepository();
    return jsonOk(await repository.moveActivity(slug, input, ifMatchStamp(request)));
  });
}
