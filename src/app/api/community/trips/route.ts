import { NextResponse } from 'next/server';
import { rateLimited } from '@/server/content/errors';
import { toErrorResponse } from '@/server/content/http';
import { getPlannerRepository } from '@/server/planner/instance';
import { checkShareRead } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public gallery of community trips (ADR 0014): approved listings only, read
 * only, no cookie read. Only GET is exported.
 */
export async function GET(request: Request) {
  try {
    const limit = checkShareRead(request.headers);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);
    const repository = await getPlannerRepository();
    const items = await repository.listCommunityTrips();
    return NextResponse.json(
      { items },
      { status: 200, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
