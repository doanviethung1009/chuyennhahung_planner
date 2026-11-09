import type { ReactNode } from 'react';

export const inputClass =
  'block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground placeholder:text-ink-500';

/** A label tied to its control, with optional hint wired through aria-describedby. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-foreground-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
