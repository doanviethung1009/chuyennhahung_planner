import { ContentError } from '@/server/content/errors';
import type { PlannerData, PlannerStore } from '@/server/planner/store';
import { planStatements, rowsToData, TABLES } from './planner-rows';

/**
 * The Planner on PostgreSQL (ADR 0008). One file of parameterised SQL over the
 * pure mapping and diff in `planner-rows.ts`.
 *
 * `transact` is one database transaction: take a global advisory lock, load the
 * seven tables, run the repository's mutation on a clone, write only the diff,
 * commit. The lock is what makes two *processes* serialise the way the
 * in-process queue serialises two requests. `read` is a REPEATABLE READ,
 * READ ONLY transaction so the seven tables come from one snapshot. There is no
 * cache: with more than one process it would be stale by construction.
 */

/** Constant key of the Planner write lock. Arbitrary, but fixed forever. */
export const PLANNER_LOCK_KEY = '8008001';

/** The slice of `pg.PoolClient` the store uses, so tests can fake it. */
export interface PgClientLike {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean | Error): void;
}

/** The slice of `pg.Pool` the store uses. */
export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * Turns a driver failure into something safe to surface. The original error is
 * dropped on purpose: a driver message can carry a host name, a role name or a
 * fragment of a row, and none of that belongs in an API response or a log line.
 *
 * - 23505 (unique violation)  -> the repository's own 409, never a 500.
 * - connection, auth, resource and server-shutdown failures, and anything that
 *   is not an SQLSTATE at all (ECONNREFUSED, a timeout, a dropped socket)
 *   -> 503 `service_unavailable`. The app never falls back to another store.
 * - any other SQLSTATE -> a generic error carrying only the five-character code.
 */
export function translateDatabaseError(error: unknown): Error {
  if (error instanceof ContentError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;

  if (code === '23505') {
    return new ContentError('slug_conflict', 'a record with that unique value already exists');
  }
  if (typeof code === 'string' && SQLSTATE.test(code)) {
    const family = code.slice(0, 2);
    if (['08', '28', '53', '57', '58'].includes(family) || code === '3D000') {
      return unavailable();
    }
    return new Error(`planner database error (${code})`);
  }
  return unavailable();
}

function unavailable(): ContentError {
  return new ContentError('service_unavailable', 'the Planner database is unavailable');
}

async function db<R>(task: () => Promise<R>): Promise<R> {
  try {
    return await task();
  } catch (error) {
    throw translateDatabaseError(error);
  }
}

async function loadAll(client: PgClientLike): Promise<PlannerData> {
  const rowsByTable: Record<string, Record<string, unknown>[]> = {};
  for (const spec of TABLES) {
    // Identifiers are constants from `TABLES`; there is nothing to bind.
    const result = await client.query(`SELECT * FROM "${spec.table}" ORDER BY "seq"`);
    rowsByTable[spec.table] = result.rows;
  }
  return rowsToData(rowsByTable);
}

export function createPostgresPlannerStore(pool: PgPoolLike): PlannerStore {
  async function withClient<R>(run: (client: PgClientLike) => Promise<R>): Promise<R> {
    const client = await db(() => pool.connect());
    let broken = false;
    try {
      return await run(client);
    } catch (error) {
      broken = isConnectionFailure(error);
      throw error;
    } finally {
      client.release(broken);
    }
  }

  return {
    read() {
      return withClient(async (client) => {
        await db(() => client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
        try {
          const data = await db(() => loadAll(client));
          await db(() => client.query('COMMIT'));
          return data;
        } catch (error) {
          await rollback(client);
          throw error;
        }
      });
    },

    async write(next) {
      // A whole-document replace, kept for the interface: it is the same diff,
      // so it is atomic and takes the same lock.
      await this.transact((data) => {
        for (const spec of TABLES) {
          (data as unknown as Record<string, unknown>)[spec.collection] = structuredClone(
            next[spec.collection],
          );
        }
      });
    },

    transact(mutate) {
      return withClient(async (client) => {
        try {
          await db(() => client.query('BEGIN'));
          await db(() => client.query('SELECT pg_advisory_xact_lock($1)', [PLANNER_LOCK_KEY]));
          const before = await db(() => loadAll(client));
          const working = structuredClone(before);

          // Outside `db()`: a repository error (not_found, version_conflict…)
          // must reach the caller unchanged.
          const result = await mutate(working);

          for (const statement of planStatements(before, working)) {
            await db(() => client.query(statement.text, statement.values));
          }
          await db(() => client.query('COMMIT'));
          return result;
        } catch (error) {
          await rollback(client);
          throw error;
        }
      });
    },
  };
}

async function rollback(client: PgClientLike): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The connection is gone; releasing it destroyed it, and the server rolls
    // back an abandoned transaction by itself.
  }
}

function isConnectionFailure(error: unknown): boolean {
  return error instanceof ContentError && error.code === 'service_unavailable';
}
