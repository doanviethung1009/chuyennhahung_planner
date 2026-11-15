import {
  createJsonDocumentStore,
  createMemoryDocumentStore,
  type DocumentStore,
} from '@/server/persistence/json-store';
import type {
  OAuthAttempt,
  PlannerSession,
  PlannerUser,
  Trip,
  TripActivity,
  TripDay,
  TripExpense,
  CommunityReview,
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
  /**
   * Browser sessions (ADR 0004). Separate from `users` because a session is
   * revocable, expiring state while a user is not, and because sweeping expired
   * rows must never touch the user record.
   */
  sessions: PlannerSession[];
  /** In-flight Google sign-ins (ADR 0007): ten-minute, one-use rows. */
  oauthAttempts: OAuthAttempt[];
  trips: Trip[];
  tripDays: TripDay[];
  tripActivities: TripActivity[];
  tripExpenses: TripExpense[];
  /** ADR 0014, PR 2. Absent in older files; reads as empty. */
  communityReviews: CommunityReview[];
}

export type PlannerStore = DocumentStore<PlannerData>;

export function emptyPlannerData(): PlannerData {
  return {
    users: [],
    sessions: [],
    oauthAttempts: [],
    trips: [],
    tripDays: [],
    tripActivities: [],
    tripExpenses: [],
    communityReviews: [],
  };
}

/** Fills in any collection a partial or hand-edited file is missing. */
function normalize(partial: Partial<PlannerData>): PlannerData {
  return {
    users: partial.users ?? [],
    sessions: partial.sessions ?? [],
    oauthAttempts: partial.oauthAttempts ?? [],
    trips: partial.trips ?? [],
    tripDays: partial.tripDays ?? [],
    tripActivities: partial.tripActivities ?? [],
    tripExpenses: partial.tripExpenses ?? [],
    communityReviews: partial.communityReviews ?? [],
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
