import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { adminRoute, jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { storyUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export function GET(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getStory(slug));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, storyUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updateStory(slug, patch, ifMatchStamp(request)));
  });
}

export function DELETE(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    await repository.deleteStory(slug);
    return noContent();
  });
}
