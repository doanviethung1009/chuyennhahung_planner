'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { inputClass } from '@/components/planner/field';
import type { OneTimeSecret } from './types';

function SecretRow({ id, name, value }: { id: string; name: string; value: string }) {
  const t = useTranslations('admin.secret');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Plain HTTP (LAN dev) has no clipboard API: the value stays selectable.
      setState('failed');
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {name}
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        <button
          type="button"
          onClick={copy}
          aria-label={t('copyLabel', { name })}
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}
        >
          {state === 'copied' ? t('copied') : t('copy')}
        </button>
      </div>
      <p role="status" className="mt-1.5 min-h-5 text-sm text-foreground-muted">
        {state === 'failed' ? t('copyFailed') : ''}
      </p>
    </div>
  );
}

/**
 * The only place a credential is ever rendered. It lives in the parent's React
 * state: never in storage, never in the URL, gone on reload or dismiss.
 */
export function SecretPanel({ secret, onDismiss }: { secret: OneTimeSecret; onDismiss: () => void }) {
  const t = useTranslations('admin.secret');
  const headingId = `secret-${secret.key}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-5 rounded-lg border-2 border-primary bg-surface-muted p-5 shadow-soft md:p-6"
    >
      <div>
        <h3 id={headingId} className="font-display text-xl text-foreground">
          {t('heading', { handle: secret.handle })}
        </h3>
        <p className="mt-2 text-base text-foreground">{t('warning')}</p>
      </div>
      {secret.temporaryPassword ? (
        <SecretRow id={`secret-${secret.key}-pw`} name={t('temporaryPassword')} value={secret.temporaryPassword} />
      ) : null}
      {secret.accessToken ? (
        <SecretRow id={`secret-${secret.key}-token`} name={t('accessToken')} value={secret.accessToken} />
      ) : null}
      <div>
        <button type="button" onClick={onDismiss} className={buttonClass({ size: 'md' })}>
          {t('dismiss')}
        </button>
      </div>
    </section>
  );
}
