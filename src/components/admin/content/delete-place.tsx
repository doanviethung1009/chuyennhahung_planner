'use client';

import { useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { useErrorNotice, type Notice } from './use-record';

/**
 * "Delete place" (CORE-10, ADR 0028). Shown only when the server page found
 * `content:delete` for the signed-in role; the API checks it again. A real
 * button opens a native modal `<dialog>`: the browser traps focus, Escape closes
 * it and focus returns to the button. A refusal (409 `place_in_use`, 503, 403)
 * closes the dialog and is announced beside the button.
 */
export function DeletePlace({ apiPath, name, disabled }: { apiPath: string; name: string; disabled: boolean }) {
  const t = useTranslations('adminContent.places.delete');
  const describe = useErrorNotice();
  const router = useRouter();
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function open() {
    setNotice(null);
    dialogRef.current?.showModal();
  }

  async function confirm() {
    setBusy(true);
    try {
      await api(apiPath, { method: 'DELETE' });
      dialogRef.current?.close();
      router.push('/admin/content/places');
    } catch (failure) {
      dialogRef.current?.close();
      setNotice(describe(failure));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-danger`} className="grid gap-3 rounded-md border border-primary p-4">
      <h2 id={`${uid}-danger`} className="font-display text-xl text-foreground">
        {t('dangerTitle')}
      </h2>
      <p className="text-sm text-foreground-muted">{t('dangerHint')}</p>
      <div>
        <button
          type="button"
          onClick={open}
          disabled={disabled || busy}
          aria-haspopup="dialog"
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          {t('button')}
        </button>
      </div>
      <div aria-live="polite">
        {notice ? (
          <p role="alert" className="rounded-md border border-primary bg-surface-muted px-4 py-3 text-base text-foreground">
            {notice.text}
          </p>
        ) : null}
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border-strong bg-surface p-0 text-foreground shadow-lift backdrop:bg-ink-900/50"
      >
        <div className="grid gap-4 p-5">
          <h2 id={`${uid}-title`} className="font-display text-xl font-semibold">
            {t('confirmTitle')}
          </h2>
          <p className="text-base">{t('confirmBody', { name })}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={() => dialogRef.current?.close()}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              {t('cancel')}
            </button>
            <button type="button" disabled={busy} onClick={() => void confirm()} className={buttonClass({ size: 'sm' })}>
              {busy ? t('deleting') : t('confirm')}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
