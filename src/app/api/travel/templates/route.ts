import { getRepository } from '@/server/content/instance';
import { jsonOk, parseListQuery, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return publicRoute(async () => {
    const repository = await getRepository();
    const query = parseListQuery(request);
    // Private templates are never listed publicly, regardless of the query.
    const templates = await repository.listTemplates({ ...query, visibility: 'public' });
    return jsonOk({ templates, count: templates.length });
  });
}
