import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2EEnvironment } from './e2e/support/guard';
import { resolveRunEnv } from './e2e/support/run-env';

/**
 * End-to-end smoke suite (WEB-3, ADR 0032). It starts the production build on a
 * free local port with a throwaway data store and per-run random secrets, and
 * never touches a real database or the dev VM. See docs/usage.md, "End-to-end tests".
 */
const run = await resolveRunEnv();

// Hard fail before anything starts: local URL only, throwaway database only.
assertSafeE2EEnvironment({ baseURL: run.baseURL, env: process.env });

if (!existsSync('.next/standalone/server.js')) {
  throw new Error('No production build found: run `npm run build` before `npm run e2e`.');
}

const usePostgres = process.env.E2E_DB === 'postgres';
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim() ?? '';
if (usePostgres && !e2eDatabaseUrl) {
  throw new Error('E2E_DB=postgres needs E2E_DATABASE_URL (a local database whose name contains e2e or test).');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // One JSON store, one writer: the specs share state on purpose (accounts, a listed trip).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: run.baseURL,
    locale: 'vi-VN',
    // Traces can carry cookies: kept only for a failure, and CI uploads them only for a failure.
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Locally the installed Google Chrome (no browser download, Q5); CI installs Chromium.
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
    },
  ],
  webServer: {
    command: 'node e2e/support/serve.mjs',
    url: `${run.baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      // "localhost" (loopback only), not 127.0.0.1: with another hostname Next treats the
      // next-intl rewrite of "/" as external and redirect-loops every unprefixed Vietnamese URL.
      HOSTNAME: 'localhost',
      PORT: String(run.port),
      NEXT_TELEMETRY_DISABLED: '1',
      PLANNER_STORE: join(run.dataDir, 'planner.json'),
      TRAVEL_CONTENT_STORE: join(run.dataDir, 'travel-content.json'),
      TRAVEL_CONTENT_AUTOSEED: 'true',
      ADMIN_API_TOKEN: run.adminToken,
      GUEST_KEY_SECRET: run.guestKeySecret,
      // Blank on purpose: a developer's `.env.local` must never route the app to a real database.
      PLANNER_DATABASE_URL: usePostgres ? e2eDatabaseUrl : '',
      CONTENT_DATABASE_URL: usePostgres ? e2eDatabaseUrl : '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    },
  },
});
