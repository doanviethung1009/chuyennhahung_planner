import { z } from 'zod';
import { ContentError } from '@/server/content/errors';
import { jsonOk } from '@/server/content/http';
import { adminPlannerRoute } from '@/server/planner/http';
import { decodeAuditCursor } from '@/server/planner/repository';

export const dynamic = 'force-dynamic';

const when = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/, 'ISO date or date-time')
  .refine((v) => {
    const time = Date.parse(v);
    if (Number.isNaN(time)) return false;
    // A date that rolls over (2026-02-31) is not a real date.
    const [y, m, d] = v.slice(0, 10).split('-').map(Number) as [number, number, number];
    const day = new Date(Date.UTC(y, m - 1, d));
    return day.getUTCMonth() === m - 1 && day.getUTCDate() === d;
  }, 'not a real date');

const querySchema = z.object({
  actor: z.string().trim().min(1).max(80).optional(),
  targetType: z.enum(['trip', 'review', 'user', 'story']).optional(),
  action: z.string().trim().regex(/^[a-z_]{1,40}$/).optional(),
  from: when.optional(),
  to: when.optional(),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** A bare date means the whole day: `from` its start, `to` its end (UTC). */
function bound(value: string | undefined, end: boolean): string | undefined {
  if (!value) return undefined;
  const iso = value.length === 10 ? `${value}${end ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : value;
  return new Date(iso).toISOString();
}

/**
 * Staff read of the admin audit log (P07-13): who did what, when. Read-only; no
 * write method exists. Admin, super admin or the service token (`audit:read`).
 */
export function GET(request: Request) {
  return adminPlannerRoute(request, { action: 'audit:read', session: true }, async (repository) => {
    const params = Object.fromEntries(
      [...new URL(request.url).searchParams.entries()].filter(([, value]) => value !== ''),
    );
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      throw new ContentError(
        'validation_failed',
        'invalid audit filters',
        parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      );
    }
    const { cursor, from, to, ...rest } = parsed.data;
    const decoded = cursor ? decodeAuditCursor(cursor) : null;
    if (cursor && !decoded) {
      throw new ContentError('validation_failed', 'invalid cursor', [{ path: 'cursor', message: 'not a cursor from this API' }]);
    }
    const lower = bound(from, false);
    const upper = bound(to, true);
    if (lower && upper && lower > upper) {
      throw new ContentError('validation_failed', 'from is after to', [{ path: 'from', message: 'must not be after to' }]);
    }
    const page = await repository.listAuditEvents({ ...rest, from: lower, to: upper, cursor: decoded });
    return jsonOk({ items: page.items, count: page.items.length, nextCursor: page.nextCursor });
  });
}
