/**
 * The two lists of the member trips section (`/my-trips?tab=trips`): current and
 * archived. The view is a `?view=` query read on the server — a link, like the
 * member home tabs (ADR 0032) — so Back, F5 and deep links keep it. Anything else
 * (missing, unknown) is the default; a repeated parameter uses its first value.
 */
export const TRIPS_VIEWS = ['active', 'archived'] as const;
export type TripsView = (typeof TRIPS_VIEWS)[number];
export const DEFAULT_TRIPS_VIEW: TripsView = 'active';

export function parseTripsView(raw: string | string[] | undefined): TripsView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TRIPS_VIEWS.find((view) => view === value) ?? DEFAULT_TRIPS_VIEW;
}
