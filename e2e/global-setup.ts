import { randomBytes, randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import { assertSafeE2EEnvironment } from './support/guard';
import { dataDir, storageStatePath, type Account, type Accounts, type Role } from './support/accounts';

/**
 * Creates the accounts through the app's own paths: the service token creates
 * each user (ADR 0006), the temporary password it returns is exchanged for a
 * per-run random password through `POST /api/planner/password`. The `gate`
 * account keeps its temporary password so a spec can walk the forced change.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('E2E: no baseURL in the Playwright config');
  assertSafeE2EEnvironment({ baseURL, env: process.env });

  const adminToken = process.env.E2E_ADMIN_TOKEN as string;
  const runId = process.env.E2E_RUN_ID as string;
  const origin = new URL(baseURL).origin;

  const headers = () => ({ origin, 'x-forwarded-for': `203.0.113.${randomInt(1, 254)}` });
  const generatePassword = () => `E2e-${randomBytes(18).toString('base64url')}`;

  const admin = await request.newContext({ baseURL, extraHTTPHeaders: { authorization: `Bearer ${adminToken}`, origin } });

  async function create(role: Role, handle: string): Promise<{ account: Account; temporary: string }> {
    const displayName = `E2E ${handle}`;
    const email = `${handle}@e2e.invalid`;
    const response = await admin.post('/api/admin/planner/users', { data: { handle, displayName, email, role } });
    if (response.status() !== 201) throw new Error(`creating ${role} failed: ${response.status()}`);
    const body = (await response.json()) as { temporaryPassword?: string };
    if (!body.temporaryPassword) throw new Error(`no temporary password issued for ${role}`);
    return { account: { role, handle, email, displayName, password: '' }, temporary: body.temporaryPassword };
  }

  async function finish(name: string, account: Account, temporary: string): Promise<void> {
    const context = await request.newContext({ baseURL, extraHTTPHeaders: headers() });
    const signIn = await context.post('/api/planner/session', { data: { identifier: account.email, password: temporary } });
    if (signIn.status() !== 201) throw new Error(`first sign-in failed for ${name}: ${signIn.status()}`);
    account.password = generatePassword();
    const change = await context.post('/api/planner/password', {
      data: { currentPassword: temporary, newPassword: account.password },
    });
    if (change.status() !== 204) throw new Error(`password change failed for ${name}: ${change.status()}`);
    await context.storageState({ path: storageStatePath(name as keyof Accounts) });
    await context.dispose();
  }

  const suffix = runId.replace(/[^a-z0-9]/g, '').slice(-6);
  const made = {
    member: await create('member', `e2e-member-${suffix}`),
    member2: await create('member', `e2e-member2-${suffix}`),
    editor: await create('editor', `e2e-editor-${suffix}`),
    admin: await create('admin', `e2e-admin-${suffix}`),
    super_admin: await create('super_admin', `e2e-super-${suffix}`),
    gate: await create('editor', `e2e-gate-${suffix}`),
  };
  for (const name of ['member', 'member2', 'editor', 'admin', 'super_admin'] as const) {
    await finish(name, made[name].account, made[name].temporary);
  }
  await admin.dispose();

  const accounts: Accounts = {
    member: made.member.account,
    member2: made.member2.account,
    editor: made.editor.account,
    admin: made.admin.account,
    super_admin: made.super_admin.account,
    gate: { ...made.gate.account, password: generatePassword(), temporaryPassword: made.gate.temporary },
  };
  writeFileSync(join(dataDir(), 'accounts.json'), JSON.stringify(accounts), { mode: 0o600 });
}
