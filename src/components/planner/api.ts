import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/** A failed Planner API call, reduced to what the UI branches on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Trip version for `If-Match`. */
  version?: number;
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
    try {
      const data = (await response.json()) as { error?: { code?: string } };
      code = data.error?.code ?? code;
    } catch {
      // Non-JSON error body: keep the generic code.
    }
    // A temporary password is pending (ADR 0007): every Planner call but the
    // change itself is refused, so send the browser to change it and come back.
    if (response.status === 403 && code === 'password_change_required') {
      goToChangePassword();
    }
    const retry = Number(response.headers.get('retry-after'));
    throw new ApiError(response.status, code, Number.isFinite(retry) && retry > 0 ? retry : null);
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
