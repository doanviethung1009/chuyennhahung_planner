import { adminContentRoute } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { publishActionSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/**
 * `{ "action": "publish" | "unpublish" | "archive" }` (ADR 0035). Same holders as
 * a story's publish (`story:publish`); taking a place down is refused while a
 * published story shows it.
 */
export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'story:publish', session: true }, async () => {
    const { slug } = await context.params;
    const action = await parseJsonBody(request, publishActionSchema);
    const repository = await getRepository();
    return jsonOk(await repository.setPlaceStatus(slug, action));
  });
}
