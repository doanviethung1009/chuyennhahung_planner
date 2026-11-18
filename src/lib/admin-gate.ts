import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { can, type Principal } from '@/server/identity/permissions';
import { readStaffPageAccess } from '@/server/planner/admin-page';

/**
 * Server-side gate shared by every admin page (ADR 0010 §7, ADR 0011 §5).
 * Anonymous -> sign-in and back; temporary password -> change it and back;
 * a role with nothing to do here -> a plain 404. Returns what the shell needs
 * to decide which sections to show. The API stays the authority.
 */
export async function requireStaff(locale: Locale, returnTo: string, need: 'content' | 'users' | 'runbook' | 'audit' | 'any' = 'any') {
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
    (need === 'runbook' && !canRunbook) ||
    (need === 'audit' && !can(access.principal, 'audit:read'))
  ) {
    notFound();
  }
  return { principal: access.principal, canUsers, canContent, canRunbook };
}

/** Admin pages are never indexed, whatever the metadata helper says. */
export function noIndex(metadata: Metadata): Metadata {
  return { ...metadata, robots: { index: false, follow: false } };
}

/** One sidebar link: the internal route plus the message key under `adminContent.nav`. */
export type AdminLinkKey = 'overview' | 'stories' | 'places' | 'reviews' | 'collections' | 'templates' | 'integrity' | 'community' | 'users' | 'runbook' | 'system' | 'audit';
export type AdminGroupId = 'overview' | 'content' | 'community' | 'people' | 'operations';
export type AdminNavLink = { href: StaticPathname; label: AdminLinkKey };
export type AdminNavGroup = { id: AdminGroupId; links: AdminNavLink[] };

/**
 * What the admin sidebar shows for a principal (ADR 0020 §2). A pure function
 * of `can`: it only hides links, it never authorizes — every page and API call
 * checks the role again. A group with no visible link is dropped; Media stays
 * unrendered until Phase 08. Link `label`s are keys under `adminContent.nav`.
 */
export function adminSidebarGroups(principal: Principal): AdminNavGroup[] {
  const content = can(principal, 'content:write');
  const groups: AdminNavGroup[] = [
    { id: 'overview', links: [{ href: '/admin', label: 'overview' }] },
    {
      id: 'content',
      links: content
        ? [
            { href: '/admin/content/stories', label: 'stories' },
            { href: '/admin/content/places', label: 'places' },
            { href: '/admin/content/reviews', label: 'reviews' },
            { href: '/admin/content/collections', label: 'collections' },
            { href: '/admin/content/templates', label: 'templates' },
            { href: '/admin/content/integrity', label: 'integrity' },
          ]
        : [],
    },
    {
      id: 'community',
      // The community page itself is gated on `content:write` (ADR 0014).
      links: content ? [{ href: '/admin/community', label: 'community' }] : [],
    },
    {
      id: 'people',
      links: can(principal, 'user:provision') ? [{ href: '/admin/users', label: 'users' }] : [],
    },
    {
      id: 'operations',
      links: [
        ...(can(principal, 'audit:read') ? [{ href: '/admin/audit' as const, label: 'audit' as const }] : []),
        ...(can(principal, 'runbook:read') ? [{ href: '/admin/runbook' as const, label: 'runbook' as const }] : []),
        ...(can(principal, 'runbook:read') ? [{ href: '/admin/system' as const, label: 'system' as const }] : []),
      ],
    },
  ];
  return groups.filter((group) => group.links.length > 0);
}
