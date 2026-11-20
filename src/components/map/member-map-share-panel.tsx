'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api, goToSignIn } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';

type ShareName = 'anonymous' | 'name';

/** `GET/PUT/DELETE /api/planner/map/share` (ADR 0030 §4). `token` exists only in the response that issues it. */
interface ShareStatus {
  enabled: boolean;
  shareName: ShareName;
  visitedPlaces: number;
  sparse: boolean;
  token?: string;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const SHARE_PATH = '/api/planner/map/share';

/**
 * Owner-only controls for sharing the member map (ADR 0030, slice 2c). The
 * one-time link is held in component state only: never in a URL, storage, the
 * DOM after "done", a log or analytics. Closing it, revoking, rotating again or
 * reloading the page forgets it; the server stores only a digest, so a lost link
 * can only be replaced. `preview` is the server-rendered public projection.
 */
export function MemberMapSharePanel({ preview }: { preview: ReactNode }) {
  const t = useTranslations('memberMapShare');
  const locale = useLocale() as Locale;

  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [nameUnavailable, setNameUnavailable] = useState(false);
  const [needSignIn, setNeedSignIn] = useState(false);

  const linkInput = useRef<HTMLInputElement>(null);
  const issuedHeading = useRef<HTMLHeadingElement>(null);
  const confirmCancel = useRef<HTMLButtonElement>(null);

  function fail(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        setNeedSignIn(true);
        setNotice({ kind: 'error', text: t('errorUnauthorized') });
        return;
      }
      if (error.status === 403 && error.reason === 'share_name_unavailable') {
        setNameUnavailable(true);
        setNotice({ kind: 'error', text: t('errorNameUnavailable') });
        return;
      }
      if (error.status === 403) return setNotice({ kind: 'error', text: t('errorForbidden') });
      if (error.status === 422 && error.reason === 'display_name_unsuitable') {
        return setNotice({ kind: 'error', text: t('errorNameUnsuitable') });
      }
      if (error.status === 422) return setNotice({ kind: 'error', text: t('errorInvalid') });
      if (error.status === 429) {
        const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
        return setNotice({ kind: 'error', text: t('errorRateLimited', { minutes }) });
      }
      if (error.status === 409 && error.reason === 'not_shared') {
        void refresh();
        return setNotice({ kind: 'error', text: t('errorNotShared') });
      }
    }
    setNotice({ kind: 'error', text: t('errorGeneric') });
  }

  async function refresh() {
    try {
      setStatus(await api<ShareStatus>(SHARE_PATH));
      setLoadFailed(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setNeedSignIn(true);
        setNotice({ kind: 'error', text: t('errorUnauthorized') });
      }
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    // Initial read of the share status; only state updates after the await.
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the one-time link into view for keyboard and screen-reader users.
  useEffect(() => {
    if (issuedToken) issuedHeading.current?.focus();
  }, [issuedToken]);

  useEffect(() => {
    if (confirmRotate) confirmCancel.current?.focus();
  }, [confirmRotate]);

  async function run(call: () => Promise<ShareStatus | undefined>, done: string) {
    setBusy(true);
    setNotice(null);
    setNeedSignIn(false);
    try {
      const next = await call();
      if (next) {
        const { token, ...rest } = next;
        setStatus(rest);
        setIssuedToken(token ?? null);
      }
      setNotice({ kind: 'ok', text: done });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  const link =
    issuedToken && typeof window !== 'undefined'
      ? window.location.origin +
        getPathname({ href: { pathname: '/shared-map/[token]', params: { token: issuedToken } }, locale })
      : null;

  async function copy() {
    if (!link) return;
    // `navigator.clipboard` needs a secure origin; on plain http fall back to selecting the field.
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      const input = linkInput.current;
      if (input) {
        input.focus();
        input.select();
        try {
          copied = document.execCommand('copy');
        } catch {
          copied = false;
        }
      }
    }
    setNotice({ kind: copied ? 'ok' : 'error', text: copied ? t('copied') : t('copyFailed') });
  }

  const enabled = status?.enabled ?? false;
  const shareName = status?.shareName ?? 'anonymous';

  return (
    <section aria-labelledby="map-share-heading" className="rounded-2xl bg-surface-muted p-5 md:p-8">
      <h2 id="map-share-heading" className="font-display text-2xl font-semibold">
        {t('title')}
      </h2>
      <p className="mt-2 text-base text-foreground-muted">{t('intro')}</p>

      {status === null ? (
        <p className="mt-6 text-base text-foreground-muted">{loadFailed ? t('errorLoad') : t('loading')}</p>
      ) : (
        <>
          <p className="mt-6 text-base font-medium" data-testid="share-state">
            {enabled ? t('stateOn') : t('stateOff')}
          </p>

          {link ? (
            <div role="group" aria-labelledby="map-share-issued" className="mt-4 rounded-xl border border-border-strong bg-surface p-4 md:p-5">
              <h3
                id="map-share-issued"
                ref={issuedHeading}
                tabIndex={-1}
                className="font-display text-lg font-semibold outline-offset-4"
              >
                {t('issuedTitle')}
              </h3>
              <p className="mt-2 text-sm text-foreground">{t('issuedWarning')}</p>
              <label htmlFor="map-share-link" className="mt-4 block text-sm font-medium">
                {t('linkLabel')}
              </label>
              <input
                id="map-share-link"
                ref={linkInput}
                readOnly
                className={`${inputClass} mt-1.5`}
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={copy} className={buttonClass({ size: 'sm' })}>
                  {t('copy')}
                </button>
                <button
                  type="button"
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() => {
                    setIssuedToken(null);
                    setNotice({ kind: 'ok', text: t('issuedClosed') });
                  }}
                >
                  {t('issuedDone')}
                </button>
              </div>
            </div>
          ) : null}

          {enabled && !link ? (
            <p className="mt-3 text-sm text-foreground-muted">{t('linkHidden')}</p>
          ) : null}

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">{t('nameLegend')}</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="inline-flex min-h-11 items-center gap-2 text-base">
                <input
                  type="radio"
                  name="map-share-name"
                  value="anonymous"
                  checked={shareName === 'anonymous'}
                  disabled={busy}
                  onChange={() =>
                    run(() => api<ShareStatus>(SHARE_PATH, { method: 'PUT', body: { enabled, shareName: 'anonymous' } }), t('saved'))
                  }
                />
                {t('nameAnonymous')}
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-base">
                <input
                  type="radio"
                  name="map-share-name"
                  value="name"
                  checked={shareName === 'name'}
                  disabled={busy || nameUnavailable}
                  aria-describedby={nameUnavailable ? 'map-share-name-unavailable' : undefined}
                  onChange={() =>
                    run(() => api<ShareStatus>(SHARE_PATH, { method: 'PUT', body: { enabled, shareName: 'name' } }), t('saved'))
                  }
                />
                {t('nameShown')}
              </label>
              {nameUnavailable ? (
                <p id="map-share-name-unavailable" className="text-sm text-foreground-muted">
                  {t('nameUnavailableNote')}
                </p>
              ) : null}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {enabled ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() => setConfirmRotate(true)}
                >
                  {t('rotate')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() =>
                    run(async () => {
                      setIssuedToken(null);
                      setConfirmRotate(false);
                      return api<ShareStatus>(SHARE_PATH, { method: 'DELETE' });
                    }, t('revoked'))
                  }
                >
                  {t('revoke')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                className={buttonClass({ size: 'sm' })}
                onClick={() =>
                  run(() => api<ShareStatus>(SHARE_PATH, { method: 'PUT', body: { enabled: true, shareName } }), t('enabled'))
                }
              >
                {t('enable')}
              </button>
            )}
          </div>

          {confirmRotate ? (
            <div role="group" aria-labelledby="map-share-rotate-title" className="mt-4 rounded-xl border border-border-strong bg-surface p-4">
              <h3 id="map-share-rotate-title" className="font-display text-lg font-semibold">
                {t('rotateConfirmTitle')}
              </h3>
              <p className="mt-2 text-sm text-foreground">{t('rotateConfirmBody')}</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ size: 'sm' })}
                  onClick={() => {
                    setConfirmRotate(false);
                    void run(() => api<ShareStatus>(`${SHARE_PATH}/rotate`, { method: 'POST' }), t('rotated'));
                  }}
                >
                  {t('rotateConfirm')}
                </button>
                <button
                  type="button"
                  ref={confirmCancel}
                  className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  onClick={() => setConfirmRotate(false)}
                >
                  {t('rotateCancel')}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-8 border-t border-border-subtle pt-6">{preview}</div>

      <p role="status" className="mt-4 min-h-6 text-sm text-foreground-muted">
        {notice?.kind === 'ok' ? notice.text : ''}
      </p>
      <div role="alert" className="min-h-6 text-sm text-primary-strong">
        {notice?.kind === 'error' ? notice.text : ''}
        {needSignIn ? (
          <button
            type="button"
            className={`${buttonClass({ size: 'sm', variant: 'secondary' })} ml-3`}
            onClick={() => goToSignIn(locale)}
          >
            {t('signIn')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
