'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface ActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  /** Makes the item a `menuitemradio` (a choice among siblings). */
  checked?: boolean;
  tone?: 'default' | 'danger';
}

export interface ActionMenuSection {
  /** Names the group for screen readers and shows as a small heading. */
  label?: string;
  items: ActionMenuItem[];
}

/**
 * A disclosure menu opened by a real button (ARIA menu button pattern). It never
 * depends on hover: click/Enter/Space/ArrowDown open it, Arrow keys, Home and End
 * move, Escape closes and returns focus, Tab and an outside press close it.
 * The panel is absolutely positioned, so the parent must not clip overflow.
 */
export function ActionMenu({
  label,
  sections,
  disabled,
}: {
  label: string;
  sections: ActionMenuSection[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Focus the first item (or the checked one) when the panel opens.
  useEffect(() => {
    if (!open) return;
    const list = items();
    (list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0])?.focus();
  }, [open]);

  // Close on a press outside the menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // A disabled trigger must not leave the panel open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (disabled) setOpen(false);
  }, [disabled]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Tab') close(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex size-11 items-center justify-center rounded-pill border border-border-strong bg-surface text-foreground transition-colors duration-200 ease-gentle hover:border-primary hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKeyDown}
          className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border-subtle bg-surface p-2 shadow-lift"
        >
          {sections.map((section, sectionIndex) => (
            <div
              key={section.label ?? sectionIndex}
              role="group"
              aria-label={section.label}
              className={sectionIndex > 0 ? 'mt-1 border-t border-border-subtle pt-1' : undefined}
            >
              {section.label ? (
                <p aria-hidden="true" className="px-3 pb-1 pt-2 text-xs font-medium text-foreground-muted">
                  {section.label}
                </p>
              ) : null}
              {section.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  tabIndex={-1}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-surface-muted focus-visible:bg-surface-muted ${
                    item.tone === 'danger' ? 'text-primary-strong' : 'text-foreground'
                  }`}
                >
                  {item.checked === undefined ? null : (
                    <span aria-hidden="true" className="inline-block w-4 text-center">
                      {item.checked ? '✓' : ''}
                    </span>
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
