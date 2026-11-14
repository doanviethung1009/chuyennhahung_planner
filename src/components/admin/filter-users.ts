import type { AdminRole, AdminUser } from './types';

export type RoleFilter = 'all' | AdminRole;

/** Lower-case, strip Vietnamese diacritics (đ included) so "hung" finds "Hưng". */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/** Client-side filter over the already-loaded list: name, handle or email, and role. */
export function filterUsers(users: AdminUser[], query: string, role: RoleFilter): AdminUser[] {
  const needle = normalizeSearch(query);
  return users.filter((user) => {
    if (role !== 'all' && (user.role ?? 'member') !== role) return false;
    if (!needle) return true;
    return [user.displayName, user.handle, user.email ?? ''].some((field) =>
      normalizeSearch(field).includes(needle),
    );
  });
}
