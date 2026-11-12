import { adminContentRoute } from '@/server/admin/content-route';
import {
  adminRoute,
  jsonCreated,
  jsonOk,
  parseJsonBody,
  parseListQuery,
} from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { placeCreateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const repository = await getRepository();
    const places = await repository.listPlaces(parseListQuery(request));
    return jsonOk({ places, count: places.length });
  });
}

export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = await parseJsonBody(request, placeCreateSchema);
    const repository = await getRepository();
    return jsonCreated(await repository.createPlace(input));
  });
}
