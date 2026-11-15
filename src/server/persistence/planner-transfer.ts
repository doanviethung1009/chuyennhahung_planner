import { z } from 'zod';
import { ContentError } from '@/server/content/errors';
import { PlannerRepository } from '@/server/planner/repository';
import {
  communityReviewSchema,
  oauthAttemptSchema,
  plannerSessionSchema,
  plannerUserSchema,
  tripActivitySchema,
  tripDaySchema,
  tripExpenseSchema,
  tripSchema,
} from '@/server/planner/schemas';
import {
  createMemoryPlannerStore,
  emptyPlannerData,
  type PlannerData,
  type PlannerStore,
} from '@/server/planner/store';
import type { PlannerCatalog } from '@/server/planner/catalog';

/**
 * Moving the Planner document in and out of a store (ADR 0009 §6). Import is
 * how an existing `planner.json` reaches Postgres; export writes the database
 * back out as a file the JSON store can open — the rollback path and a
 * human-readable backup.
 */

const documentSchema = z
  .object({
    users: z.array(plannerUserSchema).default([]),
    sessions: z.array(plannerSessionSchema).default([]),
    oauthAttempts: z.array(oauthAttemptSchema).default([]),
    trips: z.array(tripSchema).default([]),
    tripDays: z.array(tripDaySchema).default([]),
    tripActivities: z.array(tripActivitySchema).default([]),
    tripExpenses: z.array(tripExpenseSchema).default([]),
    communityReviews: z.array(communityReviewSchema).default([]),
  })
  .strict();

/** Validates a parsed JSON document with the same schemas the repository uses. */
export function parsePlannerDocument(raw: unknown): PlannerData {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    // Paths only — a failing value may be a traveller's private note.
    throw new ContentError(
      'validation_failed',
      'the file is not a valid Planner document',
      parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return parsed.data as PlannerData;
}

export interface TransferOptions {
  /**
   * What the integrity check resolves destinations and places against — the
   * real content catalog in the import script, a fixture in tests.
   */
  catalog: PlannerCatalog;
  /** Injectable clock; defaults to the real one. */
  now?: () => Date;
}

/** Runs the repository's own integrity check over a document, offline. */
export async function integrityIssues(data: PlannerData, options: TransferOptions) {
  const repository = new PlannerRepository({
    store: createMemoryPlannerStore(data),
    catalog: options.catalog,
    ...(options.now ? { now: options.now } : {}),
  });
  return repository.validateIntegrity();
}

export function countRows(data: PlannerData): number {
  return Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
}

export interface ImportSummary {
  rows: number;
  /** Expired sessions and sign-in attempts left behind, not imported. */
  droppedExpired: number;
  collections: Record<keyof PlannerData, number>;
}

/**
 * Validates, integrity-checks, then inserts everything in one transaction.
 * Refuses a store that already holds any row — an import is a one-time move,
 * never a merge. Nothing is written unless every check passes. Sessions and
 * Google attempts that have already expired are dead rows (the repository
 * sweeps them anyway), so they are left behind rather than imported.
 */
export async function importPlannerDocument(
  store: PlannerStore,
  raw: unknown,
  options: TransferOptions,
): Promise<ImportSummary> {
  const incoming = parsePlannerDocument(raw);
  const now = (options.now ?? (() => new Date()))().getTime();
  const before = incoming.sessions.length + incoming.oauthAttempts.length;
  incoming.sessions = incoming.sessions.filter((row) => Date.parse(row.expiresAt) > now);
  incoming.oauthAttempts = incoming.oauthAttempts.filter((row) => Date.parse(row.expiresAt) > now);
  const droppedExpired = before - incoming.sessions.length - incoming.oauthAttempts.length;

  const issues = await integrityIssues(incoming, options);
  if (issues.length > 0) {
    throw new ContentError(
      'validation_failed',
      `the file fails the integrity check (${issues.length} issue(s))`,
      issues.slice(0, 20).map((issue) => ({
        path: `${issue.entity}/${issue.id}`,
        message: issue.issue,
      })),
    );
  }

  await store.transact((data) => {
    if (countRows(data) > 0) {
      throw new ContentError(
        'invalid_state',
        'the Planner tables are not empty — an import never merges into existing data',
      );
    }
    Object.assign(data, structuredClone(incoming));
  });

  return {
    rows: countRows(incoming),
    droppedExpired,
    collections: {
      users: incoming.users.length,
      sessions: incoming.sessions.length,
      oauthAttempts: incoming.oauthAttempts.length,
      trips: incoming.trips.length,
      tripDays: incoming.tripDays.length,
      tripActivities: incoming.tripActivities.length,
      tripExpenses: incoming.tripExpenses.length,
      communityReviews: incoming.communityReviews.length,
    },
  };
}

/** The document as the JSON store writes it, ready for a file. */
export async function exportPlannerDocument(store: PlannerStore): Promise<string> {
  const data = await store.read();
  return `${JSON.stringify({ ...emptyPlannerData(), ...data }, null, 2)}\n`;
}
