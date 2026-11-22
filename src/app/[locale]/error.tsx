'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { StateNotice } from '@/components/ui/state-notice';

/**
 * Error boundary for every public page (UXS-1). It renders inside the locale
 * layout, so the header, footer and the message provider are still there; it
 * replaces only the page. The error itself is never shown: its message can carry
 * internal detail, so the log gets the digest (or the class name) and nothing else.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('states');

  useEffect(() => {
    console.error('route error', error.digest ?? error.name);
  }, [error]);

  return (
    <Container width="narrow">
      <div className="py-16 md:py-24">
        <StateNotice level={1} tone="error" title={t('errorTitle')} body={t('errorBody')}>
          <button type="button" onClick={reset} className={buttonClass()}>
            {t('retry')}
          </button>
          <ButtonLink href="/" variant="secondary">
            {t('backHome')}
          </ButtonLink>
        </StateNotice>
      </div>
    </Container>
  );
}
