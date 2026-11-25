/**
 * The search, status filter and sort of the member trips list (`/my-trips?tab=trips`)
 * live in the query string — `?q=`, `?status=`, `?sort=` — so F5, Back and a shared
 * link keep them. They are read on the server and kept in sync from the client with
 * `history.replaceState` (no navigation, no refetch). Anything unknown falls back to
 * the default, a repeated parameter uses its first value, and `q` is trimmed and cut
 * to {@link TRIPS_Q_MAX}; the raw value is only ever compared and rendered through React.
 */
export const TRIPS_STATUS_FILTERS = ['draft', 'planned', 'completed'] as const;
export type TripsStatusFilter = 'all' | (typeof TRIPS_STATUS_FILTERS)[number];
export const TRIPS_SORTS = ['updated', 'start', 'title'] as const;
export type TripsSort = (typeof TRIPS_SORTS)[number];
export const TRIPS_Q_MAX = 80;

export interface TripsFilter {
  q: string;
  status: TripsStatusFilter;
  sort: TripsSort;
}

export const DEFAULT_TRIPS_FILTER: TripsFilter = { q: '', status: 'all', sort: 'updated' };

type Raw = string | string[] | undefined;
const first = (value: Raw): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

export function parseTripsFilter(raw: { q?: Raw; status?: Raw; sort?: Raw }): TripsFilter {
  const status = first(raw.status);
  const sort = first(raw.sort);
  return {
    q: first(raw.q).trim().slice(0, TRIPS_Q_MAX).trim(),
    status: (TRIPS_STATUS_FILTERS as readonly string[]).includes(status) ? (status as TripsStatusFilter) : 'all',
    sort: (TRIPS_SORTS as readonly string[]).includes(sort) ? (sort as TripsSort) : 'updated',
  };
}

/**
 * `search` (with or without the leading `?`) with the filter applied: the three
 * filter keys are replaced — and left out when at their default so URLs stay clean —
 * and every other key (`tab`, `view`) is kept as it is.
 */
export function withTripsFilter(search: string, filter: TripsFilter): string {
  const params = new URLSearchParams(search);
  params.delete('q');
  params.delete('status');
  params.delete('sort');
  const q = filter.q.trim().slice(0, TRIPS_Q_MAX);
  if (q) params.set('q', q);
  if (filter.status !== 'all') params.set('status', filter.status);
  if (filter.sort !== 'updated') params.set('sort', filter.sort);
  const out = params.toString();
  return out ? `?${out}` : '';
}
