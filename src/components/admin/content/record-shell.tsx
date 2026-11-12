'use client';

import type { FormEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonClass } from '@/components/ui/button';
import { EditorProvider, type Draft } from './form-kit';
import { ActionButtons, LiveNotice, StatusBadge } from './notices';
import { useRecord } from './use-record';

interface Props {
  apiPath: string;
  statusPath: string | null;
  fields: readonly string[];
  /** Whether the record has a publish lifecycle (stories do, places do not). */
  lifecycle: boolean;
  back: 'stories' | 'places';
  children: (draft: Draft) => ReactNode;
}

/**
 * Loads one record and wraps the entity-specific fields in the save bar, the
 * publish controls and the live status region. The client island of every
 * edit page; the page around it is a server component.
 */
export function RecordShell({ apiPath, statusPath, fields, lifecycle, back, children }: Props) {
  const t = useTranslations('adminContent');
  const state = useRecord(apiPath, fields, statusPath);
  const { record, draft, pending } = state;

  const backLink =
    back === 'stories' ? (
      <Link href="/admin/content/stories" className="font-medium text-primary-strong underline underline-offset-4">
        {t('stories.back')}
      </Link>
    ) : (
      <Link href="/admin/content/places" className="font-medium text-primary-strong underline underline-offset-4">
        {t('places.back')}
      </Link>
    );

  if (!record || !draft) {
    return (
      <div className="grid gap-5">
        <p>{backLink}</p>
        {state.loadFailed ? (
          <>
            <LiveNotice notice={state.loadFailed} />
            <div>
              <button type="button" onClick={() => void state.reload()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                {t('errors.reload')}
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="text-base text-foreground-muted">
            {t('form.loading')}
          </p>
        )}
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void state.save();
  }

  const status = typeof record.status === 'string' ? record.status : null;

  return (
    <div className="grid gap-8">
      <p>{backLink}</p>

      <div className="grid gap-4 rounded-md border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          {lifecycle && status ? (
            <>
              <span className="text-sm font-medium text-foreground-muted">{t('form.statusLabel')}</span>
              <StatusBadge status={status} />
              <ActionButtons
                kind="story"
                status={status}
                disabled={pending !== null}
                onAction={(action) => void state.runAction(action)}
              />
            </>
          ) : null}
          <p className="text-sm text-foreground-muted md:ml-auto">
            {t('form.updatedAt', { date: new Date(String(record.updatedAt)).toLocaleString(state.locale) })}
          </p>
        </div>
      </div>

      <form key={state.formKey} onSubmit={submit} aria-busy={pending !== null} className="grid gap-8">
        <EditorProvider value={{ draft, issues: state.issues, disabled: pending !== null, set: state.set }}>
          {children(draft)}
        </EditorProvider>

        <div className="sticky bottom-0 z-10 grid gap-3 border-t border-border-subtle bg-surface py-4">
          <LiveNotice notice={state.notice} onReload={() => void state.reload()} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending !== null || !state.dirty} className={buttonClass({ size: 'md' })}>
              {pending === 'save' ? t('form.saving') : t('form.save')}
            </button>
            <p className="text-sm text-foreground-muted">{state.dirty ? t('form.unsaved') : t('form.noChanges')}</p>
          </div>
        </div>
      </form>
    </div>
  );
}
