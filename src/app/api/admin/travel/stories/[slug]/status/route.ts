import { adminRoute, jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { publishActionSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/** `{ "action": "publish" | "unpublish" | "archive" }` */
export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const action = await parseJsonBody(request, publishActionSchema);
    const repository = await getRepository();
    return jsonOk(await repository.setStoryStatus(slug, action));
  });
}
