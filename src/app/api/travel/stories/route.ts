import { getRepository } from '@/server/content/instance';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // The public list is published-only, whatever `status` the caller asked for.
    const stories = await repository.listStories({ ...query, status: 'published' });
    return jsonOk({ stories, count: stories.length });
  });
}
