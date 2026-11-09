import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/server/content/http';
import { rateLimited } from '@/server/content/errors';
import { getPlannerRepository } from '@/server/planner/instance';
import { checkShareRead } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
} as const;

/** One body for every miss, so a caller cannot tell why a link failed. */
const NOT_FOUND_BODY = {
  error: { code: 'not_found', message: 'this link does not exist', issues: [] },
};

function notFoundResponse(): NextResponse {
  return NextResponse.json(NOT_FOUND_BODY, { status: 404, headers: BASE_HEADERS });
}

/**
 * Public, unauthenticated, read-only view of a shared trip (ADR 0005). It reads
 * no cookie, mutates nothing, and answers every failure with the same 404.
 * Only GET is exported, so any other method is a 405 from the framework.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const limit = checkShareRead(request.headers);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);

    const { token } = await context.params;
    const repository = await getPlannerRepository();
    const view = await repository.getSharedTrip(token);
    if (!view) return notFoundResponse();

    return NextResponse.json(view, {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        ...(view.visibility === 'unlisted' ? { 'x-robots-tag': 'noindex' } : {}),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
