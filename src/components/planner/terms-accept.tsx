'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { termsVersion } from '@/content/site';
import { ApiError, api } from './api';

type Status = { version: string; accepted: boolean; acceptedAt: string | null };

/**
 * Accept control for the Creator Terms (ADR 0019 §4). Reads the member's status
 * once, then records acceptance with one POST when the box is ticked; it cannot
 * be unticked (acceptance is a record, not a preference). The parent disables
 * its submit until `onChange(true)`. The terms text itself is shown by the
 * parent, above this control.
 */
export function TermsAccept({
  onChange,
  onUnauthorized,
}: {
  onChange: (accepted: boolean) => void;
  onUnauthorized: () => void;
}) {
  const t = useTranslations('creatorTerms');
  const locale = useLocale();
  const id = useId();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api<Status>('/api/planner/terms')
      .then((status) => {
        if (!live) return;
        setAccepted(status.accepted);
        onChange(status.accepted);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) onUnauthorized();
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // Run once: the parent callbacks are not dependencies of the lookup.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function accept() {
    setBusy(true);
    setFailed(false);
    try {
      await api('/api/planner/terms', { method: 'POST', body: { version: termsVersion, lang: locale === 'en' ? 'en' : 'vi' } });
      setAccepted(true);
      onChange(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onUnauthorized();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return <p className="text-sm text-foreground-muted">{t('accepted', { version: termsVersion })}</p>;
  }

  return (
    <div>
      <label htmlFor={`${id}-accept`} className="inline-flex min-h-11 items-center gap-3 text-base">
        <input
          id={`${id}-accept`}
          type="checkbox"
          className="size-5"
          checked={false}
          disabled={loading || busy}
          aria-describedby={`${id}-hint`}
          onChange={accept}
        />
        {loading ? t('loading') : t('label', { version: termsVersion })}
      </label>
      <p id={`${id}-hint`} className="mt-1 text-sm text-foreground-muted">
        {t('hint')}
      </p>
      <p role="status" aria-live="polite" className="text-sm text-primary-strong">
        {failed ? t('error') : ''}
      </p>
    </div>
  );
}
