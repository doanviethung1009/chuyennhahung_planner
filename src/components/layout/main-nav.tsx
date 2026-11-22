'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePathname } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import type { NavGroup, NavKey } from './nav-items';
import { buttonClass } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { AccountDrawerSection, AccountMenu, useAccount } from './account-menu';

export interface NavLink {
  key: NavKey;
  href: StaticPathname;
  label: string;
}

/** A group with its labels resolved on the server. */
export interface NavGroupView {
  key: NavGroup['key'];
  label: string;
  items: NavLink[];
}

export type NavEntryView = NavLink | NavGroupView;

function isGroupView(entry: NavEntryView): entry is NavGroupView {
  return 'items' in entry;
}

/** The header's call to action: where "start a trip" goes, and what it says. */
export interface Cta {
  href: StaticPathname;
  label: string;
}

interface Props {
  items: NavEntryView[];
  /** For a guest: the page that explains the planner. */
  guestCta: Cta;
  /** For a signed-in member: straight to creating a trip. */
  memberCta: Cta;
  openLabel: string;
  closeLabel: string;
  navLabel: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One desktop trigger that opens a short list of links. A disclosure (not an
 * ARIA `menu`): the entries stay ordinary links, Tab works as usual, Escape
 * closes and returns focus, and the arrow keys move between entries.
 */
function NavDropdown({ group, linkClass }: { group: NavGroupView; linkClass: (href: string) => string }) {
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  // Derived like the drawer: any navigation closes it.
  const open = openedAt !== null && openedAt === pathname;
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const active = group.items.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenedAt(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpenedAt(null);
      toggleRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = [...(rootRef.current?.querySelectorAll<HTMLElement>(`[id="${panelId}"] a`) ?? [])];
    if (!open) {
      if (event.key === 'ArrowDown' && document.activeElement === toggleRef.current) {
        event.preventDefault();
        setOpenedAt(pathname);
      }
      return;
    }
    if (links.length === 0) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? links[(index + 1) % links.length]
        : links[(index - 1 + links.length) % links.length];
    next?.focus();
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className={`${linkClass(active ? pathname : '')} gap-0.5`}
      >
        {group.label}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 shrink-0 transition-transform duration-200 ease-gentle ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {active ? (
          <span aria-hidden="true" className="absolute -bottom-0.5 left-0 h-px w-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <ul
          id={panelId}
          className="absolute top-full left-0 z-50 mt-2 grid w-56 gap-0.5 rounded-md border border-border-subtle bg-background p-2 shadow-lift"
        >
          {group.items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={() => setOpenedAt(null)}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-md px-3 text-[0.9375rem] font-medium transition-colors duration-200 ease-gentle hover:bg-surface hover:text-primary-strong ${
                  isActive(pathname, item.href) ? 'text-primary-strong' : 'text-ink-800'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MainNav({
  items,
  guestCta,
  memberCta,
  openLabel,
  closeLabel,
  navLabel,
}: Props) {
  const pathname = usePathname();
  const account = useAccount();
  const signedIn = account.status === 'signed-in';
  const cta = signedIn ? memberCta : guestCta;
  /**
   * We store the route the drawer was opened on rather than a boolean, so
   * `open` is derived during render: any navigation — including the browser
   * back button — closes the drawer without a state-setting effect.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;
  const close = () => setOpenedAt(null);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // While the drawer is open: lock scroll, close on Escape, and keep Tab
  // inside the panel so focus cannot wander behind the overlay.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Everything outside the header and the drawer becomes inert, so neither
    // Tab nor a screen reader can reach the page behind the overlay.
    const behind = [
      ...document.querySelectorAll<HTMLElement>('main, footer, body > a[href="#main"]'),
    ].filter((element) => !element.hasAttribute('inert'));
    behind.forEach((element) => element.setAttribute('inert', ''));

    // Move focus into the dialog (the panel itself, so no link looks "chosen").
    panelRef.current?.focus();

    // Resizing up to the desktop layout hides the drawer; drop its state too,
    // or the scroll lock above would outlive it.
    const desktop = window.matchMedia('(min-width: 80rem)');
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenedAt(null);
    };
    desktop.addEventListener('change', onBreakpoint);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenedAt(null);
        toggleRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      // The toggle sits in the header, outside the portalled panel, but stays
      // operable — it is the first stop of the focus loop.
      const focusable = [
        ...(toggleRef.current ? [toggleRef.current] : []),
        ...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      behind.forEach((element) => element.removeAttribute('inert'));
      desktop.removeEventListener('change', onBreakpoint);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const linkClass = (href: string) =>
    `relative inline-flex min-h-11 items-center whitespace-nowrap text-[0.9375rem] font-medium transition-colors duration-200 ease-gentle ${
      isActive(pathname, href)
        ? 'text-primary-strong'
        : 'text-ink-700 hover:text-primary-strong'
    }`;

  return (
    <>
      {/* ---------- Desktop ---------- */}
      {/* The inline row only fits from `xl` (1280px): below that the drawer is
          used. No "home" entry here, since the logo already goes home; the
          drawer keeps it. */}
      <nav aria-label={navLabel} className="hidden items-center gap-3 xl:flex 2xl:gap-7">
        {items
          .filter((item) => item.key !== 'home')
          .map((item) =>
            isGroupView(item) ? (
              <NavDropdown key={item.key} group={item} linkClass={linkClass} />
            ) : (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={linkClass(item.href)}
              >
                {item.label}
                {isActive(pathname, item.href) ? (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 left-0 h-px w-full bg-primary"
                  />
                ) : null}
              </Link>
            ),
          )}
      </nav>

      <div className="hidden items-center gap-2 xl:flex 2xl:gap-3">
        <LocaleSwitcher />
        <AccountMenu state={account} />
        {/* Until the session is known the slot is held but empty (hidden, out
            of the tab order): a member never sees "Plan your trip" turn into
            "Create a trip". With scripting off the guest link shows. */}
        <Link
          href={cta.href}
          {...(account.status === 'loading' ? { 'aria-hidden': true, tabIndex: -1 } : {})}
          className={buttonClass({
            size: 'sm',
            className: `px-3 whitespace-nowrap 2xl:px-4 ${
              account.status === 'loading' ? 'invisible [@media(scripting:none)]:visible' : ''
            }`,
          })}
        >
          {cta.label}
        </Link>
      </div>

      {/* ---------- Mobile trigger ---------- */}
      <div className="flex items-center gap-2 xl:hidden">
        <LocaleSwitcher />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpenedAt(open ? null : pathname)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex size-11 items-center justify-center rounded-pill border border-border-strong bg-surface text-ink-700"
        >
          <span className="sr-only">{open ? closeLabel : openLabel}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="size-5"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
            )}
          </svg>
        </button>
      </div>

      {/*
        ---------- Mobile drawer ----------
        Portalled to <body> on purpose: the header uses `backdrop-blur`, and a
        backdrop-filter makes that element the containing block for any
        `position: fixed` descendant — which collapsed this overlay to 0px tall.
      */}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 top-(--header-h) z-40 xl:hidden">
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={close}
                className="absolute inset-0 size-full cursor-default bg-ink-900/30"
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label={navLabel}
                tabIndex={-1}
                className="relative max-h-full overflow-y-auto border-t border-border-subtle bg-background shadow-lift outline-none"
              >
                <nav aria-label={navLabel} className="flex flex-col px-5 py-2">
                  {items.map((entry) =>
                    isGroupView(entry) ? (
                      <div key={entry.key} role="group" aria-label={entry.label} className="border-b border-border-subtle py-3">
                        <p aria-hidden="true" className="text-eyebrow font-display text-foreground-muted">
                          {entry.label}
                        </p>
                        {entry.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={close}
                            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                            className={`flex min-h-12 items-center text-lg font-medium ${
                              isActive(pathname, item.href) ? 'text-primary-strong' : 'text-ink-800'
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        key={entry.key}
                        href={entry.href}
                        onClick={close}
                        aria-current={isActive(pathname, entry.href) ? 'page' : undefined}
                        className={`flex min-h-14 items-center border-b border-border-subtle text-lg font-medium last:border-b-0 ${
                          isActive(pathname, entry.href) ? 'text-primary-strong' : 'text-ink-800'
                        }`}
                      >
                        {entry.label}
                      </Link>
                    ),
                  )}
                </nav>
                <AccountDrawerSection state={account} onNavigate={close} />
                <div className="px-5 pt-4 pb-6">
                  <Link
                    href={cta.href}
                    onClick={close}
                    className={buttonClass({ size: 'lg', className: 'w-full' })}
                  >
                    {cta.label}
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
