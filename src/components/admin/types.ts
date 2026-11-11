/** Shapes of the admin users API (`docs/adr/0010-...`), reduced to what the UI reads. */
export type AdminRole = 'member' | 'editor' | 'admin';

export const ADMIN_ROLES: readonly AdminRole[] = ['member', 'editor', 'admin'];

export interface AdminUser {
  id: string;
  handle: string;
  displayName: string;
  email?: string | null;
  role?: AdminRole;
  createdAt: string;
}

/** A one-time credential set, held in component state only. */
export interface OneTimeSecret {
  key: string;
  handle: string;
  accessToken?: string;
  temporaryPassword?: string;
}
