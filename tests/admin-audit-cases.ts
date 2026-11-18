import { expect, it, vi } from 'vitest';
import type { PlannerRepository } from '../src/server/planner/repository';
import type { PlannerStore } from '../src/server/planner/store';

/**
 * P07-13 admin events, written once and run on every store: memory in
 * `admin-audit.test.ts`, PostgreSQL in the integration file.
 */
export interface AuditCtx {
  planner: PlannerRepository;
  store: PlannerStore;
}

export function registerAuditCases(setup: () => Promise<AuditCtx>): void {
  const events = async (ctx: AuditCtx) => (await ctx.store.read()).auditEvents;
  const shape = (rows: Awaited<ReturnType<typeof events>>) =>
    rows.map((e) => `${e.action}:${e.fromStatus ?? ''}>${e.toStatus ?? ''}`);

  async function seed(ctx: AuditCtx) {
    const admin = await ctx.planner.createUser({ handle: 'boss', displayName: 'Sếp', role: 'super_admin' });
    const actor = { userId: admin.user.id };
    const target = await ctx.planner.createUser({ handle: 'khach', displayName: 'Khách', email: 'khach@example.com', role: 'member' }, actor);
    return { actor, adminId: admin.user.id, targetId: target.user.id };
  }

  it('writes one event per successful act, none on a no-op or a failure', async () => {
    const ctx = await setup();
    const { actor, adminId, targetId } = await seed(ctx);
    // service-token create (no actor) is an event too; admin was created without actor.
    await ctx.planner.setUserRole(targetId, 'editor', actor);
    await ctx.planner.setUserRole(targetId, 'editor', actor); // no-op
    await ctx.planner.resetUserPassword(targetId, actor);
    await ctx.planner.changeAccountState(targetId, 'ban', actor);
    await ctx.planner.changeAccountState(targetId, 'ban', actor); // no-op
    await ctx.planner.changeAccountState(targetId, 'unban', actor);
    await ctx.planner.changeAccountState(targetId, 'delete', actor);
    await ctx.planner.changeAccountState(targetId, 'restore', actor);
    await expect(ctx.planner.setUserRole(adminId, 'member', actor)).rejects.toThrow(); // self
    await ctx.planner.rotateUserToken(targetId);
    await ctx.planner.changeAccountState(targetId, 'delete', actor);
    await ctx.planner.deleteUser(targetId, actor);
    const rows = await events(ctx);
    expect(shape(rows)).toEqual([
      'user_create:>super_admin',
      'user_create:>member',
      'role_change:member>editor',
      'password_reset:>',
      'ban:active>banned',
      'unban:banned>active',
      'soft_delete:active>deleted',
      'restore:deleted>active',
      'token_rotate:>',
      'soft_delete:active>deleted',
      'purge:deleted>',
    ]);
    expect(rows[0]!.actorId).toBe('service');
    expect(rows[2]).toMatchObject({ actorId: actor.userId, actorKind: 'user', targetKind: 'user', targetId });
    expect(rows[8]).toMatchObject({ actorId: 'service', actorKind: 'service' });
  });

  it('records a Google unlink only when a link existed', async () => {
    const ctx = await setup();
    const { targetId } = await seed(ctx);
    await ctx.planner.unlinkGoogle(targetId);
    expect((await events(ctx)).filter((e) => e.action === 'google_unlink')).toHaveLength(0);
  });

  it('keeps the change and its event together: a forced failure leaves neither', async () => {
    const ctx = await setup();
    const { actor, targetId } = await seed(ctx);
    const before = JSON.stringify(await ctx.store.read());
    const original = ctx.store.transact.bind(ctx.store);
    const spy = vi.spyOn(ctx.store, 'transact').mockImplementation((fn) =>
      original(async (data) => {
        await fn(data);
        throw new Error('forced');
      }),
    );
    await expect(ctx.planner.setUserRole(targetId, 'admin', actor)).rejects.toThrow('forced');
    spy.mockRestore();
    expect(JSON.stringify(await ctx.store.read())).toBe(before);
  });

  it('never stores an email, a password or a token in an event', async () => {
    const ctx = await setup();
    const { actor, targetId } = await seed(ctx);
    const reset = await ctx.planner.resetUserPassword(targetId, actor);
    const rotated = await ctx.planner.rotateUserToken(targetId);
    const blob = JSON.stringify(await events(ctx));
    expect(blob).not.toContain('khach@example.com');
    expect(blob).not.toContain(reset.temporaryPassword);
    expect(blob).not.toContain(rotated.accessToken);
  });

  it('lists newest first, filters, and pages by cursor without overlap', async () => {
    const ctx = await setup();
    const { actor, targetId } = await seed(ctx);
    await ctx.planner.setUserRole(targetId, 'editor', actor);
    await ctx.planner.changeAccountState(targetId, 'ban', actor);
    await ctx.planner.changeAccountState(targetId, 'unban', actor);
    const { decodeAuditCursor } = await import('../src/server/planner/repository');
    const all = await ctx.planner.listAuditEvents({ limit: 100 });
    expect(all.nextCursor).toBeNull();
    expect(all.items).toHaveLength(5);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof ctx.planner.listAuditEvents>> = await ctx.planner.listAuditEvents({ limit: 2, cursor: cursor ? decodeAuditCursor(cursor) : null });
      seen.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.items.map((e) => e.id));
    expect(new Set(seen).size).toBe(5);
    const bans = await ctx.planner.listAuditEvents({ limit: 10, action: 'ban' });
    expect(bans.items.map((e) => e.action)).toEqual(['ban']);
    const byActor = await ctx.planner.listAuditEvents({ limit: 10, actor: actor.userId });
    expect(byActor.items).toHaveLength(4);
    expect(byActor.items[0]!.actorHandle).toBe('boss');
    expect((await ctx.planner.listAuditEvents({ limit: 10, targetType: 'story' })).items).toEqual([]);
    expect((await ctx.planner.listAuditEvents({ limit: 10, from: '2999-01-01T00:00:00.000Z' })).items).toEqual([]);
  });
}
