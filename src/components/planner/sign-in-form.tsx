'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api, changePasswordUrl } from './api';
import { Field, inputClass } from './field';

interface SignInResponse {
  passwordChangeRequired: boolean;
}

/**
 * Email + password sign-in (ADR 0007), with the access-token form
 * always visible, because an account an operator created without an email has
 * only a code and must be able to find where to use it.
 *
 * `target` is validated on the server (`safeReturnTo`) before it reaches this
 * component, so it is always a known same-site path. A full navigation follows
 * a successful sign-in so server-rendered state is fresh. A temporary password
 * goes to the change-password page first.
 */
export function SignInForm({ target }: { target: string }) {
  const t = useTranslations('signIn');
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(body: Record<string, string>, invalidMessage: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await api<SignInResponse>('/api/planner/session', { method: 'POST', body });
      if (result.passwordChangeRequired) {
        window.location.assign(changePasswordUrl(locale, target));
      } else {
        window.location.assign(target);
      }
    } catch (failure) {
      setBusy(false);
      if (failure instanceof ApiError && failure.status === 429) {
        setError(t('errorRateLimited', { seconds: failure.retryAfterSeconds ?? 60 }));
      } else if (failure instanceof ApiError && (failure.status === 401 || failure.status === 422)) {
        setError(invalidMessage);
      } else {
        setError(t('errorGeneric'));
      }
    }
  }

  function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit({ email: email.trim(), password }, t('errorCredentials'));
  }

  function onToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit({ accessToken: token.trim() }, t('errorInvalid'));
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={onPassword} className="grid gap-6" aria-busy={busy}>
        <Field id="si-email" label={t('emailLabel')}>
          <input
            id="si-email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="si-password" label={t('passwordLabel')}>
          <input
            id="si-password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div role="alert" className="text-base text-primary-strong">
          {error}
        </div>
        <div>
          <button
            type="submit"
            disabled={busy || email.trim().length === 0 || password.length === 0}
            className={buttonClass({ size: 'lg' })}
          >
            {busy ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>

      <section aria-labelledby="si-token-heading" className="rounded-md border border-border bg-surface-muted px-4 py-5">
        <h2 id="si-token-heading" className="font-display text-xl text-foreground">
          {t('tokenToggle')}
        </h2>
        <form onSubmit={onToken} className="mt-4 grid gap-4" aria-busy={busy}>
          <Field id="si-token" label={t('tokenLabel')} hint={t('tokenHint')}>
            <input
              id="si-token"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={inputClass}
              value={token}
              aria-describedby="si-token-hint"
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          <div>
            <button
              type="submit"
              disabled={busy || token.trim().length === 0}
              className={buttonClass({ variant: 'secondary' })}
            >
              {busy ? t('submitting') : t('tokenSubmit')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
