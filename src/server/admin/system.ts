import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { googleConfig } from '@/server/planner/google';
import { publicContentSource } from '@/server/content/public';
import { MIGRATION_FILE } from '@/server/persistence/migrate';
import { createPostgresPool } from '@/server/persistence/postgres-pool';
import pkg from '../../../package.json';

/**
 * System status for the operator (P07-17). Read-only and leak-proof by
 * construction: the result type below is the allow-list, built field by field
 * from fixed enums, booleans and two validated strings (the version and a
 * migration file name). No env value, URL, host, path or driver message ever
 * enters it, so nothing can be serialised by accident.
 */
export type StoreMode = 'postgres' | 'file';
export type Reachability = 'ok' | 'unreachable' | 'not_applicable';

export interface DomainStatus {
  store: StoreMode;
  database: Reachability;
  /** Name of the last applied migration file, e.g. `0015_audit_admin_events.sql`. */
  lastMigration: string | null;
}

export interface SystemStatus {
  planner: DomainStatus;
  content: DomainStatus;
  build: { version: string; buildId: string | null };
  integrations: {
    googleSignIn: boolean;
    adminApiToken: boolean;
    siteUrl: boolean;
    publicContentSource: 'repository' | 'static';
  };
  health: 'ok' | 'failed';
  /** Always "not configured" until the owner supplies backup facts (decision D10). */
  backups: { state: 'not_configured' };
}

/** What a probe may report: never an error, URL or host. */
export interface ProbeResult {
  database: Reachability;
  lastMigration: string | null;
}

export interface SystemSources {
  databaseUrl(domain: 'planner' | 'content'): string | undefined;
  probe(url: string): Promise<ProbeResult>;
  health(): Promise<boolean>;
  buildId(): Promise<string | null>;
}

/** Connects with a one-connection pool, asks for the newest migration, closes. */
async function probePostgres(url: string): Promise<ProbeResult> {
  const pool = createPostgresPool(url, { max: 1 });
  try {
    const { rows } = await pool.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1',
    );
    const name = rows[0]?.name;
    return { database: 'ok', lastMigration: name && MIGRATION_FILE.test(name) ? name : null };
  } catch {
    // Any failure, including a missing table, reads as unreachable: the driver
    // message can carry a host or a fragment of SQL.
    return { database: 'unreachable', lastMigration: null };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const defaultSources: SystemSources = {
  databaseUrl: (domain) =>
    (domain === 'planner' ? process.env.PLANNER_DATABASE_URL : process.env.CONTENT_DATABASE_URL)?.trim() ||
    undefined,
  probe: probePostgres,
  async health() {
    try {
      const { GET } = await import('@/app/api/health/route');
      const body = (await GET().json()) as { status?: unknown };
      return body.status === 'ok';
    } catch {
      return false;
    }
  },
  async buildId() {
    try {
      const id = (await readFile(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')).trim();
      return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  },
};

async function domain(url: string | undefined, probe: SystemSources['probe']): Promise<DomainStatus> {
  if (!url) return { store: 'file', database: 'not_applicable', lastMigration: null };
  let result: ProbeResult;
  try {
    result = await probe(url);
  } catch {
    result = { database: 'unreachable', lastMigration: null };
  }
  return { store: 'postgres', ...result };
}

export async function loadSystemStatus(sources: SystemSources = defaultSources): Promise<SystemStatus> {
  const [planner, content, health, buildId] = await Promise.all([
    domain(sources.databaseUrl('planner'), sources.probe),
    domain(sources.databaseUrl('content'), sources.probe),
    sources.health().catch(() => false),
    sources.buildId().catch(() => null),
  ]);
  return {
    planner,
    content,
    build: { version: String(pkg.version), buildId },
    integrations: {
      googleSignIn: googleConfig() !== null,
      adminApiToken: Boolean(process.env.ADMIN_API_TOKEN?.trim()),
      siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
      publicContentSource: publicContentSource(),
    },
    health: health ? 'ok' : 'failed',
    backups: { state: 'not_configured' },
  };
}
