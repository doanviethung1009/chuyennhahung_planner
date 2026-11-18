import { ContentError, notFound } from '@/server/content/errors';
import { canManageRole, userRole } from '@/server/identity/permissions';
import type { AdminPrincipal } from './http';
import type { PlannerRepository } from './repository';

/**
 * ADR 0017 §3 for the routes whose repository methods do not check it: a
 * session actor reaches an admin or super admin account only as a super admin.
 * The service token is not narrowed. Looks the target up before anything is
 * written, so a refusal changes nothing.
 */
export async function assertMayManageUser(
  repository: PlannerRepository,
  principal: AdminPrincipal,
  userId: string,
  options: { refuseSelf?: boolean } = {},
): Promise<void> {
  if (principal.kind !== 'session') return;
  // Rotating ends every session of the account: the actor would lock themselves
  // out and lose the new token on reload. Same 409 reason as the other self-acts.
  if (options.refuseSelf && principal.userId === userId) {
    throw new ContentError(
      'invalid_state',
      'an admin session cannot rotate its own token; ask another admin',
      [],
      null,
      'self_action',
    );
  }
  const target = (await repository.listUsers()).find((user) => user.id === userId);
  if (!target) throw notFound('planner user', userId);
  if (!canManageRole(principal.role, userRole(target))) {
    throw new ContentError(
      'forbidden',
      'only a super admin can manage admin and super admin accounts',
      [],
      null,
      'manage_role',
    );
  }
}
