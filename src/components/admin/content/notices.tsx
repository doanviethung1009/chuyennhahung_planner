'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { signInUrl } from '@/components/planner/api';
import type { Notice, StatusAction } from './use-record';

/** Polite live region: save results are announced without moving focus. */
export function LiveNotice({ notice, onReload }: { notice: Notice | null; onReload?: () => void }) {
  const t = useTranslations('adminContent.errors');
  const locale = useLocale() as Locale;
  return (
    <div role="status" aria-live="polite" className="min-h-6">
      {notice ? (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-base text-foreground ${
            notice.kind === 'error' ? 'border-primary bg-surface-muted' : 'border-border-strong bg-surface'
          }`}
        >
          <p>{notice.text}</p>
          {notice.expired ? (
            <a href={signInUrl(locale)} className="font-medium text-primary-strong underline underline-offset-4">
              {t('signInAgain')}
            </a>
          ) : null}
          {notice.stale && onReload ? (
            <button type="button" onClick={onReload} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              {t('reload')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Which status actions make sense from a given status. */
export function actionsFor(kind: 'story' | 'review', status: string): StatusAction[] {
  if (kind === 'review') return status === 'published' ? ['unpublish'] : ['publish'];
  if (status === 'published') return ['unpublish', 'archive'];
  if (status === 'archived') return ['unpublish'];
  return ['publish', 'archive'];
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('adminContent.statuses');
  const known = status === 'draft' || status === 'published' || status === 'archived';
  return (
    <span className="inline-flex min-h-7 items-center rounded-pill border border-border-strong bg-surface px-3 text-sm font-medium text-foreground">
      {known ? t(status) : status}
    </span>
  );
}

export function ActionButtons({
  kind,
  status,
  disabled,
  onAction,
}: {
  kind: 'story' | 'review';
  status: string;
  disabled: boolean;
  onAction: (action: StatusAction) => void;
}) {
  const t = useTranslations('adminContent.actions');
  return (
    <>
      {actionsFor(kind, status).map((action) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onAction(action)}
          className={buttonClass({ variant: action === 'publish' ? 'primary' : 'secondary', size: 'sm' })}
        >
          {t(action)}
        </button>
      ))}
    </>
  );
}
