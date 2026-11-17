import { describe, expect, it } from 'vitest';
import {
  fromRow,
  planStatements,
  rowsToData,
  TABLES,
  toRow,
} from '../src/server/persistence/planner-rows';
import { createMemoryPlannerStore, emptyPlannerData } from '../src/server/planner/store';
import type { PlannerData } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';
import { runScenario } from './planner-pg-fixtures';

async function scenarioData(): Promise<PlannerData> {
  const store = createMemoryPlannerStore();
  await runScenario(makePlanner({ store }));
  return store.read();
}

const spec = (table: string) => TABLES.find((candidate) => candidate.table === table)!;

/** What the driver would hand back for a stored row. */
function driverRows(data: PlannerData): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    out[table.table] = (data[table.collection] as Record<string, unknown>[]).map((record) => {
      const row = toRow(table, record);
      for (const column of table.columns) {
        const value = row[column.column];
        if (value === null) continue;
        // timestamptz arrives as a Date, BIGINT as a string, JSONB parsed.
        if (column.type === 'timestamptz') row[column.column] = new Date(value as string);
        if (column.type === 'bigint') row[column.column] = String(value);
        if (column.type === 'jsonb') row[column.column] = JSON.parse(value as string);
      }
      return row;
    });
  }
  return out;
}

describe('row mapping', () => {
  it('round-trips every collection exactly as the JSON store would return it', async () => {
    const data = await scenarioData();
    for (const table of TABLES) {
      expect(data[table.collection].length, table.table).toBeGreaterThan(0);
    }
    expect(rowsToData(driverRows(data))).toEqual(data);
  });

  it('round-trips a user role (ADR 0006), so promoting an admin survives the database', async () => {
    const data = await scenarioData();
    data.users[0] = { ...data.users[0]!, role: 'admin' };
    expect(rowsToData(driverRows(data)).users[0]!.role).toBe('admin');
  });

  it('keeps an optional field absent, and a nullable one null, on read-back', () => {
    const user = spec('planner_users');
    const row = {
      id: 'usr_1',
      handle: 'hung-tran',
      display_name: 'Hưng Trần',
      token_hash: 'a'.repeat(64),
      created_at: new Date('2026-03-01T08:00:00.000Z'),
      updated_at: new Date('2026-03-01T08:00:00.000Z'),
      email: null,
      password_hash: null,
      must_change_password: null,
      google_sub: null,
      created_via: null,
      role: null,
    };
    const record = fromRow(user, row);
    for (const key of ['email', 'passwordHash', 'mustChangePassword', 'googleSub', 'createdVia', 'role']) {
      expect(key in record, key).toBe(false);
    }

    const day = fromRow(spec('trip_days'), {
      id: 'day_1',
      trip_id: 'trip_1',
      day_number: 1,
      date: null,
      title: null,
      note: null,
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-01T08:00:00.000Z',
    });
    expect(day).toMatchObject({ date: null, title: null, note: null });
  });

  it('keeps an explicit false distinct from absent', () => {
    const user = spec('planner_users');
    const base = {
      id: 'usr_1',
      handle: 'hung-tran',
      display_name: 'Hưng Trần',
      token_hash: 'a'.repeat(64),
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-01T08:00:00.000Z',
    };
    expect(fromRow(user, { ...base, must_change_password: false })).toMatchObject({
      mustChangePassword: false,
    });
  });

  it('converts BIGINT strings through the money boundary and refuses an unsafe one', () => {
    const expense = spec('trip_expenses');
    const row = {
      id: 'exp_1',
      trip_id: 'trip_1',
      day_id: null,
      activity_id: null,
      label: 'Vé máy bay',
      category: 'transport',
      amount_vnd: '1800000',
      cost_scope: 'group',
      paid_on: null,
      note: null,
      created_at: new Date('2026-03-01T08:00:00.000Z'),
      updated_at: new Date('2026-03-01T08:00:00.000Z'),
    };
    expect(fromRow(expense, row)).toMatchObject({ amountVnd: 1_800_000 });
    expect(() => fromRow(expense, { ...row, amount_vnd: '9007199254740993' })).toThrow();
  });

  it('writes timestamps as ISO strings, whatever spelling the record used', () => {
    const user = spec('planner_users');
    const row = toRow(user, {
      id: 'usr_1',
      handle: 'hung-tran',
      displayName: 'Hưng Trần',
      tokenHash: 'a'.repeat(64),
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-03-01T15:00:00+07:00',
    });
    expect(row.created_at).toBe('2026-03-01T08:00:00.000Z');
    expect(row.updated_at).toBe('2026-03-01T08:00:00.000Z');
  });

  it('reports a corrupt row by table and id, never by content', () => {
    const day = spec('trip_days');
    let message = '';
    try {
      fromRow(day, {
        id: 'day_9',
        trip_id: 'trip_1',
        day_number: 1,
        date: null,
        title: null,
        note: 'ghi chú riêng tư',
        created_at: null,
        updated_at: null,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('trip_days/day_9');
    expect(message).not.toContain('riêng tư');
  });
});

describe('diff', () => {
  it('issues zero statements for a no-op mutation', async () => {
    const before = await scenarioData();
    expect(planStatements(before, structuredClone(before))).toEqual([]);
  });

  it('does not treat a re-spelt timestamp or null-for-absent as a change', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    after.users[0]!.createdAt = after.users[0]!.createdAt.replace('.000Z', 'Z');
    after.users[0]!.email = null;
    expect(planStatements(before, after)).toEqual([]);
  });

  it('inserts a new row, with every value bound and none interpolated', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    const source = after.tripExpenses[0]!;
    after.tripExpenses.push({ ...source, id: "exp_x'; DROP TABLE trips;--", label: 'Bánh mì' });

    const statements = planStatements(before, after);
    expect(statements).toHaveLength(1);
    const [insert] = statements;
    expect(insert).toMatchObject({ kind: 'insert', table: 'trip_expenses' });
    expect(insert!.text).not.toContain('DROP TABLE');
    expect(insert!.text).toMatch(/VALUES \(\$1, \$2/);
    expect(insert!.values).toContain("exp_x'; DROP TABLE trips;--");
  });

  it('updates only the changed columns of only the changed row', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    after.trips[0]!.title = 'Đà Lạt đổi tên';
    after.trips[0]!.version += 1;

    const statements = planStatements(before, after);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatchObject({ kind: 'update', table: 'trips' });
    expect(statements[0]!.text).toBe(
      'UPDATE "trips" SET "title" = $2, "version" = $3 WHERE "id" = $1',
    );
    expect(statements[0]!.values).toEqual([after.trips[0]!.id, 'Đà Lạt đổi tên', after.trips[0]!.version]);
  });

  it('serialises a JSONB column as a cast parameter', async () => {
    const before = emptyPlannerData();
    const data = await scenarioData();
    const trip = { ...data.trips[0]!, sourceTemplate: {
      templateSlug: 'da-lat-3-ngay',
      title: { vi: 'Đà Lạt', en: 'Da Lat' },
      templateVersion: 1,
      durationDays: 3,
      estimatedTotalVnd: 1,
      clonedAt: '2026-03-01T08:00:00.000Z',
      story: null,
    } };
    const after = { ...before, users: [data.users[0]!], trips: [trip] };
    const insert = planStatements(before, after).find((s) => s.table === 'trips')!;
    expect(insert.text).toContain('::jsonb');
    expect(typeof insert.values[14]).toBe('string');
  });

  it('deletes children first and inserts parents first', async () => {
    const data = await scenarioData();
    const everything = planStatements(emptyPlannerData(), data);
    const insertOrder = everything.map((s) => s.table);
    expect(insertOrder.every((_, i) => everything[i]!.kind === 'insert')).toBe(true);
    const parents = ['planner_users', 'planner_sessions', 'trips', 'trip_days', 'trip_activities', 'trip_expenses'];
    const firstSeen = parents.map((table) => insertOrder.indexOf(table));
    expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a - b));

    const removal = planStatements(data, emptyPlannerData());
    expect(removal.every((s) => s.kind === 'delete')).toBe(true);
    expect(removal.map((s) => s.table)).toEqual([
      'terms_acceptances',
      'audit_events',
      'review_restrictions',
      'community_reviews',
      'trip_expenses',
      'trip_activities',
      'trip_days',
      'trips',
      'planner_oauth_attempts',
      'planner_sessions',
      'planner_users',
    ].filter((table) => removal.some((s) => s.table === table)));
    expect(removal.find((s) => s.table === 'trips')!.values[0]).toEqual(
      data.trips.map((trip) => trip.id),
    );
  });

  it('orders updates before deletes, so an expense is freed before its activity goes', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    const expense = after.tripExpenses.find((row) => row.activityId !== null)!;
    const doomed = expense.activityId!;
    expense.activityId = null;
    after.tripActivities = after.tripActivities.filter((row) => row.id !== doomed);

    const kinds = planStatements(before, after).map((s) => `${s.kind}:${s.table}`);
    expect(kinds).toEqual(['update:trip_expenses', 'delete:trip_activities']);
  });

  it('expresses a reorder of activities as updates of sort_order only', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    const day = after.tripDays[0]!;
    const inDay = after.tripActivities.filter((row) => row.dayId === day.id);
    expect(inDay.length).toBeGreaterThan(1);
    for (const activity of inDay) activity.order = inDay.length - 1 - activity.order;

    const statements = planStatements(before, after);
    expect(statements.length).toBe(inDay.length);
    for (const statement of statements) {
      expect(statement.kind).toBe('update');
      expect(statement.text).toMatch(/^UPDATE "trip_activities" SET "sort_order" = \$2 WHERE/);
    }
  });

  it('refuses two rows with one id rather than guessing', async () => {
    const before = await scenarioData();
    const after = structuredClone(before);
    after.trips.push({ ...after.trips[0]! });
    expect(() => planStatements(before, after)).toThrow(/duplicate id/);
  });
});
