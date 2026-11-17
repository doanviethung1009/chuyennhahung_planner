'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from '@/components/planner/api';
import { Field, inputClass } from '@/components/planner/field';

const NOTE_MAX = 500;
const REASONS = ['spam', 'harassment', 'personal_data', 'copyright', 'misleading', 'other'] as const;

export type ReportTarget = { kind: 'trip'; shareToken: string } | { kind: 'review'; id: string };

/**
 * A reader's "Report" control (batch 10.5). A real button opens a native modal
 * `<dialog>`: the browser traps focus inside it, Escape closes it and focus
 * returns to the button. Guests and members both can report; the note is plain
 * text and the hidden `website` field is the honeypot.
 */
export function ReportButton({ target }: { target: ReportTarget }) {
  const t = useTranslations('communityReports');
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('spam');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Light dismiss: a click on the backdrop (the dialog element itself) closes it.
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener('click', onClick);
    return () => dialog.removeEventListener('click', onClick);
  }, []);

  function open() {
    setSent(false);
    setError('');
    dialogRef.current?.showModal();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/community/reports', {
        method: 'POST',
        body: {
          targetKind: target.kind,
          ...(target.kind === 'trip' ? { shareToken: target.shareToken } : { targetId: target.id }),
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          website: honeypot,
        },
      });
      setSent(true);
      setNote('');
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : 'generic';
      setError(code === 'rate_limited' || code === 'not_found' ? t(`errors.${code}`) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={target.kind === 'trip' ? t('buttonTrip') : t('buttonReview')}
        className={buttonClass({ variant: 'ghost', size: 'sm', className: 'self-start text-foreground-muted' })}
      >
        {t('button')}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border-strong bg-surface p-0 text-foreground shadow-lift backdrop:bg-ink-900/50"
      >
        <form onSubmit={submit} aria-busy={busy} className="grid gap-4 p-5">
          <h2 id={`${uid}-title`} className="font-display text-xl font-semibold">
            {t('title')}
          </h2>
          {sent ? (
            <>
              <p role="status" className="text-base">
                {t('sent')}
              </p>
              <div>
                <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => dialogRef.current?.close()}>
                  {t('close')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground-muted">{target.kind === 'trip' ? t('introTrip') : t('introReview')}</p>
              <Field id={`${uid}-reason`} label={t('reason')}>
                <select
                  id={`${uid}-reason`}
                  className={inputClass}
                  value={reason}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
                >
                  {REASONS.map((value) => (
                    <option key={value} value={value}>
                      {t(`reasons.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`${uid}-note`} label={t('note')} hint={t('noteHint', { max: NOTE_MAX })}>
                <textarea
                  id={`${uid}-note`}
                  rows={4}
                  maxLength={NOTE_MAX}
                  className={inputClass}
                  value={note}
                  disabled={busy}
                  aria-describedby={`${uid}-note-hint`}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              {/* Honeypot: invisible and unreachable for people; a bot that fills it is dropped silently. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <input type="text" tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>
              <div role="alert" className="min-h-0 text-sm text-primary-strong">
                {error}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busy} className={buttonClass({ size: 'sm' })}>
                  {t('submit')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                  onClick={() => dialogRef.current?.close()}
                >
                  {t('cancel')}
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
