import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Role = 'member' | 'editor' | 'admin' | 'super_admin';

export interface Account {
  role: Role;
  handle: string;
  email: string;
  displayName: string;
  /** Generated for this run by `global-setup.ts`; never reused, never committed. */
  password: string;
}

export interface Accounts {
  member: Account;
  /** A second member, for "only my own data" checks. */
  member2: Account;
  editor: Account;
  admin: Account;
  super_admin: Account;
  /** A staff account whose temporary password is NOT changed in setup: the gate is a spec step. */
  gate: Account & { temporaryPassword: string };
}

export function dataDir(): string {
  const runId = process.env.E2E_RUN_ID;
  if (!runId) throw new Error('E2E_RUN_ID is not set: the suite must be started through `npm run e2e`.');
  return join('.data', 'e2e', runId);
}

export function storageStatePath(name: keyof Accounts): string {
  return join(dataDir(), 'auth', `${name}.json`);
}

export function loadAccounts(): Accounts {
  return JSON.parse(readFileSync(join(dataDir(), 'accounts.json'), 'utf8')) as Accounts;
}
