import { describe, expect, it } from 'vitest';
import { canManageRole, isAdminRole } from '../src/server/identity/permissions';
import { ContentError } from '../src/server/content/errors';
import { makePlanner } from './planner-helpers';

/** ADR 0017: the super admin role and the guards around it. */
async function seed() {
  const planner = makePlanner();
  const mk = async (handle: string, role: 'member' | 'editor' | 'admin' | 'super_admin', email?: string) =>
    (await planner.createUser({ handle, displayName: handle, role, ...(email ? { email } : {}) })).user.id;
  return {
    planner,
    superA: await mk('super-a', 'super_admin', 'a@example.test'),
    superB: await mk('super-b', 'super_admin', 'b@example.test'),
    admin: await mk('admin-a', 'admin', 'c@example.test'),
    editor: await mk('editor-a', 'editor', 'd@example.test'),
    member: await mk('member-a', 'member', 'e@example.test'),
  };
}

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof ContentError ? error.code : 'other';
  }
};

describe('role helpers', () => {
  it('canManageRole: admin reaches member and editor only', () => {
    expect(canManageRole('admin', 'member')).toBe(true);
    expect(canManageRole('admin', 'editor')).toBe(true);
    expect(canManageRole('admin', 'admin')).toBe(false);
    expect(canManageRole('admin', 'super_admin')).toBe(false);
    expect(canManageRole('super_admin', 'super_admin')).toBe(true);
    expect(canManageRole('service', 'super_admin')).toBe(true);
    expect(canManageRole('editor', 'member')).toBe(false);
    expect(canManageRole('member', 'member')).toBe(false);
  });

  it('isAdminRole covers admin and super_admin', () => {
    expect(['member', 'editor', 'admin', 'super_admin'].map((r) => isAdminRole(r as 'admin'))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

describe('admin session cannot escalate or take over', () => {
  it('cannot create a super_admin or admin, but can create an editor', async () => {
    const { planner, admin } = await seed();
    const base = { displayName: 'x' };
    expect(await code(planner.createUser({ ...base, handle: 'n1', role: 'super_admin' }, { userId: admin }))).toBe('forbidden');
    expect(await code(planner.createUser({ ...base, handle: 'n2', role: 'admin' }, { userId: admin }))).toBe('forbidden');
    expect(await code(planner.createUser({ ...base, handle: 'n3', role: 'editor' }, { userId: admin }))).toBe('ok');
  });

  it('cannot promote anyone to super_admin or change a super_admin role', async () => {
    const { planner, admin, member, superA } = await seed();
    expect(await code(planner.setUserRole(member, 'super_admin', { userId: admin }))).toBe('forbidden');
    expect(await code(planner.setUserRole(member, 'admin', { userId: admin }))).toBe('forbidden');
    expect(await code(planner.setUserRole(superA, 'member', { userId: admin }))).toBe('forbidden');
    expect(await code(planner.setUserRole(member, 'editor', { userId: admin }))).toBe('ok');
  });

  it('cannot reset the password of an admin-capable account', async () => {
    const { planner, admin, superA, editor } = await seed();
    expect(await code(planner.resetUserPassword(superA, { userId: admin }))).toBe('forbidden');
    expect((await planner.resetUserPassword(editor, { userId: admin })).temporaryPassword).toBeTruthy();
  });

  it('a demoted actor is refused inside the transaction', async () => {
    const { planner, admin, member, superA } = await seed();
    await planner.setUserRole(admin, 'member', { userId: superA });
    expect(await code(planner.setUserRole(member, 'editor', { userId: admin }))).toBe('forbidden');
  });
});

describe('super admin powers and the last-super-admin guard', () => {
  it('a super admin can promote an admin and create another super admin', async () => {
    const { planner, superA, admin } = await seed();
    expect(await code(planner.setUserRole(admin, 'super_admin', { userId: superA }))).toBe('ok');
    expect(await code(planner.createUser({ handle: 'n9', displayName: 'x', role: 'super_admin' }, { userId: superA }))).toBe('ok');
  });

  it('the last super admin cannot be demoted or deleted, even by the service token', async () => {
    const { planner, superA, superB } = await seed();
    await planner.setUserRole(superB, 'admin'); // service token: no actor
    expect(await code(planner.setUserRole(superA, 'admin'))).toBe('invalid_state');
    expect(await code(planner.deleteUser(superA))).toBe('invalid_state');
    // With a second super admin back, the first may step down.
    await planner.setUserRole(superB, 'super_admin');
    expect(await code(planner.setUserRole(superA, 'admin'))).toBe('ok');
  });

  it('a super admin cannot change their own role', async () => {
    const { planner, superA } = await seed();
    expect(await code(planner.setUserRole(superA, 'member', { userId: superA }))).toBe('invalid_state');
  });
});
