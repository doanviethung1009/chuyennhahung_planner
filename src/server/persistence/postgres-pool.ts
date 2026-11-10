import pg from 'pg';

/**
 * One small `pg` pool per process (ADR 0008 §4). The connection string comes
 * from the environment and is handed straight to the driver — it is never
 * logged, echoed or put in an error message.
 */

const DATE_OID = 1082;

export interface PoolOptions {
  /** Extra startup options, e.g. `-c search_path=...` (tests use a schema). */
  options?: string;
  max?: number;
}

export function createPostgresPool(connectionString: string, extra: PoolOptions = {}): pg.Pool {
  const max = extra.max ?? Number(process.env.DATABASE_POOL_MAX ?? 5);
  const pool = new pg.Pool({
    connectionString,
    max: Number.isInteger(max) && max > 0 ? max : 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    options: extra.options,
    // DATE stays the `YYYY-MM-DD` text Postgres sends. The default parser
    // builds a local-time Date, which shifts the day across time zones.
    types: {
      getTypeParser: (oid: number, format?: 'text' | 'binary') =>
        oid === DATE_OID
          ? (value: string) => value
          : pg.types.getTypeParser(oid, format as 'text'),
    },
  });
  // An idle client whose socket drops emits 'error'; unhandled, it would crash
  // the process. The next query on a fresh client reports the outage as a 503.
  pool.on('error', () => undefined);
  return pool;
}
