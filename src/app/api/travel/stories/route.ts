import { getRepository } from '@/server/content/instance';
import { toPublicStoryRecord } from '@/server/content/public-story-api';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // The public list is published-only, whatever `status` the caller asked for.
    // The public shape is an allow-list (STORY-API-PROJ); the raw record stays on the admin routes.
    const stories = (await repository.listStories({ ...query, status: 'published' })).map(toPublicStoryRecord);
    return jsonOk({ stories, count: stories.length });
  });
}
