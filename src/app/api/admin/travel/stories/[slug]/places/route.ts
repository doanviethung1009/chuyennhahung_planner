import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { storyPlacesPatchSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/** Add places to, or remove them from, a story: `{ add: [], remove: [] }`. */
export function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, storyPlacesPatchSchema);
    const repository = await getRepository();
    return jsonOk(await repository.patchStoryPlaces(slug, patch, ifMatchStamp(request)));
  });
}
