import { ACTIVITIES_PER_DAY_LIMIT } from '@/components/planner/trip-editor/shared';

/** The few trip fields the picker needs. */
export interface TripChoice {
  id: string;
  title: string;
  destinationSlug: string;
  startDate: string | null;
  durationDays: number;
  status: string;
}

/** The slice of `GET /api/planner/[id]` the picker reads. */
export interface TripSnapshot {
  days: Array<{ dayNumber: number; activities: Array<{ placeSlug: string | null }> }>;
}

export interface AddablePlace {
  slug: string;
  destinationSlug: string;
  suggestedMinutes: number;
  estimatedCostVnd: number;
}

/** Active trips of the place's destination — the server refuses any other. */
export function tripsForPlace(trips: TripChoice[], destinationSlug: string): TripChoice[] {
  return trips.filter((trip) => trip.status === 'active' && trip.destinationSlug === destinationSlug);
}

export interface DayState {
  dayNumber: number;
  full: boolean;
  hasPlace: boolean;
}

/** Per-day state for a chosen trip: how full each day is and whether it already has the place. */
export function dayStates(trip: TripChoice, snapshot: TripSnapshot | null, placeSlug: string): DayState[] {
  return Array.from({ length: trip.durationDays }, (_, index) => {
    const dayNumber = index + 1;
    const day = snapshot?.days.find((row) => row.dayNumber === dayNumber);
    const activities = day?.activities ?? [];
    return {
      dayNumber,
      full: activities.length >= ACTIVITIES_PER_DAY_LIMIT,
      hasPlace: activities.some((activity) => activity.placeSlug === placeSlug),
    };
  });
}

/** Request body for `POST /api/planner/[id]/activities`; the server infers title and category. */
export function activityBody(place: AddablePlace, dayNumber: number) {
  return {
    placeSlug: place.slug,
    dayNumber,
    durationMinutes: Math.min(24 * 60, Math.max(5, Math.round(place.suggestedMinutes))),
    estimatedCostVnd: Math.max(0, Math.round(place.estimatedCostVnd)),
    costScope: 'group' as const,
    startTime: null,
  };
}
