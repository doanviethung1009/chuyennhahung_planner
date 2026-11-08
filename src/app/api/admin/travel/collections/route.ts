import {
  adminRoute,
  jsonCreated,
  jsonOk,
  parseJsonBody,
  parseListQuery,
} from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { collectionCreateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return adminRoute(request, async () => {
    const repository = await getRepository();
    const collections = await repository.listCollections(parseListQuery(request));
    return jsonOk({ collections, count: collections.length });
  });
}

export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = await parseJsonBody(request, collectionCreateSchema);
    const repository = await getRepository();
    return jsonCreated(await repository.createCollection(input));
  });
}
