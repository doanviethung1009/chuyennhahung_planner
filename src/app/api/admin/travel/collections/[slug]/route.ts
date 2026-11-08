import { adminRoute, jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { collectionUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export function GET(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getCollection(slug));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, collectionUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updateCollection(slug, patch));
  });
}

export function DELETE(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    await repository.deleteCollection(slug);
    return noContent();
  });
}
