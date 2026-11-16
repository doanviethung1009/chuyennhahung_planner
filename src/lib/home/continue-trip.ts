/**
 * Which trip the home page offers to continue (docs/specs-home-mvp.md).
 *
 * Pure on purpose: no store, no clock, no request. The caller passes the
 * trips it already owns and today's date, so the rule is testable on its own.
 */

/** The only fields the picker reads. `Trip` satisfies it structurally. */
export interface PickableTrip {
  id: string;
  startDate: string | null;
  planningStatus: 'draft' | 'planned' | 'completed';
  updatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's calendar date in Vietnam (`YYYY-MM-DD`), whatever the server's zone. */
export function vietnamToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole calendar days from `today` to `date`; negative when `date` is past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

const byUpdatedThenId = (a: PickableTrip, b: PickableTrip): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

/**
 * The trip to continue, or `null` when none is unfinished. A finished
 * (`completed`) trip is never chosen. Preference, in order:
 *
 * 1. the earliest start date on or after today;
 * 2. the most recently updated trip with no date;
 * 3. the most recently updated trip whose dates are all in the past.
 *
 * Ties break on `updatedAt` (newest) and then `id`, so the answer is stable.
 */
export function pickContinueTrip<T extends PickableTrip>(
  trips: readonly T[],
  today: string,
): T | null {
  const open = trips.filter((trip) => trip.planningStatus !== 'completed');

  const upcoming = open
    .filter((trip) => trip.startDate !== null && trip.startDate >= today)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!) || byUpdatedThenId(a, b));
  if (upcoming[0]) return upcoming[0];

  const undated = open.filter((trip) => trip.startDate === null).sort(byUpdatedThenId);
  if (undated[0]) return undated[0];

  return [...open].sort(byUpdatedThenId)[0] ?? null;
}
