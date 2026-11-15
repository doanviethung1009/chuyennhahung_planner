'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api, goToSignIn } from './api';
import { Field, inputClass } from './field';

/** Mirrors `PASSWORD_MIN_LENGTH` on the server, which is what actually decides. */
const MIN_LENGTH = 12;

interface SessionResponse {
  passwordChangeRequired: boolean;
  user: { hasPassword: boolean; hasGoogle: boolean };
}

/** Outcomes of a Google link attempt, read from `?google=` by the page. */
export type GoogleLinkStatus =
  | 'linked'
  | 'google_failed'
  | 'google_cancelled'
  | 'google_unverified'
  | 'account_conflict'
  | 'rate_limited';

/** Whether the unlink call is idle, running, or has failed. */
type UnlinkState = 'idle' | 'busy' | 'failed';

interface Props {
  target: string;
  /** Null when Google is not configured — then the section is not rendered. */
  googleLinkHref: string | null;
  linkStatus: GoogleLinkStatus | null;
}

/**
 * Changes the signed-in user's password. With a temporary password pending it
 * explains why the user is here; without a session it goes to sign-in.
 * Below it, when Google is configured, the user can link a Google account.
 */
export function ChangePasswordForm({ target, googleLinkHref, linkStatus }: Props) {
  const t = useTranslations('changePassword');
  const locale = useLocale() as Locale;
  const [required, setRequired] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [hasGoogle, setHasGoogle] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlink, setUnlink] = useState<UnlinkState>('idle');
  const [unlinked, setUnlinked] = useState(false);

  useEffect(() => {
    api<SessionResponse>('/api/planner/session')
      .then((session) => {
        setRequired(session.passwordChangeRequired);
        setHasPassword(session.user.hasPassword);
        setHasGoogle(session.user.hasGoogle);
      })
      .catch((failure: unknown) => {
        if (failure instanceof ApiError && failure.status === 401) goToSignIn(locale);
      });
  }, [locale]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) return setError(t('errorTooShort'));
    if (next !== confirm) return setError(t('errorMismatch'));

    setBusy(true);
    try {
      await api('/api/planner/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      window.location.assign(target);
    } catch (failure) {
      setBusy(false);
      if (!(failure instanceof ApiError)) return setError(t('errorGeneric'));
      if (failure.status === 401) return goToSignIn(locale);
      if (failure.status === 429) {
        return setError(t('errorRateLimited', { seconds: failure.retryAfterSeconds ?? 60 }));
      }
      if (failure.status === 409) return setError(t('errorNoPassword'));
      if (failure.status === 422) {
        // The server says which field; the same-password case is caught here
        // first so the message is exact.
        return setError(current === next ? t('errorSame') : t('errorCurrent'));
      }
      setError(t('errorGeneric'));
    }
  }

  async function onUnlink() {
    setUnlink('busy');
    setUnlinked(false);
    try {
      await api('/api/planner/google', { method: 'DELETE' });
      setHasGoogle(false);
      setUnlinked(true);
      setUnlink('idle');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return goToSignIn(locale);
      setUnlink('failed');
    }
  }

  // Linking waits for the temporary password to be changed (the start route
  // refuses it too), and for the session to load so the right state shows.
  const googleSection =
    googleLinkHref && !required && hasGoogle !== null ? (
      <section aria-labelledby="cp-google-heading" className="grid gap-4 border-t border-border pt-10">
        <h2 id="cp-google-heading" className="font-display text-2xl text-foreground">
          {t('google.heading')}
        </h2>
        {linkStatus ? (
          <p
            role={linkStatus === 'linked' ? 'status' : 'alert'}
            className="rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-foreground"
          >
            {t(`google.status.${linkStatus}`)}
          </p>
        ) : null}
        {unlinked ? (
          <p role="status" className="rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-foreground">
            {t('google.unlinked')}
          </p>
        ) : null}
        {unlink === 'failed' ? (
          <p role="alert" className="text-base text-primary-strong">
            {t('google.unlinkFailed')}
          </p>
        ) : null}
        {hasGoogle ? (
          <>
            <p className="text-base text-foreground">{t('google.linkedNote')}</p>
            {hasPassword ? (
              <div className="grid gap-2">
                <p className="text-base text-foreground-muted">{t('google.unlinkHint')}</p>
                <div>
                  <button
                    type="button"
                    onClick={onUnlink}
                    disabled={unlink === 'busy'}
                    className={buttonClass({ variant: 'secondary' })}
                  >
                    {unlink === 'busy' ? t('google.unlinking') : t('google.unlinkButton')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-base text-foreground-muted">{t('google.unlinkNeedsPassword')}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-base text-foreground-muted">{t('google.intro')}</p>
            <div>
              {/* A plain link: the start route answers with a redirect to Google. */}
              <a href={googleLinkHref} className={buttonClass({ variant: 'secondary' })}>
                {t('google.linkButton')}
              </a>
            </div>
          </>
        )}
      </section>
    ) : null;

  if (!hasPassword) {
    return (
      <div className="grid gap-10">
        <p className="text-base text-foreground">{t('errorNoPassword')}</p>
        {googleSection}
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <form onSubmit={onSubmit} className="grid gap-6" aria-busy={busy}>
        {required ? (
          <p className="rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-foreground">
            {t('requiredNotice')}
          </p>
        ) : null}
        <Field id="cp-current" label={t('currentLabel')}>
          <input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field id="cp-new" label={t('newLabel')} hint={t('newHint')}>
          <input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            maxLength={128}
            className={inputClass}
            value={next}
            aria-describedby="cp-new-hint"
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field id="cp-confirm" label={t('confirmLabel')}>
          <input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <div role="alert" className="text-base text-primary-strong">
          {error}
        </div>
        <div>
          <button
            type="submit"
            disabled={busy || current.length === 0 || next.length === 0 || confirm.length === 0}
            className={buttonClass({ size: 'lg' })}
          >
            {busy ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>
      {googleSection}
    </div>
  );
}
