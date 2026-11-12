import { z } from 'zod';

/**
 * Roles and the actions they may perform (ADR 0006, steps 1–2).
 *
 * Pure: no I/O, no imports from the planner. Nothing in the request path calls
 * `can` yet — admin routes are still gated by `ADMIN_API_TOKEN` alone. The map
 * exists so the later steps have one place to widen, and so tests pin it now.
 */
export const roleSchema = z.enum(['member', 'editor', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export type Action =
  | 'user:provision'
  | 'user:promote'
  | 'template:write'
  | 'story:publish'
  | 'content:write'
  | 'trip:support-read';

export type Principal = { role: Role | 'service' };

const EDITOR_ACTIONS = ['template:write', 'story:publish', 'content:write'] as const satisfies readonly Action[];

/**
 * `trip:support-read` is a reserved name denied to every principal (ADR 0006
 * decision 3): granting it later has to be an explicit, recorded decision.
 */
export const ROLE_ACTIONS: Record<Role | 'service', readonly Action[]> = {
  member: [],
  editor: EDITOR_ACTIONS,
  admin: [...EDITOR_ACTIONS, 'user:provision', 'user:promote'],
  service: ['user:provision', 'user:promote', ...EDITOR_ACTIONS],
};

/** The one place an absent stored role reads as `member`. Never writes. */
export function userRole(user: { role?: Role | null | undefined }): Role {
  return user.role ?? 'member';
}

export function can(principal: Principal, action: Action): boolean {
  const allowed = (ROLE_ACTIONS as Record<string, readonly Action[] | undefined>)[
    principal.role
  ];
  return Array.isArray(allowed) && allowed.includes(action);
}
