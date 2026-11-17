import { describe, expect, it } from 'vitest';
import { createReportSchema, resolveReportSchema } from '../src/server/planner/schemas';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { exportPlannerDocument, importPlannerDocument } from '../src/server/persistence/planner-transfer';
import { fakeCatalog, FROZEN_NOW, makePlanner } from './planner-helpers';
import { registerReportCases } from './community-reports-cases';

describe('community reports on the memory store (batch 10.5)', () => {
  registerReportCases(async () => {
    const store = createMemoryPlannerStore();
    return { planner: makePlanner({ store }), store };
  });

  it('round-trips reports through export and import, and reads a file without the key', async () => {
    const source = createMemoryPlannerStore();
    await source.transact((data) => {
      data.reports.push({ id: 'rpt_1', reporterId: null, clientKey: 'a'.repeat(32), targetKind: 'review', targetId: 'rev_1', reason: 'spam', note: null, status: 'open', createdAt: FROZEN_NOW, handledAt: null, handledBy: null, handlerReason: null });
    });
    const exported = JSON.parse(await exportPlannerDocument(source));
    const options = { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) };
    const target = createMemoryPlannerStore();
    expect((await importPlannerDocument(target, exported, options)).collections.reports).toBe(1);
    expect((await target.read()).reports[0]).toMatchObject({ id: 'rpt_1', reason: 'spam' });
    const old = { ...exported } as Record<string, unknown>;
    delete old.reports;
    const legacy = createMemoryPlannerStore();
    await importPlannerDocument(legacy, old, options);
    expect((await legacy.read()).reports).toEqual([]);
  });

  it('validates the bodies strictly', () => {
    const token = 'A'.repeat(43);
    expect(createReportSchema.safeParse({ targetKind: 'trip', shareToken: token, reason: 'spam' }).success).toBe(true);
    expect(createReportSchema.safeParse({ targetKind: 'review', targetId: 'rev_1', reason: 'other', note: 'x'.repeat(500) }).success).toBe(true);
    expect(createReportSchema.safeParse({ targetKind: 'review', targetId: 'rev_1', reason: 'other', note: 'x'.repeat(501) }).success).toBe(false);
    expect(createReportSchema.safeParse({ targetKind: 'trip', targetId: 'trip_1', reason: 'spam' }).success).toBe(false);
    expect(createReportSchema.safeParse({ targetKind: 'review', targetId: 'rev_1', reason: 'rude' }).success).toBe(false);
    expect(createReportSchema.safeParse({ targetKind: 'review', targetId: 'rev_1', reason: 'spam', userId: 'x' }).success).toBe(false);
    expect(createReportSchema.safeParse({ targetKind: 'comment', targetId: 'c_1', reason: 'spam' }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ outcome: 'actioned', reason: 'ok!' }).success).toBe(true);
    expect(resolveReportSchema.safeParse({ outcome: 'removed', reason: 'ok!' }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ outcome: 'dismissed', reason: 'a' }).success).toBe(false);
  });
});
