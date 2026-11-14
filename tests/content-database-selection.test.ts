import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPostgresContentStore } from '../src/server/persistence/postgres-content-store';
import { CONTENT_LOCK_KEY, type PgClientLike } from '../src/server/persistence/postgres-planner-store';

/** Store selection by CONTENT_DATABASE_URL and the protocol it speaks (ADR 0013). */

describe('selection by CONTENT_DATABASE_URL', () => {
  const saved = process.env.CONTENT_DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.CONTENT_DATABASE_URL;
    else process.env.CONTENT_DATABASE_URL = saved;
    vi.resetModules();
  });

  it('answers 503 — and never falls back to the JSON file — when the database is down', async () => {
    vi.resetModules();
    // A closed local port: refused immediately, nothing leaves the machine.
    process.env.CONTENT_DATABASE_URL = 'postgres://cnh:hunter2-secret@127.0.0.1:1/content';
    process.env.ADMIN_API_TOKEN = 'test-admin-token-at-least-32-chars-long';
    const route = await import('../src/app/api/admin/travel/places/route');
    const response = await route.GET(
      new Request('https://example.test/api/admin/travel/places', {
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

describe('content store protocol', () => {
  it('takes its own lock, reads its own revision table and loads its five tables', async () => {
    const log: string[] = [];
    const params: unknown[][] = [];
    const client: PgClientLike = {
      async query(text, values) {
        log.push(text);
        params.push(values ?? []);
        if (text === 'SELECT revision FROM content_revision') return { rows: [{ revision: '3' }] };
        return { rows: [] };
      },
      release() {},
    };
    const store = createPostgresContentStore({ connect: async () => client });

    await store.transact(() => undefined);

    expect(log[0]).toBe('BEGIN');
    expect(log[1]).toBe('SELECT pg_advisory_xact_lock($1)');
    expect(params[1]).toEqual([CONTENT_LOCK_KEY]);
    expect(log[2]).toBe('SELECT revision FROM content_revision');
    expect(log.slice(3, 8)).toEqual(
      ['places', 'reviews', 'stories', 'collections', 'templates'].map(
        (name) => `SELECT * FROM "content_${name}" ORDER BY "seq"`,
      ),
    );
    // A no-op leaves the revision alone, then commits.
    expect(log.some((text) => text.startsWith('UPDATE content_revision'))).toBe(false);
    expect(log.at(-1)).toBe('COMMIT');
  });

  it('uses a lock key distinct from the Planner and the migration runner', () => {
    expect(CONTENT_LOCK_KEY).not.toBe('8008001');
    expect(CONTENT_LOCK_KEY).not.toBe('8008002');
  });
});
