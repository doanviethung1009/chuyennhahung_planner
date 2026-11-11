import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/server/content/errors';
import {
  exportPlannerDocument,
  importPlannerDocument,
  integrityIssues,
  parsePlannerDocument,
} from '../src/server/persistence/planner-transfer';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { FROZEN_NOW, fakeCatalog, makePlanner } from './planner-helpers';
import { runScenario } from './planner-pg-fixtures';

const options = { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) };

async function sourceDocument() {
  const store = createMemoryPlannerStore();
  await runScenario(makePlanner({ store }));
  return store.read();
}

describe('planner import', () => {
  it('imports a valid document into an empty store, and export reproduces it exactly', async () => {
    const document = await sourceDocument();
    const target = createMemoryPlannerStore();
    const summary = await importPlannerDocument(target, JSON.parse(JSON.stringify(document)), options);

    expect(summary.collections.trips).toBe(document.trips.length);
    expect(summary.rows).toBeGreaterThan(10);
    const exported = await exportPlannerDocument(target);
    expect(JSON.parse(exported)).toEqual(document);
  });

  it('refuses a store that already holds rows, and leaves it untouched', async () => {
    const document = await sourceDocument();
    const target = createMemoryPlannerStore(structuredClone(document));
    const error = await importPlannerDocument(target, document, options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).code).toBe('invalid_state');
    expect(await target.read()).toEqual(document);
  });

  it('refuses a file that fails the schema, naming paths not values', async () => {
    const document = await sourceDocument();
    const broken = JSON.parse(JSON.stringify(document));
    broken.trips[0].note = 'x'.repeat(5_000);
    broken.trips[0].partySize = 0;
    const target = createMemoryPlannerStore();
    const error = (await importPlannerDocument(target, broken, options).catch((e: unknown) => e)) as ContentError;
    expect(error.code).toBe('validation_failed');
    expect(error.issues.some((issue) => issue.path.startsWith('trips.0'))).toBe(true);
    expect(JSON.stringify(error.issues)).not.toContain('xxxxx');
    expect((await target.read()).trips).toEqual([]);
  });

  it('refuses unknown top-level collections and non-objects', () => {
    expect(() => parsePlannerDocument({ users: [], surprise: [] })).toThrow(ContentError);
    expect(() => parsePlannerDocument('nope')).toThrow(ContentError);
  });

  it('refuses a file with a dangling reference before writing anything', async () => {
    const document = await sourceDocument();
    const broken = structuredClone(document);
    broken.tripActivities[0]!.dayId = 'day_missing';
    expect((await integrityIssues(broken, options)).length).toBeGreaterThan(0);

    const target = createMemoryPlannerStore();
    const error = (await importPlannerDocument(target, broken, options).catch((e: unknown) => e)) as ContentError;
    expect(error.code).toBe('validation_failed');
    expect(error.message).toContain('integrity');
    expect((await target.read()).tripActivities).toEqual([]);
  });

  it('leaves expired sessions and sign-in attempts behind, and says so', async () => {
    const document = await sourceDocument();
    const later = { ...options, now: () => new Date('2027-01-01T00:00:00Z') };
    const target = createMemoryPlannerStore();
    const summary = await importPlannerDocument(target, document, later);
    expect(summary.droppedExpired).toBe(document.sessions.length + document.oauthAttempts.length);
    const stored = await target.read();
    expect(stored.sessions).toEqual([]);
    expect(stored.trips).toEqual(document.trips);
  });

  it('accepts a partial file, as the JSON store does', async () => {
    const summary = await importPlannerDocument(createMemoryPlannerStore(), {}, options);
    expect(summary.rows).toBe(0);
  });
});
