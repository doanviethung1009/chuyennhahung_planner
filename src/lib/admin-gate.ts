import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { can } from '@/server/identity/permissions';
import { readStaffPageAccess } from '@/server/planner/admin-page';

/**
 * Server-side gate shared by every admin page (ADR 0010 §7, ADR 0011 §5).
 * Anonymous -> sign-in and back; temporary password -> change it and back;
 * a role with nothing to do here -> a plain 404. Returns what the shell needs
 * to decide which sections to show. The API stays the authority.
 */
export async function requireStaff(locale: Locale, returnTo: string, need: 'content' | 'users' | 'runbook' | 'any' = 'any') {
  const access = await readStaffPageAccess();
  if (access.status === 'anonymous') {
    redirect({ href: { pathname: '/sign-in', query: { returnTo } }, locale });
  }
  if (access.status === 'must-change-password') {
    redirect({ href: { pathname: '/account/password', query: { returnTo } }, locale });
  }
  if (access.status !== 'staff') notFound();

  const canUsers = can(access.principal, 'user:provision');
  const canContent = can(access.principal, 'content:write');
  // ADR 0017: the Runbook belongs to the super admin alone.
  const canRunbook = can(access.principal, 'runbook:read');
  if (
    (need === 'content' && !canContent) ||
    (need === 'users' && !canUsers) ||
    (need === 'runbook' && !canRunbook)
  ) {
    notFound();
  }
  return { principal: access.principal, canUsers, canContent, canRunbook };
}

/** Admin pages are never indexed, whatever the metadata helper says. */
export function noIndex(metadata: Metadata): Metadata {
  return { ...metadata, robots: { index: false, follow: false } };
}
