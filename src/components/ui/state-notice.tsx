import type { ReactNode } from 'react';

/**
 * One panel for the empty and error states of a page (UXS-1). Pure markup, so a
 * server page and a client error boundary can both render it.
 *
 * - `tone="error"` carries `role="alert"`: the failure is announced, and it is
 *   never worded as "empty" (the data exists, it just did not load).
 * - `level` is the heading the panel opens with. A boundary that replaces a whole
 *   page uses 1 (it must still hold the page's single `<h1>`); a panel inside a
 *   page that already has its masthead uses 2.
 */
export function StateNotice({
  title,
  body,
  tone = 'empty',
  level = 2,
  children,
}: {
  title: string;
  body: string;
  tone?: 'empty' | 'error';
  level?: 1 | 2;
  children?: ReactNode;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div
      {...(tone === 'error' ? { role: 'alert' } : {})}
      className={`rounded-xl border p-8 text-center ${
        tone === 'error' ? 'border-border-strong' : 'border-border-subtle'
      } bg-surface-muted`}
    >
      <Heading className="font-display text-xl font-semibold md:text-2xl">{title}</Heading>
      <p className="mx-auto mt-3 max-w-md text-foreground-muted">{body}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}
