import {
  createJsonDocumentStore,
  createMemoryDocumentStore,
  type DocumentStore,
} from '@/server/persistence/json-store';
import type {
  PlannerUser,
  Trip,
  TripActivity,
  TripDay,
  TripExpense,
} from './schemas';

/**
 * The Planner document. The four trip collections are kept **normalised** —
 * flat arrays with foreign keys, not days nested inside trips — because they
 * are the four tables this will become (`trips`, `trip_days`,
 * `trip_activities`, `trip_expenses`) and because moving an activity between
 * days and attaching an expense to an activity are both cheap on a flat shape
 * and awkward on a nested one. See `docs/adr/0002-planner-core.md` §1.
 *
 * It is a *separate* document from the content store: traveller data and
 * editorial content have different privacy, backup and retention profiles.
 */
export interface PlannerData {
  users: PlannerUser[];
  trips: Trip[];
  tripDays: TripDay[];
  tripActivities: TripActivity[];
  tripExpenses: TripExpense[];
}

export type PlannerStore = DocumentStore<PlannerData>;

export function emptyPlannerData(): PlannerData {
  return { users: [], trips: [], tripDays: [], tripActivities: [], tripExpenses: [] };
}

/** Fills in any collection a partial or hand-edited file is missing. */
function normalize(partial: Partial<PlannerData>): PlannerData {
  return {
    users: partial.users ?? [],
    trips: partial.trips ?? [],
    tripDays: partial.tripDays ?? [],
    tripActivities: partial.tripActivities ?? [],
    tripExpenses: partial.tripExpenses ?? [],
  };
}

export function createMemoryPlannerStore(
  initial: PlannerData = emptyPlannerData(),
): PlannerStore {
  return createMemoryDocumentStore(initial);
}

export function createJsonPlannerStore(filePath: string): PlannerStore {
  return createJsonDocumentStore(filePath, normalize);
}
