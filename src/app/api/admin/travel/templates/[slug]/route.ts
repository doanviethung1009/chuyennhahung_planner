import { adminContentRoute, ifMatchStamp } from '@/server/admin/content-route';
import { adminRoute, jsonOk, noContent, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { templateUpdateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export function GET(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'template:write', session: true }, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getTemplate(slug));
  });
}

export function PATCH(request: Request, context: Context) {
  return adminContentRoute(request, { action: 'template:write', session: true }, async () => {
    const { slug } = await context.params;
    const patch = await parseJsonBody(request, templateUpdateSchema);
    const repository = await getRepository();
    return jsonOk(await repository.updateTemplate(slug, patch, ifMatchStamp(request)));
  });
}

/** Token-only on purpose (owner decision 2026-11-19): permanent delete is not an editor action. */
export function DELETE(request: Request, context: Context) {
  return adminRoute(request, async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    await repository.deleteTemplate(slug);
    return noContent();
  });
}
