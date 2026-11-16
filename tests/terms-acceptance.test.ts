import { describe, expect, it } from 'vitest';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { exportPlannerDocument, importPlannerDocument } from '../src/server/persistence/planner-transfer';
import { fakeCatalog, FROZEN_NOW, makePlanner } from './planner-helpers';
import { registerTermsCases } from './terms-acceptance-cases';

describe('creator terms on the JSON/memory store (ADR 0019 §4)', () => {
  // A fresh store per case; a "bumped" repository is built on the same store by passing the first context.
  registerTermsCases(async (termsVersion, same) => {
    const store = same?.store ?? createMemoryPlannerStore();
    return { planner: makePlanner({ store, termsVersion }), store };
  });

  it('round-trips termsAcceptances through export and import, and reads a file without the key', async () => {
    const source = createMemoryPlannerStore();
    const planner = makePlanner({ store: source, termsVersion: 'v1' });
    const issued = await planner.createUser({ handle: 'terms-x', displayName: 'Người dùng', role: 'member' });
    await planner.acceptTerms(issued.user.id, 'v1', 'en');
    const exported = JSON.parse(await exportPlannerDocument(source));
    const options = { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) };
    const target = createMemoryPlannerStore();
    const summary = await importPlannerDocument(target, exported, options);
    expect(summary.collections.termsAcceptances).toBe(1);
    expect((await target.read()).termsAcceptances[0]).toMatchObject({ version: 'v1', lang: 'en' });

    const old = { ...exported } as Record<string, unknown>;
    delete old.termsAcceptances;
    const legacy = createMemoryPlannerStore();
    await importPlannerDocument(legacy, old, options);
    expect((await legacy.read()).termsAcceptances).toEqual([]);
  });
});
