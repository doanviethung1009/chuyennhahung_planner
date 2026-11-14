'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { destinations } from '@/content/destinations';
import type { TripView } from '@/server/planner/repository';
import { ApiError, api, goToSignIn } from './api';
import { Field, inputClass } from './field';

const STYLES = ['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'] as const;
const PACES = ['relaxed', 'balanced', 'active'] as const;

/** A trip planned from scratch: `source: "blank"`, days generated from `durationDays`. */
export function NewTripForm() {
  const t = useTranslations('newTrip');
  const tStyle = useTranslations('travelStyle');
  const tPace = useTranslations('pace');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [destinationSlug, setDestinationSlug] = useState('');
  const [durationDays, setDurationDays] = useState('3');
  const [startDate, setStartDate] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [budget, setBudget] = useState('0');
  const [travelStyle, setTravelStyle] = useState('');
  const [pace, setPace] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = title.trim();
    const days = Number(durationDays);
    const party = Number(partySize);
    const target = Number(budget);
    if (name.length < 3 || name.length > 120) return setError(t('errorTitle'));
    if (!destinationSlug) return setError(t('errorDestination'));
    if (!Number.isInteger(days) || days < 1 || days > 30) return setError(t('errorDuration'));
    if (!Number.isInteger(party) || party < 1 || party > 50) return setError(t('errorPartySize'));
    if (!Number.isInteger(target) || target < 0) return setError(t('errorBudget'));

    // Exactly the contract fields: the create body is strict, so an unknown key is a 422.
    const body = {
      source: 'blank',
      title: name,
      destinationSlug,
      startDate: startDate || null,
      durationDays: days,
      partySize: party,
      travelStyle: travelStyle || null,
      pace: pace || null,
      budget: { targetTotalVnd: target },
      note: note.trim() || null,
    };

    setSaving(true);
    try {
      const view = await api<TripView>('/api/planner', { method: 'POST', body });
      router.push({ pathname: '/my-trips/[id]', params: { id: view.trip.id } });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        goToSignIn(locale);
        return;
      }
      setSaving(false);
      setError(failure instanceof ApiError && failure.status === 422 ? t('errorValidation') : t('errorGeneric'));
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" aria-busy={saving}>
      <Field id="nt-title" label={t('title')}>
        <input
          id="nt-title"
          className={inputClass}
          value={title}
          maxLength={120}
          required
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="nt-destination" label={t('destination')}>
          <select
            id="nt-destination"
            className={inputClass}
            value={destinationSlug}
            required
            onChange={(e) => setDestinationSlug(e.target.value)}
          >
            <option value="">{t('unset')}</option>
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name[locale]}
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
            max={30}
            required
            className={inputClass}
            value={durationDays}
            aria-describedby="nt-days-hint"
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </Field>
      </div>

      <Field id="nt-start" label={t('startDate')} hint={t('startDateHint')}>
        <input
          id="nt-start"
          type="date"
          className={inputClass}
          value={startDate}
          aria-describedby="nt-start-hint"
          onChange={(e) => setStartDate(e.target.value)}
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
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
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
            value={budget}
            aria-describedby="nt-budget-hint"
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="nt-style" label={t('travelStyle')}>
          <select
            id="nt-style"
            className={inputClass}
            value={travelStyle}
            onChange={(e) => setTravelStyle(e.target.value)}
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
          <select id="nt-pace" className={inputClass} value={pace} onChange={(e) => setPace(e.target.value)}>
            <option value="">{t('unset')}</option>
            {PACES.map((p) => (
              <option key={p} value={p}>
                {tPace(p)}
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
          value={note}
          aria-describedby="nt-note-hint"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div role="alert" className="text-base text-primary-strong">
        {error}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={buttonClass({ size: 'lg' })}>
          {saving ? t('saving') : t('save')}
        </button>
        <Link href="/my-trips" className={buttonClass({ size: 'lg', variant: 'ghost' })}>
          {t('cancel')}
        </Link>
      </div>
      <p className="text-sm text-foreground-muted">{t('signInNote')}</p>
    </form>
  );
}
