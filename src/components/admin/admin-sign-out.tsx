'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api, signInUrl } from '@/components/planner/api';

/**
 * Sign-out for the admin top bar. The same same-origin
 * `DELETE /api/planner/session` call the console used to make; on success the
 * visitor lands on the sign-in page.
 */
export function AdminSignOut({ className = '' }: { className?: string }) {
  const t = useTranslations('admin');
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      await api('/api/planner/session', { method: 'DELETE' });
      window.location.assign(signInUrl(locale));
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className={`${buttonClass({ variant: 'secondary', size: 'sm' })} whitespace-nowrap`}
      >
        {busy ? t('signingOut') : t('signOut')}
      </button>
      <p role="alert" className="text-sm font-medium text-foreground empty:hidden">
        {failed ? t('status.signedOutFailed') : null}
      </p>
    </div>
  );
}
