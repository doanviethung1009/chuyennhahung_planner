import { z } from 'zod';
import type { PublicPlannerUser } from '@/server/planner/schemas';

/**
 * Keyset paging over the user list (P07-12). The repository already returns
 * every account; this slices that list without touching it, so a caller that
 * passes no query gets exactly what it always got.
 *
 * A cursor names the last row of the previous page (sort key + id), not an
 * offset: a user created meanwhile lands before or after it by the same
 * ordering, and no row is repeated or skipped.
 */
export const USER_PAGE_DEFAULT_LIMIT = 50;
export const USER_PAGE_MAX_LIMIT = 200;

export const USER_SORTS = ['handle', 'created', '-created'] as const;
export type UserSort = (typeof USER_SORTS)[number];

const cursorSchema = z.object({
  s: z.enum(USER_SORTS),
  k: z.string().max(300),
  i: z.string().max(100),
});
type Cursor = z.infer<typeof cursorSchema>;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).optional(),
  cursor: z.string().min(1).max(1024).optional(),
  sort: z.enum(USER_SORTS).optional(),
});

export interface UserPageQuery {
  limit: number;
  cursor: Cursor | null;
  sort: UserSort;
}

/** `null` when the caller sent none of the paging parameters (legacy, unpaged). */
export function parseUserPageQuery(url: URL): UserPageQuery | null {
  const params = url.searchParams;
  if (!params.has('limit') && !params.has('cursor') && !params.has('sort')) return null;
  const parsed = querySchema.parse({
    limit: params.get('limit') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
    sort: params.get('sort') ?? undefined,
  });
  const sort = parsed.sort ?? 'handle';
  const cursor = parsed.cursor ? decodeCursor(parsed.cursor, sort) : null;
  return { limit: Math.min(parsed.limit ?? USER_PAGE_DEFAULT_LIMIT, USER_PAGE_MAX_LIMIT), cursor, sort };
}

function decodeCursor(raw: string, sort: UserSort): Cursor {
  // Any malformation, and a cursor issued for another ordering, is a ZodError (422).
  const bad = () =>
    new z.ZodError([{ code: 'custom', path: ['cursor'], message: 'invalid cursor' }]);
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw bad();
  }
  const result = cursorSchema.safeParse(value);
  if (!result.success || result.data.s !== sort) throw bad();
  return result.data;
}

function encodeCursor(sort: UserSort, user: PublicPlannerUser): string {
  const k = sort === 'handle' ? user.handle : user.createdAt;
  return Buffer.from(JSON.stringify({ s: sort, k, i: user.id } satisfies Cursor)).toString('base64url');
}

function compare(sort: UserSort, a: { k: string; i: string }, b: { k: string; i: string }): number {
  const byKey = sort === 'handle' ? a.k.localeCompare(b.k) : a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  const ordered = byKey !== 0 ? byKey : a.i < b.i ? -1 : a.i > b.i ? 1 : 0;
  return sort === '-created' ? -ordered : ordered;
}

const keyOf = (sort: UserSort, user: PublicPlannerUser) => ({
  k: sort === 'handle' ? user.handle : user.createdAt,
  i: user.id,
});

export function pageUsers(users: readonly PublicPlannerUser[], query: UserPageQuery) {
  const { sort, cursor, limit } = query;
  const ordered = [...users].sort((a, b) => compare(sort, keyOf(sort, a), keyOf(sort, b)));
  const after = cursor ? ordered.filter((user) => compare(sort, keyOf(sort, user), cursor) > 0) : ordered;
  const page = after.slice(0, limit);
  const last = page[page.length - 1];
  return {
    users: page,
    total: users.length,
    nextCursor: after.length > limit && last ? encodeCursor(sort, last) : null,
  };
}
