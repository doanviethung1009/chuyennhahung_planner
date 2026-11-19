import { getRepository } from '@/server/content/instance';
import { toPublicPlace } from '@/server/content/public-places';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

/** Reads the content store on every request — never statically optimised. */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // Places carry no publish status: a place exists or it does not. The public
    // shape is the ADR 0026 allow-list; the raw record stays on the admin routes.
    const places = (await repository.listPlaces(query)).map(toPublicPlace);
    return jsonOk({ places, count: places.length });
  });
}
