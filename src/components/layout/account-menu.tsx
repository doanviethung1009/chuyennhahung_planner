'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';

/** The slice of `GET /api/planner/session`'s `user` the header needs. */
interface SessionUser {
  displayName: string;
  role: 'member' | 'editor' | 'admin' | 'super_admin';
  hasPassword: boolean;
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed-in'; user: SessionUser };

/**
 * Who is signed in, read in the browser after the page loads.
 *
 * Deliberately a client fetch, not a server cookie read: reading the cookie in
 * the layout would make every page dynamic and uncacheable, for a control the
 * first paint can live without. A 401 (or any failure) reads as a guest. Plain
 * `fetch`, not the Planner `api()` helper, so a failure here never redirects.
 */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/planner/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { user?: Partial<SessionUser> };
        const user = data.user;
        if (!user || typeof user.displayName !== 'string') return null;
        return {
          displayName: user.displayName,
          role: user.role ?? 'member',
          hasPassword: user.hasPassword === true,
        } satisfies SessionUser;
      })
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        setState(user ? { status: 'signed-in', user } : { status: 'guest' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Localized sign-in URL that brings the visitor back to this page. */
function signInHref(locale: Locale): string {
  const base = getPathname({ href: '/sign-in', locale });
  const here = window.location.pathname + window.location.search;
  return `${base}?returnTo=${encodeURIComponent(here)}`;
}

/** Signs out, then lands on the home page with fresh server state. */
function useSignOut() {
  const locale = useLocale() as Locale;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch('/api/planner/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(String(response.status));
      // A full navigation on purpose: every client island re-reads the session.
      window.location.assign(getPathname({ href: '/', locale }));
    } catch {
      setPending(false);
      setFailed(true);
    }
  };

  return { signOut, pending, failed };
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="size-5 shrink-0"
    >
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20c.9-3.6 3.8-5.5 7.25-5.5s6.35 1.9 7.25 5.5" />
    </svg>
  );
}

function initial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || '·';
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary text-sm font-semibold text-primary-foreground"
    >
      {initial(name)}
    </span>
  );
}

const itemClass =
  'flex min-h-11 w-full items-center rounded-md px-3 text-left text-[0.9375rem] font-medium text-ink-800 transition-colors duration-200 ease-gentle hover:bg-surface hover:text-primary-strong disabled:cursor-wait disabled:opacity-60';

/**
 * Desktop header control: a "Sign in" link for a guest; for a signed-in user,
 * a button with their name that discloses a short list of account links.
 * A disclosure (not an ARIA `menu`): links stay links, Tab works as usual,
 * and the arrow keys move between the entries as a convenience.
 */
export function AccountMenu({ state }: { state: AccountState }) {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { signOut, pending, failed } = useSignOut();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  // Nothing until the session is known: no flash of "Sign in" for a member.
  if (state.status === 'loading') return null;

  if (state.status === 'guest') {
    return (
      // Icon-only: the header row is capped at `max-w-7xl`, and the six nav
      // entries already fill it, so a text label wraps them onto two lines.
      // The label is the accessible name and the hover tooltip; the mobile
      // drawer shows it in full.
      <a
        href={signInHref(locale)}
        aria-label={t('signIn')}
        title={t('signIn')}
        className={buttonClass({ variant: 'secondary', size: 'sm', className: 'size-11 px-0' })}
      >
        <PersonIcon />
      </a>
    );
  }

  const { user } = state;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const panel = rootRef.current?.querySelector<HTMLElement>(`[id="${panelId}"]`);
    if (!panel) {
      if (event.key === 'ArrowDown' && document.activeElement === toggleRef.current) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    const items = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? items[(index + 1) % items.length]
        : items[(index - 1 + items.length) % items.length];
    next?.focus();
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('accountMenu', { name: user.displayName })}
        title={user.displayName}
        onClick={() => setOpen((value) => !value)}
        // Avatar only, same 44px footprint as the guest icon: a name or a
        // chevron wraps the nav entries onto two lines.
        className={`inline-flex size-11 items-center justify-center rounded-pill border bg-surface transition-colors duration-200 ease-gentle hover:border-primary ${
          open ? 'border-primary' : 'border-border-strong'
        }`}
      >
        <Avatar name={user.displayName} />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-full right-0 z-50 mt-2 w-64 rounded-md border border-border-subtle bg-background p-2 shadow-lift"
        >
          <p className="px-3 pt-1 pb-2 text-sm break-words text-foreground-muted">
            {t('signedInAs', { name: user.displayName })}
          </p>
          <AccountLinks user={user} onNavigate={() => setOpen(false)} />
          <div className="mt-1 border-t border-border-subtle pt-1">
            <button type="button" onClick={signOut} disabled={pending} className={itemClass}>
              {pending ? t('signingOut') : t('signOut')}
            </button>
            {failed ? (
              <p role="alert" className="px-3 pb-1 text-sm text-primary-strong">
                {t('signOutFailed')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountLinks({
  user,
  onNavigate,
  className = itemClass,
}: {
  user: SessionUser;
  onNavigate: () => void;
  className?: string;
}) {
  const t = useTranslations('nav');
  return (
    <ul className="grid">
      <li>
        <Link href="/my-trips" onClick={onNavigate} className={className}>
          {t('myTrips')}
        </Link>
      </li>
      {/* A Google-only account has no password to change. */}
      {user.hasPassword ? (
        <li>
          <Link href="/account/password" onClick={onNavigate} className={className}>
            {t('changePassword')}
          </Link>
        </li>
      ) : null}
      {user.role === 'admin' || user.role === 'super_admin' ? (
        <li>
          <Link href="/admin" onClick={onNavigate} className={className}>
            {t('admin')}
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

const drawerItemClass =
  'flex min-h-14 w-full items-center border-b border-border-subtle text-left text-lg font-medium text-ink-800 disabled:cursor-wait disabled:opacity-60';

/** The same entries, laid out for the mobile drawer. */
export function AccountDrawerSection({ state, onNavigate }: { state: AccountState; onNavigate: () => void }) {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const { signOut, pending, failed } = useSignOut();

  if (state.status === 'loading') return null;

  if (state.status === 'guest') {
    return (
      <div className="px-5 pt-2">
        <a
          href={signInHref(locale)}
          onClick={onNavigate}
          className={buttonClass({ variant: 'secondary', size: 'lg', className: 'w-full' })}
        >
          {t('signIn')}
        </a>
      </div>
    );
  }

  const { user } = state;
  return (
    <section aria-label={t('accountMenu', { name: user.displayName })} className="px-5 pt-4">
      <p className="flex items-center gap-3 pb-1 text-base text-foreground-muted">
        <Avatar name={user.displayName} />
        <span className="min-w-0 break-words">{t('signedInAs', { name: user.displayName })}</span>
      </p>
      <AccountLinks user={user} onNavigate={onNavigate} className={drawerItemClass} />
      <button type="button" onClick={signOut} disabled={pending} className={drawerItemClass}>
        {pending ? t('signingOut') : t('signOut')}
      </button>
      {failed ? (
        <p role="alert" className="pt-2 text-sm text-primary-strong">
          {t('signOutFailed')}
        </p>
      ) : null}
    </section>
  );
}
