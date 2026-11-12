'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { EditorProvider, LocalizedField, LocalizedListField, TextField, SelectField, type Draft } from './form-kit';
import { ActionButtons, LiveNotice, StatusBadge } from './notices';
import { useErrorNotice, useRecord, type Notice, type StatusAction } from './use-record';

interface Review {
  id: string;
  status: string;
  updatedAt: string;
  rating: number;
  author: string;
  title: { vi: string; en: string };
  subject: { kind: string; ref: string };
}

const STATUSES = ['', 'draft', 'published', 'archived'] as const;
const FIELDS = ['subject', 'title', 'rating', 'body', 'pros', 'cons', 'visitedOn', 'costVnd', 'author'] as const;
const SUBJECT_KINDS = ['place', 'destination', 'itinerary'] as const;

function ReviewForm({ id, onSaved, onClose }: { id: string; onSaved: (review: Review) => void; onClose: () => void }) {
  const t = useTranslations('adminContent');
  const tr = useTranslations('adminContent.reviews');
  const state = useRecord(`/api/admin/travel/reviews/${encodeURIComponent(id)}`, FIELDS, null);
  const { draft, record, pending } = state;

  if (!draft || !record) {
    return state.loadFailed ? (
      <div className="grid gap-3">
        <LiveNotice notice={state.loadFailed} />
        <div>
          <button type="button" onClick={() => void state.reload()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            {t('errors.reload')}
          </button>
        </div>
      </div>
    ) : (
      <p role="status" className="text-base text-foreground-muted">
        {t('form.loading')}
      </p>
    );
  }

  return (
    <form
      key={state.formKey}
      aria-busy={pending !== null}
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void state.save().then((saved) => {
          if (saved) onSaved(saved as unknown as Review);
        });
      }}
    >
      <EditorProvider value={{ draft: draft as Draft, issues: state.issues, disabled: pending !== null, set: state.set }}>
        <LocalizedField path="title" label={tr('fieldTitle')} />
        <LocalizedListField path="body" label={tr('fieldBody')} paragraphs />
        <LocalizedListField path="pros" label={tr('fieldPros')} />
        <LocalizedListField path="cons" label={tr('fieldCons')} />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField path="rating" label={tr('fieldRating')} type="number" hint={tr('ratingHint')} />
          <TextField path="visitedOn" label={tr('fieldVisited')} type="date" />
          <TextField path="costVnd" label={tr('fieldCost')} type="number" hint={tr('costHint')} />
          <TextField path="author" label={tr('fieldAuthor')} />
          <SelectField
            path="subject.kind"
            label={tr('fieldSubjectKind')}
            options={SUBJECT_KINDS.map((value) => ({ value, label: tr(`subjects.${value}`) }))}
          />
          <TextField path="subject.ref" label={tr('fieldSubjectRef')} />
        </div>
      </EditorProvider>
      <LiveNotice notice={state.notice} onReload={() => void state.reload()} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending !== null || !state.dirty} className={buttonClass({ size: 'md' })}>
          {pending === 'save' ? t('form.saving') : t('form.save')}
        </button>
        <button type="button" onClick={onClose} className={buttonClass({ variant: 'secondary', size: 'md' })}>
          {tr('close')}
        </button>
        <p className="text-sm text-foreground-muted">{state.dirty ? t('form.unsaved') : t('form.noChanges')}</p>
      </div>
    </form>
  );
}

/** Moderation queue: filter, publish / unpublish, and edit a review in place. */
export function ReviewQueue() {
  const t = useTranslations('adminContent');
  const tr = useTranslations('adminContent.reviews');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('');
  const [error, setError] = useState<Notice | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = filter ? `?status=${filter}` : '';
      const data = await api<{ reviews: Review[] }>(`/api/admin/travel/reviews${query}`);
      setReviews(data.reviews);
    } catch (failure) {
      setReviews(null);
      setError(describe(failure));
    }
  }, [filter, describe]);

  useEffect(() => {
    // Fetch on mount and whenever the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const replace = (next: Review) =>
    setReviews((current) => current?.map((r) => (r.id === next.id ? { ...r, ...next } : r)) ?? current);

  async function moderate(review: Review, action: StatusAction) {
    setBusyId(review.id);
    setNotice(null);
    try {
      const result = await api<Review>(`/api/admin/travel/reviews/${encodeURIComponent(review.id)}/status`, {
        method: 'POST',
        body: { action },
      });
      replace(result);
      setNotice({ kind: 'ok', text: t(`status.${action}`) });
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="max-w-xs">
        <label htmlFor="review-status-filter" className="block text-sm font-medium text-foreground">
          {t('list.filterLabel')}
        </label>
        <div className="mt-1.5">
          <select
            id="review-status-filter"
            className={inputClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value as (typeof STATUSES)[number])}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value ? t(`statuses.${value}`) : t('list.all')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LiveNotice notice={error ?? notice} onReload={() => void load()} />
      {error ? (
        <div>
          <button type="button" onClick={() => void load()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            {t('list.retry')}
          </button>
        </div>
      ) : null}

      {reviews === null ? (
        error ? null : <p className="text-base text-foreground-muted">{t('form.loading')}</p>
      ) : reviews.length === 0 ? (
        <p className="text-base text-foreground-muted">{t('list.empty')}</p>
      ) : (
        <>
          <p className="text-sm text-foreground-muted">{t('list.count', { count: reviews.length })}</p>
          <ul className="grid gap-4">
            {reviews.map((review) => {
              const open = editing === review.id;
              return (
                <li key={review.id} className="grid gap-4 rounded-md border border-border-subtle bg-surface p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="grid gap-1">
                      <h2 className="font-display text-xl text-foreground">{review.title[locale]}</h2>
                      <p className="text-sm text-foreground-muted">
                        {tr('meta', {
                          rating: review.rating,
                          author: review.author,
                          subject: `${review.subject.kind}: ${review.subject.ref}`,
                        })}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {t('list.updated', { date: new Date(review.updatedAt).toLocaleString(locale) })}
                      </p>
                    </div>
                    <StatusBadge status={review.status} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ActionButtons
                      kind="review"
                      status={review.status}
                      disabled={busyId === review.id}
                      onAction={(action) => void moderate(review, action)}
                    />
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`review-edit-${review.id}`}
                      onClick={() => setEditing(open ? null : review.id)}
                      className={buttonClass({ variant: 'ghost', size: 'sm' })}
                    >
                      {open ? tr('close') : tr('edit')}
                    </button>
                  </div>
                  {open ? (
                    <div id={`review-edit-${review.id}`} className="border-t border-border-subtle pt-4">
                      <ReviewForm
                        id={review.id}
                        onSaved={(saved) => {
                          replace(saved);
                          setNotice({ kind: 'ok', text: t('status.saved') });
                        }}
                        onClose={() => setEditing(null)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

