import { adminRoute, jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { storyPlacesPatchSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

/** Add places to, or remove them from, a story: `{ add: [], remove: [] }`. */
export function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, storyPlacesPatchSchema);
    const repository = await getRepository();
    return jsonOk(await repository.patchStoryPlaces(slug, patch));
  });
}
