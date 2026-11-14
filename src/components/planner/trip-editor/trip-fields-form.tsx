'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import type { TripView } from '@/server/planner/repository';
import { api } from '../api';
import { Field, inputClass } from '../field';
import { PACES, TRAVEL_STYLES, wholeNumber, type Mutate } from './shared';

/**
 * Edits the trip header. Shrinking the day count is refused by the API while a
 * removed day still holds anything; that surfaces as the `errorState` message
 * from `Mutate`, and nothing changes.
 */
export function TripFieldsForm({ view, busy, mutate }: { view: TripView; busy: boolean; mutate: Mutate }) {
  const t = useTranslations('tripEditor');
  const tStyle = useTranslations('travelStyle');
  const tPace = useTranslations('pace');
  const { trip, budget } = view;

  const [title, setTitle] = useState(trip.title);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [durationDays, setDurationDays] = useState(String(trip.durationDays));
  const [partySize, setPartySize] = useState(String(trip.partySize));
  const [target, setTarget] = useState(String(budget.targetTotalVnd));
  const [travelStyle, setTravelStyle] = useState<string>(trip.travelStyle ?? '');
  const [pace, setPace] = useState<string>(trip.pace ?? '');
  const [note, setNote] = useState(trip.note ?? '');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const trimmed = title.trim();
    const days = wholeNumber(durationDays, 1, 30);
    const party = wholeNumber(partySize, 1, 50);
    const amount = wholeNumber(target, 0, Number.MAX_SAFE_INTEGER);
    if (trimmed.length < 3 || trimmed.length > 120) return setError(t('errorTripTitle'));
    if (days === null) return setError(t('errorDays'));
    if (party === null) return setError(t('errorParty'));
    if (amount === null) return setError(t('errorAmount'));

    await mutate(t('tripSaved'), (version) =>
      api<TripView>(`/api/planner/${encodeURIComponent(trip.id)}`, {
        method: 'PATCH',
        version,
        body: {
          title: trimmed,
          startDate: startDate || null,
          durationDays: days,
          partySize: party,
          budget: { targetTotalVnd: amount },
          travelStyle: travelStyle || null,
          pace: pace || null,
          note: note.trim() || null,
        },
      }),
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" aria-busy={busy}>
      <Field id="tf-title" label={t('tripTitle')}>
        <input id="tf-title" className={inputClass} value={title} maxLength={120} required onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tf-start" label={t('startDate')} hint={t('startDateHint')}>
          <input
            id="tf-start"
            type="date"
            className={inputClass}
            value={startDate}
            aria-describedby="tf-start-hint"
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field id="tf-days" label={t('durationDays')} hint={t('durationDaysHint')}>
          <input
            id="tf-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            required
            className={inputClass}
            value={durationDays}
            aria-describedby="tf-days-hint"
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tf-party" label={t('partySize')}>
          <input
            id="tf-party"
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
        <Field id="tf-target" label={t('targetBudget')}>
          <input
            id="tf-target"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            className={inputClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tf-style" label={t('travelStyle')}>
          <select id="tf-style" className={inputClass} value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)}>
            <option value="">{t('unset')}</option>
            {TRAVEL_STYLES.map((value) => (
              <option key={value} value={value}>
                {tStyle(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="tf-pace" label={t('pace')}>
          <select id="tf-pace" className={inputClass} value={pace} onChange={(e) => setPace(e.target.value)}>
            <option value="">{t('unset')}</option>
            {PACES.map((value) => (
              <option key={value} value={value}>
                {tPace(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="tf-note" label={t('note')}>
        <textarea id="tf-note" rows={3} maxLength={2000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div role="alert" className="text-sm text-primary-strong">
        {error}
      </div>

      <div>
        <button type="submit" disabled={busy} className={buttonClass({ size: 'sm' })}>
          {t('saveChanges')}
        </button>
      </div>
    </form>
  );
}
