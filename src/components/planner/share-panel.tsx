'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import type { ShareState, Visibility } from '@/server/planner/schemas';
import { ApiError, api } from './api';
import { inputClass } from './field';

const VISIBILITIES: Visibility[] = ['private', 'unlisted', 'public'];

/**
 * Owner-only sharing controls. The link is built here from the token the owner's
 * own API call returned; the token is held in component state only — never in a
 * URL, a title, a log or storage.
 */
export function SharePanel({
  tripId,
  initial,
  onUnauthorized,
}: {
  tripId: string;
  initial: ShareState;
  onUnauthorized: () => void;
}) {
  const t = useTranslations('share');
  const tVis = useTranslations('visibility');
  const locale = useLocale() as Locale;

  const [state, setState] = useState<ShareState>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const link =
    state.shareToken && typeof window !== 'undefined'
      ? window.location.origin +
        getPathname({ href: { pathname: '/shared/[token]', params: { token: state.shareToken } }, locale })
      : null;

  async function run(call: () => Promise<ShareState>, done: string) {
    setBusy(true);
    setFailed(false);
    setMessage('');
    try {
      setState(await call());
      setMessage(done);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onUnauthorized();
      setFailed(true);
      setMessage(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setFailed(false);
      setMessage(t('copied'));
    } catch {
      setFailed(true);
      setMessage(t('copyFailed'));
    }
  }

  const base = `/api/planner/${encodeURIComponent(tripId)}/share`;
  const shared = state.visibility !== 'private' && link !== null;

  return (
    <section aria-labelledby="share-heading" className="rounded-2xl bg-surface-muted p-5 md:p-8">
      <h2 id="share-heading" className="font-display text-2xl font-semibold">
        {t('title')}
      </h2>
      <p className="mt-2 text-base text-foreground-muted">{t('intro')}</p>

      <div className="mt-6">
        <label htmlFor="share-visibility" className="block text-sm font-medium">
          {t('visibilityLabel')}
        </label>
        <select
          id="share-visibility"
          className={`${inputClass} mt-1.5 sm:max-w-xs`}
          value={state.visibility}
          disabled={busy}
          aria-describedby="share-visibility-hint"
          onChange={(e) =>
            run(
              () => api<ShareState>(base, { method: 'PUT', body: { visibility: e.target.value } }),
              t('saved'),
            )
          }
        >
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {tVis(v)}
            </option>
          ))}
        </select>
        <p id="share-visibility-hint" className="mt-1.5 text-sm text-foreground-muted">
          {tVis(`${state.visibility}Hint`)}
        </p>
      </div>

      {shared ? (
        <div className="mt-6">
          <label htmlFor="share-link" className="block text-sm font-medium">
            {t('linkLabel')}
          </label>
          <input
            id="share-link"
            readOnly
            className={`${inputClass} mt-1.5`}
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={copy} className={buttonClass({ size: 'sm' })}>
              {t('copy')}
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass({ size: 'sm', variant: 'secondary' })}
              onClick={() => run(() => api<ShareState>(`${base}/rotate`, { method: 'POST' }), t('rotated'))}
            >
              {t('rotate')}
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass({ size: 'sm', variant: 'secondary' })}
              onClick={() => run(() => api<ShareState>(base, { method: 'DELETE' }), t('revoked'))}
            >
              {t('revoke')}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ size: 'sm', variant: 'secondary' })}
            >
              {t('viewShared')}
              <span className="sr-only"> {t('newTab')}</span>
            </a>
          </div>
          <p className="mt-3 text-sm text-foreground-muted">{t('liveHint')}</p>
          <p className="mt-2 text-sm text-foreground-muted">{t('rotateHint')}</p>
        </div>
      ) : null}

      <p role="status" className={`mt-4 min-h-6 text-sm ${failed ? 'text-primary-strong' : 'text-foreground-muted'}`}>
        {message}
      </p>
    </section>
  );
}
