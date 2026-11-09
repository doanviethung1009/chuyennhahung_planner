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

interface Draft {
  title: string;
  startDate: string;
  partySize: string;
  budget: string;
  travelStyle: string;
  pace: string;
  note: string;
}

/**
 * The draft is only the form's own fields. No credential, token or user data
 * ever goes in here (contract). It lives in sessionStorage so it survives the
 * round trip to sign-in in the same tab, and is cleared after a successful save.
 */
const draftKey = (template: string) => `cnh:trip-setup:${template}`;

function readDraft(template: string): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(template));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const out: Partial<Draft> = {};
    for (const key of ['title', 'startDate', 'partySize', 'budget', 'travelStyle', 'pace', 'note'] as const) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return null;
  }
}

function writeDraft(template: string, draft: Draft) {
  try {
    window.sessionStorage.setItem(draftKey(template), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the form still works, it just cannot survive a reload.
  }
}

export function TripSetupForm({
  templateSlug,
  defaults,
}: {
  templateSlug: string;
  defaults: { title: string; estimatedTotalVnd: number };
}) {
  const t = useTranslations('tripSetup');
  const tStyle = useTranslations('travelStyle');
  const tPace = useTranslations('pace');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>({
    title: '',
    startDate: '',
    partySize: '2',
    budget: String(defaults.estimatedTotalVnd),
    travelStyle: '',
    pace: '',
    note: '',
  });
  const [hadDraft, setHadDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restoring from sessionStorage can only happen after mount (it does not exist
  // on the server), so this one-shot state update is the intended use of an effect.
  useEffect(() => {
    const saved = readDraft(templateSlug);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft((current) => ({ ...current, ...saved }));
    setHadDraft(saved !== null);
  }, [templateSlug]);

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    writeDraft(templateSlug, next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const partySize = Number(draft.partySize);
    const budget = Number(draft.budget);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
      return setError(t('errorPartySize'));
    }
    if (!Number.isInteger(budget) || budget < 0) return setError(t('errorBudget'));

    // Exactly the contract fields: the create body is strict, so an unknown key is a 422.
    const body: Record<string, unknown> = {
      source: 'template',
      templateSlug,
      startDate: draft.startDate || null,
      partySize,
      budget: { targetTotalVnd: budget },
      note: draft.note.trim() || null,
    };
    if (draft.title.trim()) body.title = draft.title.trim();
    if (draft.travelStyle) body.travelStyle = draft.travelStyle;
    if (draft.pace) body.pace = draft.pace;

    setSaving(true);
    try {
      const view = await api<TripView>('/api/planner', { method: 'POST', body });
      try {
        window.sessionStorage.removeItem(draftKey(templateSlug));
      } catch {
        // Nothing to clear.
      }
      router.push({ pathname: '/my-trips/[id]', params: { id: view.trip.id } });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        // Draft is already in sessionStorage; sign in, then come back to it.
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

      <Field id="ts-title" label={t('title')} hint={t('titleHint', { template: defaults.title })}>
        <input
          id="ts-title"
          className={inputClass}
          value={draft.title}
          maxLength={120}
          aria-describedby="ts-title-hint"
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>

      <Field id="ts-start" label={t('startDate')} hint={t('startDateHint')}>
        <input
          id="ts-start"
          type="date"
          className={inputClass}
          value={draft.startDate}
          aria-describedby="ts-start-hint"
          onChange={(e) => update({ startDate: e.target.value })}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ts-party" label={t('partySize')}>
          <input
            id="ts-party"
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
        <Field id="ts-budget" label={t('budget')} hint={t('budgetHint')}>
          <input
            id="ts-budget"
            type="number"
            inputMode="numeric"
            min={0}
            // Any whole number of đồng: the default is the template's estimate
            // (e.g. 750000), and a coarser step makes the browser block submit.
            step={1}
            required
            className={inputClass}
            value={draft.budget}
            aria-describedby="ts-budget-hint"
            onChange={(e) => update({ budget: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ts-style" label={t('travelStyle')}>
          <select
            id="ts-style"
            className={inputClass}
            value={draft.travelStyle}
            onChange={(e) => update({ travelStyle: e.target.value })}
          >
            <option value="">{t('keepTemplate')}</option>
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {tStyle(style)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ts-pace" label={t('pace')}>
          <select
            id="ts-pace"
            className={inputClass}
            value={draft.pace}
            onChange={(e) => update({ pace: e.target.value })}
          >
            <option value="">{t('keepTemplate')}</option>
            {PACES.map((pace) => (
              <option key={pace} value={pace}>
                {tPace(pace)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="ts-note" label={t('note')} hint={t('noteHint')}>
        <textarea
          id="ts-note"
          rows={4}
          maxLength={2000}
          className={inputClass}
          value={draft.note}
          aria-describedby="ts-note-hint"
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
