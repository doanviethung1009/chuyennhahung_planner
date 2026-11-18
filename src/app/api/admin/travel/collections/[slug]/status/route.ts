import { adminContentRoute } from '@/server/admin/content-route';
import { jsonOk, parseJsonBody } from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { publishActionSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return adminContentRoute(request, { action: 'content:write', session: true }, async () => {
    const { slug } = await context.params;
    const action = await parseJsonBody(request, publishActionSchema);
    const repository = await getRepository();
    return jsonOk(await repository.setCollectionStatus(slug, action));
  });
}
