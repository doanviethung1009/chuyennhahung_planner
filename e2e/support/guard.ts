/**
 * Safety guard for the E2E suite (WEB-3, owner decision 9): the suite only ever
 * talks to a local server on a throwaway data store. Pure functions, no I/O, so
 * `tests/e2e-guard.test.ts` can prove every refusal. There is deliberately no
 * override flag: a refusal is a hard failure.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** The dev VM (docs/memory: app host). Never a valid target, whatever the variable is called. */
const DEV_VM_HOST = '192.168.100.140';

/** Env names whose value the suite reads or forwards to the server. */
const DATABASE_URL_KEYS = ['PLANNER_DATABASE_URL', 'CONTENT_DATABASE_URL', 'E2E_DATABASE_URL'] as const;

export class E2ESafetyError extends Error {
  constructor(message: string) {
    super(`E2E safety guard: ${message}`);
    this.name = 'E2ESafetyError';
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

/** Refuses any base URL that is not `http(s)://localhost|127.0.0.1|[::1]`. */
export function assertLocalBaseURL(baseURL: string): void {
  const host = hostOf(baseURL);
  if (!host) throw new E2ESafetyError('the base URL is not a valid URL');
  if (!isLocalHost(host)) {
    throw new E2ESafetyError(`the base URL host "${host}" is not local (only localhost, 127.0.0.1 or [::1])`);
  }
}

/** Refuses a database that is remote, or whose name does not mark it as a throwaway one. */
export function assertThrowawayDatabase(name: string, url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new E2ESafetyError(`${name} is not a valid URL`);
  }
  if (!isLocalHost(parsed.hostname)) {
    throw new E2ESafetyError(`${name} points at host "${parsed.hostname}", which is not local`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  if (!database || !/(e2e|test)/.test(database)) {
    throw new E2ESafetyError(`${name} database name must contain "e2e" or "test"`);
  }
}

/**
 * Checks the whole environment the suite will run in. `env` is the process
 * environment as the config sees it; `baseURL` is the server under test.
 */
export function assertSafeE2EEnvironment(options: {
  baseURL: string;
  env: Record<string, string | undefined>;
}): void {
  const { baseURL, env } = options;
  assertLocalBaseURL(baseURL);

  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (key.startsWith('E2E_') && value.includes(DEV_VM_HOST)) {
      throw new E2ESafetyError(`${key} points at the dev VM (${DEV_VM_HOST})`);
    }
  }

  for (const key of DATABASE_URL_KEYS) {
    const value = env[key]?.trim();
    if (value) assertThrowawayDatabase(key, value);
  }
}
