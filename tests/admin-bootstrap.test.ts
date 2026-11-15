import { describe, expect, it } from 'vitest';
import {
  createAdminAccount,
  handleFromEmail,
  parseAdminBootstrapArgs,
} from '../src/server/planner/admin-bootstrap';
import { createMemoryPlannerStore } from '../src/server/planner/store';
import { makePlanner } from './planner-helpers';

describe('parseAdminBootstrapArgs', () => {
  it('reads email and name, lower-cases the email and derives a handle', () => {
    expect(parseAdminBootstrapArgs(['--email', ' Hung.Tran@Example.VN ', '--name', 'Hưng'])).toEqual({
      email: 'hung.tran@example.vn',
      displayName: 'Hưng',
      handle: 'hung-tran',
    });
  });

  it('keeps an explicit handle', () => {
    expect(
      parseAdminBootstrapArgs(['--name', 'Hưng', '--email', 'a@b.vn', '--handle', 'admin-hung']).handle,
    ).toBe('admin-hung');
  });

  it('refuses missing values and unknown flags', () => {
    expect(() => parseAdminBootstrapArgs([])).toThrow(/usage/);
    expect(() => parseAdminBootstrapArgs(['--email', 'a@b.vn'])).toThrow(/usage/);
    expect(() => parseAdminBootstrapArgs(['--email', '--name', 'x'])).toThrow(/needs a value/);
    expect(() => parseAdminBootstrapArgs(['--bogus', 'x'])).toThrow(/unknown argument/);
  });

  it('accepts --role, defaults to admin, and refuses an unknown role', () => {
    const base = ['--email', 'a@b.vn', '--name', 'x'];
    expect(parseAdminBootstrapArgs(base).role).toBeUndefined();
    expect(parseAdminBootstrapArgs([...base, '--role', 'super_admin']).role).toBe('super_admin');
    expect(() => parseAdminBootstrapArgs([...base, '--role', 'root'])).toThrow(/--role must be/);
    expect(() => parseAdminBootstrapArgs([...base, '--role'])).toThrow(/needs a value/);
  });

  it('falls back to "admin" for a too-short local part', () => {
    expect(handleFromEmail('a@b.vn')).toBe('admin');
    expect(handleFromEmail('Hung.Tran+x@site.vn')).toBe('hung-tran-x');
  });
});

describe('createAdminAccount role', () => {
  it('creates the requested role, and admin when none is given', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const boss = await createAdminAccount(planner, { email: 'boss@example.vn', displayName: 'Boss', handle: 'boss', role: 'super_admin' });
    const plain = await createAdminAccount(planner, { email: 'plain@example.vn', displayName: 'Plain', handle: 'plain' });
    expect(boss.role).toBe('super_admin');
    expect(plain.role).toBe('admin');
    const users = (await store.read()).users;
    expect(users.find((u) => u.handle === 'boss')?.role).toBe('super_admin');
    expect(users.find((u) => u.handle === 'plain')?.role).toBe('admin');
  });
});

describe('createAdminAccount', () => {
  it('creates an admin with a temporary password that must be changed', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    const result = await createAdminAccount(planner, {
      email: 'owner@example.vn',
      displayName: 'Hưng',
      handle: 'owner',
    });

    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    const stored = (await store.read()).users[0]!;
    expect(stored).toMatchObject({ handle: 'owner', role: 'admin', email: 'owner@example.vn', mustChangePassword: true });
    // Only a hash is stored, never the password itself.
    expect(JSON.stringify(stored)).not.toContain(result.temporaryPassword);
  });

  it('refuses an email or handle that already exists, without echoing the email', async () => {
    const planner = makePlanner({ store: createMemoryPlannerStore() });
    const args = { email: 'owner@example.vn', displayName: 'Hưng', handle: 'owner' };
    await createAdminAccount(planner, args);
    await expect(createAdminAccount(planner, { ...args, handle: 'other' })).rejects.toThrow(/already exists/);
    await expect(createAdminAccount(planner, { ...args, handle: 'other' })).rejects.not.toThrow(/owner@/);
  });

  it('rejects an invalid email or handle before touching the store', async () => {
    const store = createMemoryPlannerStore();
    const planner = makePlanner({ store });
    await expect(
      createAdminAccount(planner, { email: '<email của bạn>', displayName: 'Hưng', handle: 'owner' }),
    ).rejects.toThrow(/invalid email/);
    expect((await store.read()).users).toHaveLength(0);
  });
});
