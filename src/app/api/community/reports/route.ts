import { invalidateOverviewPayloadsAfter } from '@/server/overview-cache';
import { NextResponse } from 'next/server';
import { isContentError } from '@/server/content/repository';
import { rateLimited } from '@/server/content/errors';
import { parseJsonBody, toErrorResponse } from '@/server/content/http';
import { getPlannerRepository, getWriteLimiters } from '@/server/planner/instance';
import { createReportSchema } from '@/server/planner/schemas';
import { clientKey } from '@/server/rate-limit';
import { ownOrigins } from '@/server/request-scheme';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } as const;

/**
 * False only when the request says it came from another site: `Sec-Fetch-Site`
 * other than same-origin, or (when that header is missing) an `Origin` that is
 * not ours or not parseable. A request that states neither is not a browser
 * form post and is identified as before (CORE-11 / S-3).
 */
function statesOwnOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    return ownOrigins(request).has(new URL(origin).origin);
  } catch {
    return false;
  }
}

/**
 * A reader's report of a community trip or review (batch 10.5). Open to guests
 * and members, no Terms needed. Bounded like a guest review: a shared per-day
 * limit (member id, else client key), a honeypot, a fixed reason list and a
 * plain-text note. A duplicate open report answers like a success; an unknown
 * or non-public target is one 404 for both. A member is recognised only for a
 * same-origin request, so another site cannot file a report in their name.
 */
export async function POST(request: Request) {
  try {
    const repository = await getPlannerRepository();
    let userId: string | null = null;
    if (statesOwnOrigin(request)) {
      try {
        userId = (await repository.identify(request)).userId;
      } catch (error) {
        // No or invalid credentials: a guest. A store failure is not a guest, so it still surfaces.
        if (!isContentError(error) || error.status >= 500) throw error;
      }
    }
    const key = userId ?? clientKey(request.headers);
    const limit = await (await getWriteLimiters()).report.check(userId ? `u:${userId}` : `c:${key}`);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);

    const input = await parseJsonBody(request, createReportSchema);
    if (input.website !== undefined && input.website.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 201, headers: HEADERS });
    }
    await repository.createReport(input, { userId, clientKey: key });
    return NextResponse.json({ ok: true }, { status: 201, headers: HEADERS });
  } catch (error) {
    return toErrorResponse(error);
  } finally {
    invalidateOverviewPayloadsAfter(request);
  }
}
