import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/** A failed Planner API call, reduced to what the UI branches on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds: number | null,
    /** Field paths named by a 422 `issues` list; the messages stay on the server. */
    readonly issuePaths: string[] = [],
    /** Stable sub-reason of a 409 refusal, when the server names one. */
    readonly reason: string | null = null,
    /** Non-identifying numbers a refusal may carry (e.g. `place_in_use` counts). */
    readonly details: Record<string, number> | null = null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Trip version (number) or content `updatedAt` stamp (string) for `If-Match`. */
  version?: number | string;
}

/**
 * Same-origin call to the Planner API. The session lives in an HttpOnly cookie
 * the browser attaches itself; nothing credential-shaped is ever read or stored
 * here. Resolves `undefined` for a 204.
 */
export async function api<T = undefined>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.version !== undefined) headers['if-match'] = `"${options.version}"`;

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let code = 'error';
    let issuePaths: string[] = [];
    let reason: string | null = null;
    let details: Record<string, number> | null = null;
    try {
      const data = (await response.json()) as { error?: { code?: string; reason?: string; details?: { counts?: Record<string, unknown> }; issues?: { path?: string }[] } };
      code = data.error?.code ?? code;
      reason = typeof data.error?.reason === 'string' ? data.error.reason : null;
      const counts = data.error?.details?.counts;
      if (counts && typeof counts === 'object') {
        details = Object.fromEntries(
          Object.entries(counts).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
        );
      }
      issuePaths = (data.error?.issues ?? []).flatMap((issue) => (typeof issue.path === 'string' ? [issue.path] : []));
    } catch {
      // Non-JSON error body: keep the generic code.
    }
    // A temporary password is pending (ADR 0007): every Planner call but the
    // change itself is refused, so send the browser to change it and come back.
    if (response.status === 403 && code === 'password_change_required') {
      goToChangePassword();
    }
    const retry = Number(response.headers.get('retry-after'));
    throw new ApiError(response.status, code, Number.isFinite(retry) && retry > 0 ? retry : null, issuePaths, reason, details);
  }

  return (await response.json()) as T;
}

/** Localized sign-in URL that returns here afterwards. Client-only. */
export function signInUrl(locale: Locale): string {
  const returnTo = window.location.pathname + window.location.search;
  return `${getPathname({ href: '/sign-in', locale })}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Localized change-password URL that returns to `returnTo` afterwards. */
export function changePasswordUrl(locale: Locale, returnTo: string): string {
  return `${getPathname({ href: '/account/password', locale })}?returnTo=${encodeURIComponent(returnTo)}`;
}

function goToChangePassword(): void {
  const { pathname, search } = window.location;
  const locale: Locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi';
  // A full navigation on purpose: server-rendered state must be fresh.
  window.location.assign(changePasswordUrl(locale, pathname + search));
}

export function goToSignIn(locale: Locale): void {
  window.location.assign(signInUrl(locale));
}
