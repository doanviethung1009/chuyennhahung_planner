'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePathname } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import type { NavKey } from './nav-items';
import { buttonClass } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { AccountDrawerSection, AccountMenu, useAccount } from './account-menu';

export interface NavLink {
  key: NavKey;
  href: StaticPathname;
  label: string;
}

interface Props {
  items: NavLink[];
  planLabel: string;
  planHref: StaticPathname;
  openLabel: string;
  closeLabel: string;
  navLabel: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({
  items,
  planLabel,
  planHref,
  openLabel,
  closeLabel,
  navLabel,
}: Props) {
  const pathname = usePathname();
  const account = useAccount();
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
    const desktop = window.matchMedia('(min-width: 64rem)');
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
    `relative inline-flex min-h-11 items-center text-[0.9375rem] font-medium transition-colors duration-200 ease-gentle ${
      isActive(pathname, href)
        ? 'text-primary-strong'
        : 'text-ink-700 hover:text-primary-strong'
    }`;

  return (
    <>
      {/* ---------- Desktop ---------- */}
      <nav aria-label={navLabel} className="hidden items-center gap-7 lg:flex">
        {items.map((item) => (
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
        ))}
      </nav>

      <div className="hidden items-center gap-3 lg:flex">
        <LocaleSwitcher />
        <AccountMenu state={account} />
        <Link href={planHref} className={buttonClass({ size: 'sm' })}>
          {planLabel}
        </Link>
      </div>

      {/* ---------- Mobile trigger ---------- */}
      <div className="flex items-center gap-2 lg:hidden">
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
            <div className="fixed inset-0 top-(--header-h) z-40 lg:hidden">
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
                  {items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={close}
                      aria-current={
                        isActive(pathname, item.href) ? 'page' : undefined
                      }
                      className={`flex min-h-14 items-center border-b border-border-subtle text-lg font-medium last:border-b-0 ${
                        isActive(pathname, item.href)
                          ? 'text-primary-strong'
                          : 'text-ink-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <AccountDrawerSection state={account} onNavigate={close} />
                <div className="px-5 pt-4 pb-6">
                  <Link
                    href={planHref}
                    onClick={close}
                    className={buttonClass({ size: 'lg', className: 'w-full' })}
                  >
                    {planLabel}
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
