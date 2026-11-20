import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Everything one E2E run needs, generated once per run and handed to the
 * workers through `process.env` (the config file is evaluated again in every
 * worker; the first evaluation wins). Nothing here is committed or printed:
 * secrets are random bytes, the data directory is `.data/e2e/<run-id>/`
 * (git-ignored) and is deleted by `global-teardown.ts`.
 */
export interface RunEnv {
  runId: string;
  port: number;
  baseURL: string;
  dataDir: string;
  adminToken: string;
  guestKeySecret: string;
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

export async function resolveRunEnv(): Promise<RunEnv> {
  if (!process.env.E2E_RUN_ID) {
    process.env.E2E_RUN_ID = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
    process.env.E2E_PORT = String(await freePort());
    process.env.E2E_ADMIN_TOKEN = randomBytes(36).toString('base64url');
    process.env.E2E_GUEST_KEY_SECRET = randomBytes(36).toString('base64url');
  }
  const runId = process.env.E2E_RUN_ID;
  const port = Number(process.env.E2E_PORT);
  const dataDir = resolve('.data', 'e2e', runId);
  mkdirSync(join(dataDir, 'auth'), { recursive: true });
  return {
    runId,
    port,
    // "localhost", not the IP: under `next start` the app derives its own origin as
    // localhost, and the same-origin check on cookie sign-in compares against it.
    baseURL: `http://localhost:${port}`,
    dataDir,
    adminToken: process.env.E2E_ADMIN_TOKEN as string,
    guestKeySecret: process.env.E2E_GUEST_KEY_SECRET as string,
  };
}
