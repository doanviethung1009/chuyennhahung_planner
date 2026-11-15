import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/server/content/errors';
import { SESSION_COOKIE } from '../src/server/planner/auth';
import { daLatTripInput, makePlanner } from './planner-helpers';

/** ADR 0017: ban, soft delete, restore and permanent delete of staff accounts. */
async function seed() {
  const planner = makePlanner();
  const mk = async (handle: string, role: 'member' | 'editor' | 'admin' | 'super_admin') => {
    const issued = await planner.createUser({ handle, displayName: handle, role, email: `${handle}@example.test` });
    return { id: issued.user.id, token: issued.accessToken, password: issued.temporaryPassword! };
  };
  return {
    planner,
    superA: await mk('super-a', 'super_admin'),
    superB: await mk('super-b', 'super_admin'),
    admin: await mk('admin-a', 'admin'),
    admin2: await mk('admin-b', 'admin'),
    editor: await mk('editor-a', 'editor'),
    member: await mk('member-a', 'member'),
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
const cookie = (token: string) =>
  new Request('http://x.test/', { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
const bearer = (token: string) =>
  new Request('http://x.test/', { headers: { authorization: `Bearer ${token}` } });

describe('ban', () => {
  it('ends open sessions and blocks cookie, token, password and Google sign-in; unban restores', async () => {
    const { planner, editor, admin } = await seed();
    const session = await planner.signIn(editor.token);
    expect((await planner.identify(cookie(session.token))).userId).toBe(editor.id);

    await planner.linkGoogle(editor.id, { sub: 'g-sub-1', email: 'editor-g@gmail.com', emailVerified: true, name: 'E' } as never);
    const banned = await planner.changeAccountState(editor.id, 'ban', { userId: admin.id });
    expect(banned.bannedAt).toBeTruthy();
    expect(await code(planner.identify(cookie(session.token)))).toBe('unauthorized');
    expect(await code(planner.identify(bearer(editor.token)))).toBe('unauthorized');
    expect(await code(planner.signIn(editor.token))).toBe('unauthorized');
    expect(await code(planner.signInWithPassword('editor-a@example.test', editor.password))).toBe('unauthorized');
    // Defence in depth: a request already past identify cannot link Google either.
    expect(await code(planner.linkGoogle(editor.id, { sub: 'g-sub-2', email: 'x@gmail.com', emailVerified: true, name: 'E' } as never))).toBe('not_found');

    // Google: a disabled account reads as not found, with no signup around it.
    expect(await planner.signInWithGoogle({ sub: 'g-sub-1', email: 'editor-g@gmail.com', emailVerified: true, name: 'E' } as never, { signupEnabled: true })).toEqual({ ok: false, reason: 'account_not_found' });

    await planner.changeAccountState(editor.id, 'unban', { userId: admin.id });
    expect(await code(planner.signIn(editor.token))).toBe('ok');
  });

  it('is idempotent and never bumps the state twice', async () => {
    const { planner, editor, admin } = await seed();
    const first = await planner.changeAccountState(editor.id, 'ban', { userId: admin.id });
    const again = await planner.changeAccountState(editor.id, 'ban', { userId: admin.id });
    expect(again.bannedAt).toBe(first.bannedAt);
  });

  it('refuses self, members, and an admin acting on admin/super_admin', async () => {
    const { planner, admin, admin2, superA, member } = await seed();
    expect(await code(planner.changeAccountState(admin.id, 'ban', { userId: admin.id }))).toBe('invalid_state');
    expect(await code(planner.changeAccountState(member.id, 'ban', { userId: admin.id }))).toBe('invalid_state');
    expect(await code(planner.changeAccountState(admin2.id, 'ban', { userId: admin.id }))).toBe('forbidden');
    expect(await code(planner.changeAccountState(superA.id, 'ban', { userId: admin.id }))).toBe('forbidden');
    expect(await code(planner.changeAccountState(admin2.id, 'ban', { userId: superA.id }))).toBe('ok');
  });

  it('keeps the last super admin and the last admin-capable account', async () => {
    const { planner, superA, superB, admin, admin2 } = await seed();
    await planner.changeAccountState(superB.id, 'ban', { userId: superA.id });
    expect(await code(planner.changeAccountState(superA.id, 'ban'))).toBe('invalid_state'); // service token too
    await planner.changeAccountState(admin.id, 'ban', { userId: superA.id });
    await planner.changeAccountState(admin2.id, 'ban', { userId: superA.id });
    expect(await code(planner.changeAccountState(superA.id, 'delete'))).toBe('invalid_state');
  });

  it('a banned actor cannot act, and a banned admin does not count as "another admin"', async () => {
    const { planner, superA, superB, admin, editor } = await seed();
    await planner.changeAccountState(admin.id, 'ban', { userId: superA.id });
    expect(await code(planner.changeAccountState(editor.id, 'ban', { userId: admin.id }))).toBe('forbidden');
    await planner.changeAccountState(superB.id, 'ban', { userId: superA.id });
    expect(await code(planner.setUserRole(superA.id, 'member'))).toBe('invalid_state');
  });
});

describe('soft delete, restore and permanent delete', () => {
  it('soft delete hides and blocks, keeps data, and restore undoes it', async () => {
    const { planner, editor, admin } = await seed();
    const trip = await planner.createTrip(editor.id, daLatTripInput());
    const deleted = await planner.changeAccountState(editor.id, 'delete', { userId: admin.id });
    expect(deleted.deletedAt).toBeTruthy();
    expect(await code(planner.signIn(editor.token))).toBe('unauthorized');
    expect((await planner.listUsers()).some((u) => u.id === editor.id)).toBe(true);
    expect((await planner.listTrips(editor.id)).map((t) => t.id)).toContain(trip.trip.id);
    await planner.changeAccountState(editor.id, 'restore', { userId: admin.id });
    expect(await code(planner.signIn(editor.token))).toBe('ok');
  });

  it('a session can purge only a soft-deleted staff account; the service token keeps the direct path', async () => {
    const { planner, editor, admin, member } = await seed();
    expect(await code(planner.deleteUser(editor.id, { userId: admin.id }))).toBe('invalid_state');
    await planner.changeAccountState(editor.id, 'delete', { userId: admin.id });
    expect(await code(planner.deleteUser(editor.id, { userId: admin.id }))).toBe('ok');
    expect((await planner.listUsers()).some((u) => u.id === editor.id)).toBe(false);
    // Members: no session path; service token deletes as before.
    expect(await code(planner.deleteUser(member.id, { userId: admin.id }))).toBe('invalid_state');
    expect(await code(planner.deleteUser(member.id))).toBe('ok');
  });

  it('refuses to purge yourself, or an admin as an admin', async () => {
    const { planner, admin, admin2, superA } = await seed();
    expect(await code(planner.deleteUser(admin.id, { userId: admin.id }))).toBe('invalid_state');
    await planner.changeAccountState(admin2.id, 'delete', { userId: superA.id });
    expect(await code(planner.deleteUser(admin2.id, { userId: admin.id }))).toBe('forbidden');
    expect(await code(planner.deleteUser(admin2.id, { userId: superA.id }))).toBe('ok');
  });
});
