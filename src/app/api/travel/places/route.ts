import { getRepository } from '@/server/content/instance';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

/** Reads the content store on every request — never statically optimised. */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // Places carry no publish status: a place exists or it does not.
    const places = await repository.listPlaces(query);
    return jsonOk({ places, count: places.length });
  });
}
