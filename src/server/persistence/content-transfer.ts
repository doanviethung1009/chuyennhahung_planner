import { z } from 'zod';
import { ContentError } from '@/server/content/errors';
import { TravelContentRepository } from '@/server/content/repository';
import {
  collectionSchema,
  placeSchema,
  reviewSchema,
  storySchema,
  templateSchema,
} from '@/server/content/schemas';
import {
  createMemoryStore,
  emptyContentData,
  type ContentData,
  type ContentStore,
} from '@/server/content/store';

/**
 * Moving Travel Content in and out of a store (ADR 0013 §7), the counterpart of
 * `planner-transfer.ts`. Import is how an existing `travel-content.json`
 * reaches PostgreSQL; export writes the database back out as a file the JSON
 * store can open — the rollback path and a human-readable backup.
 */

const documentSchema = z
  .object({
    places: z.array(placeSchema).default([]),
    stories: z.array(storySchema).default([]),
    collections: z.array(collectionSchema).default([]),
    reviews: z.array(reviewSchema).default([]),
    templates: z.array(templateSchema).default([]),
  })
  .strict();

/** Validates a parsed JSON document with the same schemas the repository uses. */
export function parseContentDocument(raw: unknown): ContentData {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    // Paths only: the message of a failing value can quote editorial text.
    throw new ContentError(
      'validation_failed',
      'the file is not a valid Travel Content document',
      parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return parsed.data as ContentData;
}

export function countRows(data: ContentData): number {
  return Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
}

export interface ImportSummary {
  rows: number;
  collections: Record<keyof ContentData, number>;
}

/**
 * Validates, integrity-checks, then inserts everything in one transaction.
 * Refuses a store that already holds any row — an import is a one-time move,
 * never a merge. Nothing is written unless every check passes.
 */
export async function importContentDocument(
  store: ContentStore,
  raw: unknown,
): Promise<ImportSummary> {
  const incoming = parseContentDocument(raw);

  const issues = await new TravelContentRepository({
    store: createMemoryStore(structuredClone(incoming)),
  }).validateIntegrity();
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
        'the Travel Content tables are not empty — an import never merges into existing data',
      );
    }
    Object.assign(data, structuredClone(incoming));
  });

  return {
    rows: countRows(incoming),
    collections: {
      places: incoming.places.length,
      stories: incoming.stories.length,
      collections: incoming.collections.length,
      reviews: incoming.reviews.length,
      templates: incoming.templates.length,
    },
  };
}

/** The document as the JSON store writes it, ready for a file. */
export async function exportContentDocument(store: ContentStore): Promise<string> {
  const data = await store.read();
  return `${JSON.stringify({ ...emptyContentData(), ...data }, null, 2)}\n`;
}
