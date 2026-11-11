import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The deploy stack reaches PostgreSQL on another VM with
 * `?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt` (ADR 0009 §5,
 * docs/usage.md → Deploy). These tests pin how the installed `pg` driver turns
 * that URL into a TLS config, so a driver upgrade that weakens it fails here.
 * Nothing connects: building a Client only parses the connection string.
 */

const dir = mkdtempSync(join(tmpdir(), 'cnh-pg-tls-'));
const caPath = join(dir, 'pg-ca.crt');
const caText = '-----BEGIN CERTIFICATE-----\nTEST-ONLY-NOT-A-REAL-CA\n-----END CERTIFICATE-----\n';
writeFileSync(caPath, caText);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

type SslConfig = false | { ca?: string; rejectUnauthorized?: boolean };

function sslOf(connectionString: string): SslConfig {
  const client = new pg.Client({ connectionString });
  return (client as unknown as { connectionParameters: { ssl: SslConfig } }).connectionParameters.ssl;
}

const base = 'postgres://cnh_app:secret@192.0.2.10:5432/cnh_planner';

describe('PLANNER_DATABASE_URL TLS parameters', () => {
  it('verify-full with sslrootcert loads the CA and verifies the server', () => {
    const ssl = sslOf(`${base}?sslmode=verify-full&sslrootcert=${encodeURIComponent(caPath)}`);
    expect(ssl).not.toBe(false);
    if (ssl === false) return;
    expect(ssl.ca).toBe(caText);
    expect(ssl.rejectUnauthorized).not.toBe(false);
  });

  it('a URL without TLS parameters stays plaintext', () => {
    expect(sslOf(base)).toBe(false);
  });

  it('a missing CA file fails at parse time instead of connecting unverified', () => {
    expect(() =>
      sslOf(`${base}?sslmode=verify-full&sslrootcert=${encodeURIComponent(join(dir, 'missing.crt'))}`),
    ).toThrow();
  });
});
