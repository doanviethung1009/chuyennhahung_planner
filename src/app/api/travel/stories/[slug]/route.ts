import { getRepository } from '@/server/content/instance';
import { toPublicStoryRecord } from '@/server/content/public-story-api';
import { jsonOk, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return publicRoute(async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    // A draft is a 404 here, not a 403 — its existence is not public knowledge.
    return jsonOk(toPublicStoryRecord(await repository.getPublishedStory(slug)));
  });
}
