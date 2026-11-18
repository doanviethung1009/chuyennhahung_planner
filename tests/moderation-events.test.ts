import { describe, expect, it } from 'vitest';
import { AUDIT_RETENTION_DAYS, appendEvent } from '../src/server/community/events';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { exportPlannerDocument, importPlannerDocument } from '../src/server/persistence/planner-transfer';
import { fakeCatalog, FROZEN_NOW, makePlanner } from './planner-helpers';
import { registerEventCases } from './moderation-events-cases';

describe('moderation events on the JSON/memory store (ADR 0019 §2)', () => {
  registerEventCases(async () => {
    const store = createMemoryPlannerStore();
    return { planner: makePlanner({ store }), store };
  });
});

describe('retention and transfer', () => {
  it('sweeps events older than a year as new ones are appended', () => {
    const at = '2027-03-01T00:00:00.000Z';
    const old = new Date(Date.parse(at) - (AUDIT_RETENTION_DAYS + 1) * 86_400_000).toISOString();
    const recent = new Date(Date.parse(at) - (AUDIT_RETENTION_DAYS - 1) * 86_400_000).toISOString();
    const base = { targetKind: 'trip' as const, targetId: 't', actorId: 'a', actorKind: 'user' as const, action: 'x', fromStatus: null, toStatus: null, reason: null };
    const data = { auditEvents: [{ ...base, id: 'e1', createdAt: old }, { ...base, id: 'e2', createdAt: recent }] };
    appendEvent(data, { ...base }, { id: 'e3', at });
    expect(data.auditEvents.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('caps reason at 500 characters and actor at 80', () => {
    const data = { auditEvents: [] as import('../src/server/planner/schemas').AuditEvent[] };
    appendEvent(data, { targetKind: 'trip', targetId: 't', actorId: 'a'.repeat(200), action: 'x', fromStatus: null, toStatus: null, reason: 'r'.repeat(900) }, { id: 'e', at: FROZEN_NOW });
    expect(data.auditEvents[0]!.reason).toHaveLength(500);
    expect(data.auditEvents[0]!.actorId).toHaveLength(80);
  });

  it('round-trips auditEvents through export and import, and reads a file without the key', async () => {
    const source = createMemoryPlannerStore();
    const planner = makePlanner({ store: source });
    const { makeOwner, daLatTripInput } = await import('./planner-helpers');
    const { userId } = await makeOwner(planner);
    const view = await planner.createTrip(userId, daLatTripInput());
    await planner.setVisibility(userId, view.trip.id, 'public');
    await planner.requestListing(userId, view.trip.id, 'name');
    const exported = JSON.parse(await exportPlannerDocument(source));
    expect(exported.auditEvents).toHaveLength(2); // owner provisioned (P07-13) + the listing request

    const options = { catalog: fakeCatalog(), now: () => new Date(FROZEN_NOW) };
    const target = createMemoryPlannerStore();
    const report = await importPlannerDocument(target, exported, options);
    expect(report.collections.auditEvents).toBe(2);
    expect((await target.read()).auditEvents).toEqual(exported.auditEvents);

    const older = { ...exported } as Record<string, unknown>;
    delete older.auditEvents;
    const legacy = createMemoryPlannerStore();
    await importPlannerDocument(legacy, older, options);
    expect((await legacy.read()).auditEvents).toEqual([]);
  });
});
