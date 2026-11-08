import { getRepository } from '@/server/content/instance';
import { jsonOk, publicRoute } from '@/server/content/http';

export const dynamic = 'force-dynamic';

export function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return publicRoute(async () => {
    const { slug } = await context.params;
    const repository = await getRepository();
    return jsonOk(await repository.getPlace(slug));
  });
}
