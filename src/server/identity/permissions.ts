import { z } from 'zod';

/**
 * Roles and the actions they may perform (ADR 0006, steps 1–2).
 *
 * Pure: no I/O, no imports from the planner. Nothing in the request path calls
 * `can` yet — admin routes are still gated by `ADMIN_API_TOKEN` alone. The map
 * exists so the later steps have one place to widen, and so tests pin it now.
 */
export const roleSchema = z.enum(['member', 'editor', 'admin', 'super_admin']);
export type Role = z.infer<typeof roleSchema>;

export type Action =
  | 'user:provision'
  | 'user:promote'
  | 'template:write'
  | 'story:publish'
  | 'content:write'
  | 'community:moderate'
  | 'community:restrict'
  | 'runbook:read'
  | 'trip:support-read';

export type Principal = { role: Role | 'service' };

const EDITOR_ACTIONS = [
  'template:write',
  'story:publish',
  'content:write',
  'community:moderate',
] as const satisfies readonly Action[];

/**
 * `trip:support-read` is a reserved name denied to every principal (ADR 0006
 * decision 3): granting it later has to be an explicit, recorded decision.
 */
export const ROLE_ACTIONS: Record<Role | 'service', readonly Action[]> = {
  member: [],
  editor: EDITOR_ACTIONS,
  // `community:restrict` (ADR 0015) switches a person off: heavier than removing one review, so not for editors.
  admin: [...EDITOR_ACTIONS, 'user:provision', 'user:promote', 'community:restrict'],
  // ADR 0017: everything an admin can do, plus the operations Runbook.
  super_admin: [
    ...EDITOR_ACTIONS,
    'user:provision',
    'user:promote',
    'community:restrict',
    'runbook:read',
  ],
  service: ['user:provision', 'user:promote', 'community:restrict', ...EDITOR_ACTIONS],
};

/** The one place an absent stored role reads as `member`. Never writes. */
export function userRole(user: { role?: Role | null | undefined }): Role {
  return user.role ?? 'member';
}

/** Admin or super admin: the roles that run the admin portal (ADR 0017). */
export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Whether an actor may create, re-role or reset the password of an account
 * holding `target` (ADR 0017 §3). Only a super admin (or the service token)
 * touches admin or super admin accounts: an admin acting on one would be a
 * path to taking it over.
 */
export function canManageRole(actor: Role | 'service', target: Role): boolean {
  if (actor === 'service' || actor === 'super_admin') return true;
  return actor === 'admin' && (target === 'member' || target === 'editor');
}

export function can(principal: Principal, action: Action): boolean {
  const allowed = (ROLE_ACTIONS as Record<string, readonly Action[] | undefined>)[
    principal.role
  ];
  return Array.isArray(allowed) && allowed.includes(action);
}
