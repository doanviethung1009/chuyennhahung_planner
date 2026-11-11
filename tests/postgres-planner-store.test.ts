import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentError } from '../src/server/content/errors';
import {
  createPostgresPlannerStore,
  PLANNER_LOCK_KEY,
  translateDatabaseError,
  type PgClientLike,
  type PgPoolLike,
} from '../src/server/persistence/postgres-planner-store';
import { TABLES, toRow } from '../src/server/persistence/planner-rows';
import type { PlannerData } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';
import { runScenario } from './planner-pg-fixtures';
import { createMemoryPlannerStore } from '../src/server/planner/store';

/**
 * The Postgres adapter against a scripted fake driver: no database needed. What
 * it pins is the protocol — BEGIN, lock, load, diff, COMMIT or ROLLBACK — and
 * what the adapter lets through when the driver fails.
 */

const SECRET_URL = 'postgres://planner:hunter2-secret@db.internal:5432/planner';

async function scenario(): Promise<PlannerData> {
  const store = createMemoryPlannerStore();
  await runScenario(makePlanner({ store }));
  return store.read();
}

function rowsFor(data: PlannerData): Map<string, Record<string, unknown>[]> {
  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const spec of TABLES) {
    byTable.set(
      spec.table,
      (data[spec.collection] as Record<string, unknown>[]).map((record) => {
        const row = toRow(spec, record);
        for (const column of spec.columns) {
          const value = row[column.column];
          if (value === null) continue;
          if (column.type === 'bigint') row[column.column] = String(value);
          if (column.type === 'jsonb') row[column.column] = JSON.parse(value as string);
        }
        return row;
      }),
    );
  }
  return byTable;
}

function fakePool(
  data: PlannerData | null,
  fail: (text: string) => unknown = () => undefined,
) {
  const log: string[] = [];
  const params: unknown[][] = [];
  const released: Array<boolean | Error | undefined> = [];
  const tables = data ? rowsFor(data) : new Map();
  // The database's `planner_revision`; tests bump it to play "another process".
  const db = { revision: 7 };
  const client: PgClientLike = {
    async query(text, values) {
      log.push(text);
      params.push(values ?? []);
      const failure = fail(text);
      if (failure) throw failure;
      if (text === 'SELECT revision FROM planner_revision') {
        return { rows: [{ revision: String(db.revision) }] };
      }
      if (text.startsWith('UPDATE planner_revision')) db.revision += 1;
      const table = /FROM "([a-z_]+)"/.exec(text)?.[1];
      return { rows: table ? (tables.get(table) ?? []) : [] };
    },
    release(destroy) {
      released.push(destroy);
    },
  };
  const pool: PgPoolLike = { connect: async () => client };
  return { pool, log, params, released, db, tables };
}

const sqlError = (code: string, message = 'driver detail') =>
  Object.assign(new Error(message), { code });

describe('transact protocol', () => {
  it('locks, loads all seven tables, and commits with no writes for a no-op', async () => {
    const { pool, log, params } = fakePool(await scenario());
    await createPostgresPlannerStore(pool).transact(() => 'ok');

    expect(log[0]).toBe('BEGIN');
    expect(log[1]).toBe('SELECT pg_advisory_xact_lock($1)');
    expect(params[1]).toEqual([PLANNER_LOCK_KEY]);
    expect(log[2]).toBe('SELECT revision FROM planner_revision');
    expect(log.slice(3, 10).every((text) => text.startsWith('SELECT * FROM'))).toBe(true);
    expect(log.slice(3, 10)).toHaveLength(7);
    expect(log.at(-1)).toBe('COMMIT');
    expect(log.filter((text) => /^(INSERT|UPDATE|DELETE)/.test(text))).toEqual([]);
  });

  it('writes only the diff, then commits', async () => {
    const data = await scenario();
    const { pool, log } = fakePool(data);
    await createPostgresPlannerStore(pool).transact((doc) => {
      doc.trips[0]!.title = 'Đổi tên';
    });
    const writes = log.filter((text) => /^(INSERT|UPDATE|DELETE)/.test(text));
    expect(writes).toEqual(['UPDATE "trips" SET "title" = $2 WHERE "id" = $1', 'UPDATE planner_revision SET revision = revision + 1']);
    // The revision moves in the same transaction, after the writes.
    expect(log.slice(-2)).toEqual(['UPDATE planner_revision SET revision = revision + 1', 'COMMIT']);
  });

  it('rolls back and writes nothing when the mutation throws, passing its error through', async () => {
    const { pool, log } = fakePool(await scenario());
    const refusal = new ContentError('version_conflict', 'stale');
    await expect(
      createPostgresPlannerStore(pool).transact((doc) => {
        doc.trips.length = 0;
        throw refusal;
      }),
    ).rejects.toBe(refusal);
    expect(log.at(-1)).toBe('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(log.some((text) => text.startsWith('DELETE'))).toBe(false);
  });

  it('reads in one REPEATABLE READ, READ ONLY transaction', async () => {
    const { pool, log } = fakePool(await scenario());
    const data = await createPostgresPlannerStore(pool).read();
    expect(log[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(log.at(-1)).toBe('COMMIT');
    expect(data.trips.length).toBeGreaterThan(0);
  });
});

describe('revision-validated cache', () => {
  const loads = (log: string[]) => log.filter((text) => text.startsWith('SELECT * FROM "planner_users"')).length;

  it('serves a read from the cache while the revision is unchanged', async () => {
    const { pool, log } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    await store.read();
    await store.read();
    await store.read();
    expect(loads(log)).toBe(1);
    expect(log.filter((text) => text === 'SELECT revision FROM planner_revision')).toHaveLength(3);
  });

  it('reloads when another process moved the revision', async () => {
    const { pool, log, db } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    await store.read();
    db.revision += 1;
    await store.read();
    expect(loads(log)).toBe(2);
  });

  it('never hands out a reference into the cache', async () => {
    const { pool } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    const first = await store.read();
    const title = first.trips[0]!.title;
    first.trips[0]!.title = 'mutated by a caller';
    first.trips.length = 0;
    const second = await store.read();
    expect(second.trips[0]!.title).toBe(title);
    expect(second).not.toBe(first);
  });

  it('lets a transaction reuse a current cache instead of reloading', async () => {
    const { pool, log } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    await store.read();
    await store.transact(() => undefined);
    expect(loads(log)).toBe(1);
  });

  it('bumps the revision on a committing write and drops the cache', async () => {
    const { pool, log, db } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    await store.read();
    await store.transact((doc) => {
      doc.trips[0]!.title = 'Đổi tên';
    });
    expect(db.revision).toBe(8);
    await store.read();
    expect(loads(log)).toBe(2);
  });

  it('does not bump the revision for a no-op transaction', async () => {
    const { pool, db } = fakePool(await scenario());
    await createPostgresPlannerStore(pool).transact(() => undefined);
    expect(db.revision).toBe(7);
  });

  it('leaves the cache valid after a ROLLBACK, and the failed edit out of it', async () => {
    const { pool, log, db } = fakePool(await scenario());
    const store = createPostgresPlannerStore(pool);
    const before = await store.read();
    await expect(
      store.transact((doc) => {
        doc.trips.length = 0;
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect(db.revision).toBe(7);
    expect(log.some((text) => text.startsWith('UPDATE planner_revision'))).toBe(false);
    expect(await store.read()).toEqual(before);
    expect(loads(log)).toBe(1);
  });

  it('reports the revision for the share index', async () => {
    const { pool } = fakePool(await scenario());
    expect(await createPostgresPlannerStore(pool).revision!()).toBe('7');
  });
});

describe('failure mapping', () => {
  it('maps a unique violation to the existing 409, and rolls back', async () => {
    const { pool, log } = fakePool(
      await scenario(),
      (text) => text.startsWith('INSERT') && sqlError('23505', 'duplicate key value (secret@x)'),
    );
    const error = await createPostgresPlannerStore(pool)
      .transact((doc) => {
        doc.users.push({ ...doc.users[0]!, id: 'usr_new' });
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).status).toBe(409);
    expect((error as ContentError).code).toBe('slug_conflict');
    expect((error as ContentError).message).not.toContain('secret');
    expect(log.at(-1)).toBe('ROLLBACK');
  });

  it.each([['ECONNREFUSED'], ['ENOTFOUND'], ['57P01'], ['53300'], ['28P01'], ['08006']])(
    'maps %s to 503 service_unavailable without the driver message',
    async (code) => {
      const pool: PgPoolLike = {
        connect: async () => {
          throw sqlError(code, `connect failed for ${SECRET_URL}`);
        },
      };
      const error = (await createPostgresPlannerStore(pool)
        .read()
        .catch((caught: unknown) => caught)) as ContentError;
      expect(error).toBeInstanceOf(ContentError);
      expect(error.status).toBe(503);
      expect(error.code).toBe('service_unavailable');
      expect(JSON.stringify(error.message)).not.toContain('hunter2');
    },
  );

  it('treats an error with no code (a dropped socket, a timeout) as 503 and destroys the connection', async () => {
    const { pool, released } = fakePool(
      await scenario(),
      (text) => text.startsWith('SELECT * FROM "trips"') && new Error('Connection terminated'),
    );
    const error = (await createPostgresPlannerStore(pool)
      .transact(() => undefined)
      .catch((caught: unknown) => caught)) as ContentError;
    expect(error.status).toBe(503);
    expect(released).toEqual([true]);
  });

  it('reduces any other SQLSTATE to its code alone', () => {
    const error = translateDatabaseError(sqlError('23503', `key (id)=(trip_9) in ${SECRET_URL}`));
    expect(error.message).toBe('planner database error (23503)');
    expect(error).not.toBeInstanceOf(ContentError);
  });
});

describe('selection by PLANNER_DATABASE_URL', () => {
  const saved = process.env.PLANNER_DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.PLANNER_DATABASE_URL;
    else process.env.PLANNER_DATABASE_URL = saved;
    vi.resetModules();
  });

  it('answers 503 — and never falls back to the JSON file — when the database is down', async () => {
    vi.resetModules();
    // A closed local port: refused immediately, nothing leaves the machine.
    process.env.PLANNER_DATABASE_URL = 'postgres://planner:hunter2-secret@127.0.0.1:1/planner';
    process.env.ADMIN_API_TOKEN = 'test-admin-token-at-least-32-chars-long';
    const route = await import('../src/app/api/admin/planner/users/route');
    const response = await route.GET(
      new Request('https://example.test/api/admin/planner/users', {
        headers: { authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` },
      }),
    );
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(text).error.code).toBe('service_unavailable');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('127.0.0.1');
  });
});
