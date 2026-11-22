'use client';

import { useEffect, useSyncExternalStore } from 'react';
import vi from '../../messages/vi.json';
import en from '../../messages/en.json';
import './globals.css';

/**
 * Last-resort boundary (UXS-1): it replaces the root layout itself, so there is no
 * header, no footer and no message provider. The words come straight from the two
 * catalogues (never hard-coded here), and the language is read from the URL because `next-intl` is not available this high. Plain `<a>` and `<button>`
 * on purpose: the router may be the thing that broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The URL is the only place the language lives up here. The server snapshot is
  // Vietnamese (the default); the client reads the path, with no state to set.
  const locale = useSyncExternalStore(
    () => () => {},
    (): 'vi' | 'en' => (/^\/en(\/|$)/.test(window.location.pathname) ? 'en' : 'vi'),
    (): 'vi' | 'en' => 'vi',
  );

  useEffect(() => {
    console.error('global error', error.digest ?? error.name);
  }, [error]);

  const t = (locale === 'en' ? en : vi).states;

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
        <main id="main" className="max-w-md py-16 text-center">
          <div role="alert">
          <h1 className="font-display text-2xl font-semibold">{t.errorTitle}</h1>
          <p className="mt-3 text-foreground-muted">{t.errorBody}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-5 font-medium text-primary-foreground"
            >
              {t.retry}
            </button>
            <a
              href={locale === 'en' ? '/en' : '/'}
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-border-strong bg-surface px-5 font-medium text-foreground"
            >
              {t.backHome}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
