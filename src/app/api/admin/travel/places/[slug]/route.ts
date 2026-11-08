import { adminRoute, jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { placeUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export function GET(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getPlace(slug));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, placeUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updatePlace(slug, patch));
  });
}

export function DELETE(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    await repository.deletePlace(slug);
    return noContent();
  });
}
