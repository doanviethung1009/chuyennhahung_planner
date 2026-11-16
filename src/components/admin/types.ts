/** Shapes of the admin users API (`docs/adr/0010-...`), reduced to what the UI reads. */
export type AdminRole = 'member' | 'editor' | 'admin' | 'super_admin';

export const ADMIN_ROLES: readonly AdminRole[] = ['member', 'editor', 'admin', 'super_admin'];

/** Roles `actor` may hand out or edit (ADR 0017): an admin reaches only member and editor. */
export function assignableRoles(actor: AdminRole): AdminRole[] {
  // Mirrors `canManageRole` in `src/server/identity/permissions.ts` (a client
  // file may not import server modules); the API stays the authority.
  if (actor === 'super_admin') return [...ADMIN_ROLES];
  return actor === 'admin' ? ['member', 'editor'] : [];
}

/** What the staff can do to an account (ADR 0017). `purge` = permanent delete. */
export type AccountAction = 'ban' | 'unban' | 'delete' | 'restore' | 'purge';

export interface AdminUser {
  id: string;
  handle: string;
  displayName: string;
  email?: string | null;
  role?: AdminRole;
  bannedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

/** What a permanent delete removes with the account (GET .../impact). */
export interface AccountImpact {
  trips: number;
  reviews: number;
}

/** A one-time credential set, held in component state only. */
export interface OneTimeSecret {
  key: string;
  handle: string;
  accessToken?: string;
  temporaryPassword?: string;
}
