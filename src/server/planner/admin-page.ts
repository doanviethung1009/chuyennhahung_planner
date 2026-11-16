import { cache } from 'react';
import { cookies } from 'next/headers';
import { ContentError } from '@/server/content/errors';
import { can, type Role } from '@/server/identity/permissions';
import { SESSION_COOKIE } from './auth';
import { getPlannerRepository } from './instance';

/**
 * What a server component needs to decide about the admin page (ADR 0010 §7).
 * It reads the session cookie itself and applies the same rules as the API
 * guard, with the role re-read from the store.
 *
 * - `anonymous`: no cookie, or an invalid or expired session -> redirect to
 *   sign-in with `returnTo`.
 * - `must-change-password`: an admin on a temporary password -> redirect to
 *   the change-password page.
 * - `not-admin`: signed in without admin rights -> `notFound()`.
 * - `admin`: render, with the principal.
 */
export type AdminPageAccess =
  | { status: 'anonymous' }
  | { status: 'must-change-password' }
  | { status: 'not-admin' }
  | {
      status: 'admin';
      principal: { kind: 'session'; userId: string; handle: string; role: Role };
    };

export async function readAdminPageAccess(): Promise<AdminPageAccess> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: 'anonymous' };

  // Only the cookie is forwarded: no Authorization header can reach `identify`.
  const request = new Request('http://admin-page.internal/', {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });

  try {
    const identity = await (await getPlannerRepository()).identify(request);
    if (identity.source !== 'cookie') return { status: 'anonymous' };
    if (!can({ role: identity.role }, 'user:provision')) return { status: 'not-admin' };
    if (identity.passwordChangeRequired) return { status: 'must-change-password' };
    return {
      status: 'admin',
      principal: {
        kind: 'session',
        userId: identity.userId,
        handle: identity.handle,
        role: identity.role,
      },
    };
  } catch (error) {
    if (error instanceof ContentError && error.code === 'unauthorized') {
      return { status: 'anonymous' };
    }
    throw error;
  }
}

/**
 * Page gate for the whole admin shell (ADR 0011 §5): any role that can do
 * something there. `forbidden` -> `notFound()`; the shell hides sections by
 * `can(role, ...)`, but the API stays the authority.
 */
export type StaffPageAccess =
  | { status: 'anonymous' }
  | { status: 'must-change-password' }
  | { status: 'forbidden' }
  | {
      status: 'staff';
      principal: { kind: 'session'; userId: string; handle: string; role: Role };
    };

export const readStaffPageAccess = cache(async (): Promise<StaffPageAccess> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: 'anonymous' };

  const request = new Request('http://admin-page.internal/', {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });

  try {
    const identity = await (await getPlannerRepository()).identify(request);
    if (identity.source !== 'cookie') return { status: 'anonymous' };
    const principal = { role: identity.role };
    if (!can(principal, 'user:provision') && !can(principal, 'content:write')) {
      return { status: 'forbidden' };
    }
    if (identity.passwordChangeRequired) return { status: 'must-change-password' };
    return {
      status: 'staff',
      principal: {
        kind: 'session',
        userId: identity.userId,
        handle: identity.handle,
        role: identity.role,
      },
    };
  } catch (error) {
    if (error instanceof ContentError && error.code === 'unauthorized') {
      return { status: 'anonymous' };
    }
    throw error;
  }
});
