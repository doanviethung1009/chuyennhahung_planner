import { describe, expect, it } from 'vitest';
import {
  assertLocalBaseURL,
  assertSafeE2EEnvironment,
  assertThrowawayDatabase,
  E2ESafetyError,
} from '../e2e/support/guard';

describe('E2E safety guard (WEB-3)', () => {
  it('accepts a local base URL', () => {
    for (const url of ['http://127.0.0.1:3100', 'http://localhost:3000', 'http://[::1]:3000']) {
      expect(() => assertLocalBaseURL(url)).not.toThrow();
    }
  });

  it('refuses a remote base URL, the dev VM and a look-alike host', () => {
    for (const url of [
      'https://chuyennhahung.example',
      'http://192.168.100.140',
      'http://localhost.evil.example',
      'http://127.0.0.1.evil.example',
      'not a url',
    ]) {
      expect(() => assertLocalBaseURL(url)).toThrow(E2ESafetyError);
    }
  });

  it('accepts a local database whose name contains e2e or test', () => {
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@localhost:5432/planner_e2e')).not.toThrow();
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@127.0.0.1/planner_test')).not.toThrow();
  });

  it('refuses a remote database host', () => {
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@db.internal:5432/planner_e2e')).toThrow(
      /not local/,
    );
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@192.168.100.140/planner_e2e')).toThrow(
      /not local/,
    );
  });

  it('refuses a database name that is not marked e2e or test', () => {
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@localhost:5432/planner')).toThrow(/e2e/);
    expect(() => assertThrowawayDatabase('X', 'postgres://u:p@localhost:5432/')).toThrow(/e2e/);
    // A substring is not enough: these only happen to contain the letters.
    for (const name of ['latest', 'contest', 'prod_tested', 'e2eprod']) {
      expect(() => assertThrowawayDatabase('X', `postgres://u:p@localhost:5432/${name}`)).toThrow(/whole word/);
    }
  });

  it('checks every database variable in the environment', () => {
    const base = 'http://127.0.0.1:3100';
    expect(() => assertSafeE2EEnvironment({ baseURL: base, env: {} })).not.toThrow();
    expect(() =>
      assertSafeE2EEnvironment({ baseURL: base, env: { PLANNER_DATABASE_URL: 'postgres://u:p@localhost/prod' } }),
    ).toThrow(E2ESafetyError);
    expect(() =>
      assertSafeE2EEnvironment({
        baseURL: base,
        env: { CONTENT_DATABASE_URL: 'postgres://u:p@db.example.com/content_e2e' },
      }),
    ).toThrow(E2ESafetyError);
  });

  it('refuses an E2E_* variable that names the dev VM, and a remote base URL', () => {
    expect(() =>
      assertSafeE2EEnvironment({
        baseURL: 'http://127.0.0.1:3100',
        env: { E2E_TARGET: 'http://192.168.100.140:3000' },
      }),
    ).toThrow(/dev VM/);
    expect(() =>
      assertSafeE2EEnvironment({ baseURL: 'https://example.com', env: {} }),
    ).toThrow(E2ESafetyError);
  });
});
