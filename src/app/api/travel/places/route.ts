import { getRepository } from '@/server/content/instance';
import { toPublicPlace } from '@/server/content/public-places';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

/** Reads the content store on every request — never statically optimised. */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // Only published places (ADR 0035), whatever `status` the caller sent. The public
    // shape is the ADR 0026 allow-list; the raw record stays on the admin routes.
    const places = (await repository.listPlaces({ ...query, status: 'published' })).map(toPublicPlace);
    return jsonOk({ places, count: places.length });
  });
}
