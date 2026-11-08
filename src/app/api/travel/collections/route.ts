import { getRepository } from '@/server/content/instance';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    const collections = await repository.listCollections({
      ...query,
      status: 'published',
    });
    return jsonOk({ collections, count: collections.length });
  });
}
