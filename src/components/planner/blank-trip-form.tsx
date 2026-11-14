'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import type { TripView } from '@/server/planner/repository';
import { ApiError, api, goToSignIn } from './api';
import { Field, inputClass } from './field';

const STYLES = ['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'] as const;
const PACES = ['relaxed', 'balanced', 'active'] as const;
const DAY_LIMIT = 30;

interface Draft {
  title: string;
  destinationSlug: string;
  durationDays: string;
  startDate: string;
  partySize: string;
  budget: string;
  travelStyle: string;
  pace: string;
  note: string;
}

const EMPTY: Draft = {
  title: '',
  destinationSlug: '',
  durationDays: '3',
  startDate: '',
  partySize: '2',
  budget: '0',
  travelStyle: '',
  pace: '',
  note: '',
};

/**
 * Only the form's own fields live in the draft — no credential, token or user
 * data. It survives the round trip to sign-in in the same tab (sessionStorage)
 * and is cleared after a successful save.
 */
const DRAFT_KEY = 'cnh:new-trip';

function readDraft(): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const out: Partial<Draft> = {};
    for (const key of Object.keys(EMPTY) as (keyof Draft)[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the form still works, it just cannot survive a reload.
  }
}

export function BlankTripForm({ destinations }: { destinations: { slug: string; name: string }[] }) {
  const t = useTranslations('newTrip');
  const tStyle = useTranslations('travelStyle');
  const tPace = useTranslations('pace');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hadDraft, setHadDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sessionStorage does not exist on the server, so restoring can only happen after mount.
  useEffect(() => {
    const saved = readDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft((current) => ({ ...current, ...saved }));
    setHadDraft(saved !== null);
  }, []);

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    writeDraft(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const title = draft.title.trim();
    const durationDays = Number(draft.durationDays);
    const partySize = Number(draft.partySize);
    const budget = Number(draft.budget);
    if (title.length < 3 || title.length > 120) return setError(t('errorTitle'));
    if (!draft.destinationSlug) return setError(t('errorDestination'));
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > DAY_LIMIT) {
      return setError(t('errorDuration'));
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) return setError(t('errorPartySize'));
    if (!Number.isInteger(budget) || budget < 0) return setError(t('errorBudget'));

    // Exactly the contract fields: the create body is strict, so an unknown key is a 422.
    const body = {
      source: 'blank',
      title,
      destinationSlug: draft.destinationSlug,
      durationDays,
      startDate: draft.startDate || null,
      partySize,
      travelStyle: draft.travelStyle || null,
      pace: draft.pace || null,
      budget: { targetTotalVnd: budget },
      note: draft.note.trim() || null,
    };

    setSaving(true);
    try {
      const view = await api<TripView>('/api/planner', { method: 'POST', body });
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clear.
      }
      router.push({ pathname: '/my-trips/[id]', params: { id: view.trip.id } });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        goToSignIn(locale);
        return;
      }
      setSaving(false);
      setError(
        failure instanceof ApiError && failure.status === 422 ? t('errorValidation') : t('errorGeneric'),
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" aria-busy={saving}>
      {hadDraft ? (
        <p className="rounded-md bg-surface-muted p-3 text-sm text-foreground-muted">{t('draftNote')}</p>
      ) : null}

      <Field id="nt-title" label={t('title')}>
        <input
          id="nt-title"
          className={inputClass}
          value={draft.title}
          maxLength={120}
          required
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="nt-destination" label={t('destination')}>
          <select
            id="nt-destination"
            className={inputClass}
            value={draft.destinationSlug}
            required
            onChange={(e) => update({ destinationSlug: e.target.value })}
          >
            <option value="">{t('destinationPlaceholder')}</option>
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nt-days" label={t('durationDays')} hint={t('durationHint')}>
          <input
            id="nt-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={DAY_LIMIT}
            required
            className={inputClass}
            value={draft.durationDays}
            aria-describedby="nt-days-hint"
            onChange={(e) => update({ durationDays: e.target.value })}
          />
        </Field>
      </div>

      <Field id="nt-start" label={t('startDate')} hint={t('startDateHint')}>
        <input
          id="nt-start"
          type="date"
          className={inputClass}
          value={draft.startDate}
          aria-describedby="nt-start-hint"
          onChange={(e) => update({ startDate: e.target.value })}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="nt-party" label={t('partySize')}>
          <input
            id="nt-party"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            className={inputClass}
            value={draft.partySize}
            onChange={(e) => update({ partySize: e.target.value })}
          />
        </Field>
        <Field id="nt-budget" label={t('budget')} hint={t('budgetHint')}>
          <input
            id="nt-budget"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            className={inputClass}
            value={draft.budget}
            aria-describedby="nt-budget-hint"
            onChange={(e) => update({ budget: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="nt-style" label={t('travelStyle')}>
          <select
            id="nt-style"
            className={inputClass}
            value={draft.travelStyle}
            onChange={(e) => update({ travelStyle: e.target.value })}
          >
            <option value="">{t('unset')}</option>
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {tStyle(style)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nt-pace" label={t('pace')}>
          <select
            id="nt-pace"
            className={inputClass}
            value={draft.pace}
            onChange={(e) => update({ pace: e.target.value })}
          >
            <option value="">{t('unset')}</option>
            {PACES.map((pace) => (
              <option key={pace} value={pace}>
                {tPace(pace)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="nt-note" label={t('note')} hint={t('noteHint')}>
        <textarea
          id="nt-note"
          rows={4}
          maxLength={2000}
          className={inputClass}
          value={draft.note}
          aria-describedby="nt-note-hint"
          onChange={(e) => update({ note: e.target.value })}
        />
      </Field>

      <div role="alert" className="text-base text-primary-strong">
        {error}
      </div>

      <div>
        <button type="submit" disabled={saving} className={buttonClass({ size: 'lg' })}>
          {saving ? t('saving') : t('save')}
        </button>
        <p className="mt-3 text-sm text-foreground-muted">{t('signInNote')}</p>
      </div>
    </form>
  );
}
