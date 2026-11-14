'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { contribution, contributionOpen } from '@/content/site';
import type { ShareState, TripListing, Visibility } from '@/server/planner/schemas';
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
  const [authorDisplay, setAuthorDisplay] = useState<TripListing['authorDisplay']>(
    initial.listing?.authorDisplay ?? 'name',
  );

  // Editing the trip re-queues an approved listing on the server (ADR 0014);
  // follow the parent's copy so this panel never shows a stale "approved".
  const parentStatus = initial.listing?.status ?? null;
  useEffect(() => {
    // Mirror a server-side change made by an edit elsewhere on the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((current) => ({ ...current, listing: initial.listing }));
  }, [parentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
          </div>
          <p className="mt-3 text-sm text-foreground-muted">{t('rotateHint')}</p>
        </div>
      ) : null}

      {state.visibility === 'public' ? (
        <div className="mt-8 border-t border-border-subtle pt-6">
          <h3 className="font-display text-xl font-semibold">{t('listingTitle')}</h3>
          <p className="mt-2 text-base text-foreground-muted">{t('listingIntro')}</p>

          {!contributionOpen ? (
            <p className="mt-3 rounded-md border border-border-strong bg-surface p-4 text-sm text-foreground">
              {t('listingClosed')}
            </p>
          ) : (
            <>
              {contribution.terms ? (
                <div className="mt-3 rounded-md bg-surface p-4 text-sm text-foreground-muted">
                  <p className="font-medium text-foreground">{t('termsHeading')}</p>
                  <p className="mt-1 whitespace-pre-line">{contribution.terms[locale]}</p>
                  {contribution.takedownContact ? (
                    <p className="mt-2">
                      {t('takedown')}{' '}
                      <a
                        href={`mailto:${contribution.takedownContact}`}
                        className="font-medium text-primary-strong underline underline-offset-4"
                      >
                        {contribution.takedownContact}
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-4 text-sm font-medium">
                {t('listingStatusLabel')}{' '}
                <span className="font-normal text-foreground-muted">{t(`listingStatus.${state.listing?.status ?? 'none'}`)}</span>
              </p>
              {state.listing?.status === 'rejected' && state.listing.rejectReason ? (
                <p className="mt-1 text-sm text-foreground-muted">
                  {t('listingReason', { reason: state.listing.rejectReason })}
                </p>
              ) : null}

              <fieldset className="mt-4">
                <legend className="text-sm font-medium">{t('authorLabel')}</legend>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
                  {(['name', 'anonymous'] as const).map((value) => (
                    <label key={value} className="inline-flex min-h-11 items-center gap-2 text-base">
                      <input
                        type="radio"
                        name="listing-author"
                        value={value}
                        checked={authorDisplay === value}
                        disabled={busy}
                        onChange={() => setAuthorDisplay(value)}
                      />
                      {t(`author.${value}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm' })}
                  onClick={() =>
                    run(
                      () =>
                        api<ShareState>(`/api/planner/${encodeURIComponent(tripId)}/listing`, {
                          method: 'PUT',
                          body: { authorDisplay },
                        }),
                      t('listingRequested'),
                    )
                  }
                >
                  {state.listing ? t('listingResubmit') : t('listingRequest')}
                </button>
                {state.listing ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={buttonClass({ size: 'sm', variant: 'secondary' })}
                    onClick={() =>
                      run(
                        () => api<ShareState>(`/api/planner/${encodeURIComponent(tripId)}/listing`, { method: 'DELETE' }),
                        t('listingWithdrawn'),
                      )
                    }
                  >
                    {t('listingWithdraw')}
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-foreground-muted">{t('listingEditNote')}</p>
            </>
          )}
        </div>
      ) : null}

      <p role="status" className={`mt-4 min-h-6 text-sm ${failed ? 'text-primary-strong' : 'text-foreground-muted'}`}>
        {message}
      </p>
    </section>
  );
}
