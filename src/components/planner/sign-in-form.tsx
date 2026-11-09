'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from './api';
import { Field, inputClass } from './field';

/**
 * `target` is validated on the server (`safeReturnTo`) before it reaches this
 * component, so it is always a known same-site path. A full navigation follows
 * a successful sign-in so server-rendered state is fresh.
 */
export function SignInForm({ target }: { target: string }) {
  const t = useTranslations('signIn');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/planner/session', { method: 'POST', body: { accessToken: token.trim() } });
      window.location.assign(target);
    } catch (failure) {
      setBusy(false);
      if (failure instanceof ApiError && failure.status === 429) {
        setError(t('errorRateLimited', { seconds: failure.retryAfterSeconds ?? 60 }));
      } else if (failure instanceof ApiError && (failure.status === 401 || failure.status === 422)) {
        setError(t('errorInvalid'));
      } else {
        setError(t('errorGeneric'));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" aria-busy={busy}>
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
      <div role="alert" className="text-base text-primary-strong">
        {error}
      </div>
      <div>
        <button type="submit" disabled={busy || token.trim().length === 0} className={buttonClass({ size: 'lg' })}>
          {busy ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
