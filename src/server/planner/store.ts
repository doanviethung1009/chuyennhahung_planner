import {
  createJsonDocumentStore,
  createMemoryDocumentStore,
  type DocumentStore,
} from '@/server/persistence/json-store';
import type { SharedMapSource } from './member-map-share';
import type {
  OAuthAttempt,
  PlannerSession,
  PlannerUser,
  Trip,
  TripActivity,
  TripDay,
  TripExpense,
  CommunityReview,
  ReviewRestriction,
  AuditEvent,
  TermsAcceptance,
  MemberMapShare,
  Report,
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
  /** ADR 0015. Absent in older files; reads as empty. */
  reviewRestrictions: ReviewRestriction[];
  /** ADR 0019. Append-only community log; absent in older files, reads as empty. */
  auditEvents: AuditEvent[];
  /** ADR 0019 §4. Absent in older files; reads as empty. */
  termsAcceptances: TermsAcceptance[];
  /** ADR 0019, batch 10.5. Absent in older files; reads as empty. */
  reports: Report[];
  /** ADR 0030. Absent in older files; reads as empty (nobody shares). */
  memberMapShares: MemberMapShare[];
}

export type PlannerStore = DocumentStore<PlannerData> & {
  /**
   * Indexed lookup for the public shared map (ADR 0030, hardening M1): the share
   * whose digest matches, its owner and the owner's completed trips, read fresh,
   * or null. Optional: a store without it is served through `view`, then `read`.
   */
  readSharedMapSource?(digest: string): Promise<SharedMapSource | null>;
};

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
    reviewRestrictions: [],
    auditEvents: [],
    termsAcceptances: [],
    reports: [],
    memberMapShares: [],
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
    reviewRestrictions: partial.reviewRestrictions ?? [],
    auditEvents: partial.auditEvents ?? [],
    termsAcceptances: partial.termsAcceptances ?? [],
    reports: partial.reports ?? [],
    memberMapShares: partial.memberMapShares ?? [],
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
