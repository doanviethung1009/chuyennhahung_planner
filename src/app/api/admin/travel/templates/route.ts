import {
  adminRoute,
  jsonCreated,
  jsonOk,
  parseJsonBody,
  parseListQuery,
} from '@/server/content/http';
import { getRepository } from '@/server/content/instance';
import { templateCreateSchema } from '@/server/content/schemas';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return adminRoute(request, async () => {
    const repository = await getRepository();
    const templates = await repository.listTemplates(parseListQuery(request));
    return jsonOk({ templates, count: templates.length });
  });
}

/** Creates an itinerary template from a real trip (`sourceStorySlug`). */
export function POST(request: Request) {
  return adminRoute(request, async () => {
    const input = await parseJsonBody(request, templateCreateSchema);
    const repository = await getRepository();
    return jsonCreated(await repository.createTemplate(input));
  });
}
