import { ContentError } from '@/server/content/errors';
import type { PlannerData, PlannerStore } from '@/server/planner/store';
import type { DocumentStore } from './json-store';
import { fromRow, planStatements, rowsToData, TABLES, type TableSpec } from './planner-rows';
import type { SharedMapSource } from '@/server/planner/member-map-share';
import type { MemberMapShare, PlannerUser, Trip } from '@/server/planner/schemas';

/**
 * The Planner on PostgreSQL (ADR 0009). One file of parameterised SQL over the
 * pure mapping and diff in `planner-rows.ts`.
 *
 * `transact` is one database transaction: take a global advisory lock, load the
 * seven tables, run the repository's mutation on a clone, write only the diff,
 * commit. The lock is what makes two *processes* serialise the way the
 * in-process queue serialises two requests. `read` is a REPEATABLE READ,
 * READ ONLY transaction so the seven tables come from one snapshot.
 *
 * Per-instance cache, validated by revision (ADR 0009 §2): `planner_revision`
 * is a counter every committing `transact` bumps under the lock. A read asks
 * for it first and reloads the seven tables only when it differs from the
 * cached one. The cache is tagged with the revision it was loaded at, so it is
 * never "stale", only "behind" — and behind is detected. After a commit the
 * cache is simply dropped rather than patched: what a fresh load returns (bigint
 * and jsonb round-trips, column defaults) is not guaranteed to equal the
 * mutated clone, and the next read pays one reload. A rollback changes nothing.
 * Callers only ever get a `structuredClone`, never a reference into the cache.
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
export function translateDatabaseError(error: unknown, label = 'Planner'): Error {
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
      return unavailable(label);
    }
    return new Error(`${label.toLowerCase()} database error (${code})`);
  }
  return unavailable(label);
}

function unavailable(label: string): ContentError {
  return new ContentError('service_unavailable', `the ${label} database is unavailable`);
}

/**
 * What distinguishes one store from another (ADR 0013 §2). All of it is a
 * constant chosen in code — a table list, a lock key, a revision table name —
 * never a request value, so it is safe to put in SQL text.
 */
export interface TableStoreConfig {
  tables: readonly TableSpec[];
  lockKey: string;
  revisionTable: string;
  /** `Planner` or `Travel Content`: used in error text only. */
  label: string;
}

/** Constant key of the Travel Content write lock. Arbitrary, but fixed forever. */
export const CONTENT_LOCK_KEY = '8008003';

interface Snapshot<T> {
  revision: string;
  data: T;
}

export function createPostgresPlannerStore(pool: PgPoolLike): PlannerStore {
  const store = createPostgresTableStore<PlannerData>(pool, {
    tables: TABLES,
    lockKey: PLANNER_LOCK_KEY,
    revisionTable: 'planner_revision',
    label: 'Planner',
  });
  return Object.assign(store, {
    /**
     * ADR 0030 hardening M1: the public shared map reads three indexed rows
     * (share by its UNIQUE digest, the owner by primary key, the owner's completed
     * trips by `trips_owner_id_idx`) instead of the whole document. Always fresh —
     * no cache, so a revoke, ban or delete is seen on the next view.
     */
    async readSharedMapSource(digest: string): Promise<SharedMapSource | null> {
      const client = await pool.connect().catch((error: unknown) => {
        throw translateDatabaseError(error, 'Planner');
      });
      let broken = false;
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const specOf = (collection: string) => {
          const spec = TABLES.find((candidate) => candidate.collection === collection);
          if (!spec) throw new Error(`no table for ${collection}`);
          return spec;
        };
        const shares = await client.query('SELECT * FROM member_map_shares WHERE token_digest = $1', [digest]);
        const shareRow = shares.rows[0];
        let result: SharedMapSource | null = null;
        if (shareRow) {
          const share = fromRow(specOf('memberMapShares'), shareRow) as unknown as MemberMapShare;
          const owners = await client.query('SELECT * FROM planner_users WHERE id = $1', [share.userId]);
          const ownerRow = owners.rows[0];
          if (ownerRow) {
            const owner = fromRow(specOf('users'), ownerRow) as unknown as PlannerUser;
            const trips = await client.query(
              "SELECT * FROM trips WHERE owner_id = $1 AND planning_status = 'completed'",
              [owner.id],
            );
            result = {
              share,
              owner,
              trips: trips.rows.map((row) => {
                const trip = fromRow(specOf('trips'), row) as unknown as Trip;
                return { ownerId: trip.ownerId, destinationSlug: trip.destinationSlug, planningStatus: trip.planningStatus };
              }),
            };
          }
        }
        await client.query('COMMIT');
        return result;
      } catch (error) {
        broken = isConnectionFailure(translateDatabaseError(error, 'Planner'));
        await rollback(client);
        throw translateDatabaseError(error, 'Planner');
      } finally {
        client.release(broken);
      }
    },
  });
}

export function createPostgresTableStore<T extends object>(
  pool: PgPoolLike,
  config: TableStoreConfig,
): DocumentStore<T> & { revision(): Promise<string> } {
  const { tables, lockKey, revisionTable, label } = config;
  const db = async <R>(task: () => Promise<R>): Promise<R> => {
    try {
      return await task();
    } catch (error) {
      throw translateDatabaseError(error, label);
    }
  };

  async function loadRevision(client: PgClientLike): Promise<string> {
    const result = await client.query(`SELECT revision FROM ${revisionTable}`);
    const value = result.rows[0]?.revision;
    if (value === undefined || value === null) {
      throw new Error(`${revisionTable} is empty — its migration has not run`);
    }
    return String(value);
  }

  async function loadAll(client: PgClientLike): Promise<T> {
    const rowsByTable: Record<string, Record<string, unknown>[]> = {};
    for (const spec of tables) {
      // Identifiers are constants from the table list; there is nothing to bind.
      const result = await client.query(`SELECT * FROM "${spec.table}" ORDER BY "seq"`);
      rowsByTable[spec.table] = result.rows;
    }
    return rowsToData<T>(rowsByTable, tables);
  }

  let cache: Snapshot<T> | null = null;

  /** Keep the newest snapshot; an older one from a racing request is ignored. */
  function remember(snapshot: Snapshot<T>): void {
    if (cache === null || BigInt(snapshot.revision) >= BigInt(cache.revision)) cache = snapshot;
  }

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

  /** Cached data when the database is still at its revision, else a fresh load. */
  async function currentSnapshot(client: PgClientLike): Promise<Snapshot<T>> {
    const revision = await db(() => loadRevision(client));
    if (cache !== null && cache.revision === revision) return cache;
    const snapshot = { revision, data: await db(() => loadAll(client)) };
    remember(snapshot);
    return snapshot;
  }

  return {
    read() {
      return withClient(async (client) => {
        // One snapshot for the revision and the tables, so they agree.
        await db(() => client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
        try {
          const snapshot = await currentSnapshot(client);
          await db(() => client.query('COMMIT'));
          return structuredClone(snapshot.data);
        } catch (error) {
          await rollback(client);
          throw error;
        }
      });
    },

    revision() {
      return withClient((client) => db(() => loadRevision(client)));
    },

    async write(next) {
      // A whole-document replace, kept for the interface: it is the same diff,
      // so it is atomic and takes the same lock.
      await this.transact((data) => {
        for (const spec of tables) {
          (data as unknown as Record<string, unknown>)[spec.collection] = structuredClone(
            (next as unknown as Record<string, unknown>)[spec.collection],
          );
        }
      });
    },

    transact(mutate) {
      return withClient(async (client) => {
        try {
          await db(() => client.query('BEGIN'));
          await db(() => client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]));
          // Under the lock nobody else commits, so this is exactly the state
          // the diff below is taken against. It is never mutated: the
          // mutation runs on a clone.
          const before = await currentSnapshot(client);
          const working = structuredClone(before.data);

          // Outside `db()`: a repository error (not_found, version_conflict…)
          // must reach the caller unchanged.
          const result = await mutate(working);

          const statements = planStatements(before.data, working, tables);
          for (const statement of statements) {
            await db(() => client.query(statement.text, statement.values));
          }
          // A no-op leaves the data, and so the revision, alone.
          if (statements.length > 0) {
            await db(() => client.query(`UPDATE ${revisionTable} SET revision = revision + 1`));
          }
          await db(() => client.query('COMMIT'));
          if (statements.length > 0) cache = null;
          return result;
        } catch (error) {
          // The cache stays valid: it is tagged with the revision it was
          // loaded at, and nothing was committed.
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
