import { invalidateOverviewPayloadsAfter } from '@/server/overview-cache';
import { NextResponse } from 'next/server';
import { ContentError, rateLimited } from '@/server/content/errors';
import { parseJsonBody, toErrorResponse } from '@/server/content/http';
import { getPlannerRepository, getWriteLimiters } from '@/server/planner/instance';
import { guestReviewInputSchema } from '@/server/planner/schemas';
import { slugSchema } from '@/server/content/schemas';
import { requireContributionOpen } from '@/server/community/contribution-gate';
import { checkShareRead, clientKey } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } as const;

/** Approved reviews, optionally for one place (ADR 0014). Read only, no cookie read. */
export async function GET(request: Request) {
  try {
    const limit = checkShareRead(request.headers);
    if (!limit.ok) throw rateLimited(limit.retryAfterSeconds);

    const raw = new URL(request.url).searchParams.get('placeSlug');
    let slugs: string[] | undefined;
    if (raw !== null) {
      const parsed = slugSchema.safeParse(raw);
      if (!parsed.success) throw new ContentError('bad_request', 'placeSlug is not a valid slug');
      slugs = [parsed.data];
    }
    const result = await (await getPlannerRepository()).listApprovedReviews(slugs);
    return NextResponse.json(result, { status: 200, headers: HEADERS });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * A visitor's review, no account needed. Published at once — the owner's
 * decision (ADR 0014) — so it is bounded instead: a per-client limit, a
 * honeypot, plain text only, one per place per client per day. It reads no
 * cookie, so there is no session for a cross-site page to ride on.
 */
export async function POST(request: Request) {
  try {
    // Closed gate: refuse before the limiter counts or the body is read (P10-15).
    requireContributionOpen();
    const key = clientKey(request.headers);
    // Shared across instances on PostgreSQL; a failing database throws 503 here, before any write.
    const limit = await (await getWriteLimiters()).guestReview.check(key);
    if (!limit.ok) {
      // Warn staff once per hour per guest (audit event on their latest review). Best effort.
      await (await getPlannerRepository()).recordGuestReviewLimitHit(key).catch(() => undefined);
      throw rateLimited(limit.retryAfterSeconds);
    }

    const input = await parseJsonBody(request, guestReviewInputSchema);
    // A filled honeypot is a bot. Answer exactly like a success and store nothing.
    if (input.website !== undefined && input.website.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 201, headers: HEADERS });
    }
    await (await getPlannerRepository()).createGuestReview(input, key);
    return NextResponse.json({ ok: true }, { status: 201, headers: HEADERS });
  } catch (error) {
    return toErrorResponse(error);
  } finally {
    invalidateOverviewPayloadsAfter(request);
  }
}
