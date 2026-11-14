'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import type { TripActivity } from '@/server/planner/schemas';
import { Field, inputClass } from '../field';
import { COST_CATEGORIES, wholeNumber, type Mutate } from './shared';

export interface CatalogPlace {
  slug: string;
  name: { vi: string; en: string };
  suggestedMinutes: number;
  estimatedCostVnd: number;
}

/**
 * Add or edit one activity. A catalog place prefills the title, duration and
 * cost, which stay editable; the place itself cannot change on an existing
 * activity (the update schema has no `placeSlug`).
 */
export function ActivityForm({
  idPrefix,
  places,
  activity,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  places: CatalogPlace[];
  /** Present when editing. */
  activity?: TripActivity;
  onSubmit: (body: Record<string, unknown>) => ReturnType<Mutate>;
  onCancel: () => void;
}) {
  const t = useTranslations('tripEditor');
  const tCat = useTranslations('tripEditor.category');
  const locale = useLocale() as Locale;

  const [placeSlug, setPlaceSlug] = useState(activity?.placeSlug ?? '');
  const [title, setTitle] = useState(activity?.title ?? '');
  const [startTime, setStartTime] = useState(activity?.startTime ?? '');
  const [duration, setDuration] = useState(String(activity?.durationMinutes ?? 60));
  const [cost, setCost] = useState(String(activity?.estimatedCostVnd ?? 0));
  const [scope, setScope] = useState<string>(activity?.costScope ?? 'group');
  const [category, setCategory] = useState<string>(activity?.category ?? 'other');
  const [note, setNote] = useState(activity?.note ?? '');
  const [error, setError] = useState('');

  function pickPlace(slug: string) {
    setPlaceSlug(slug);
    const place = places.find((p) => p.slug === slug);
    if (!place) return;
    setTitle(place.name[locale]);
    setDuration(String(place.suggestedMinutes));
    setCost(String(place.estimatedCostVnd));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const trimmed = title.trim();
    const minutes = wholeNumber(duration, 5, 1440);
    const amount = wholeNumber(cost, 0, Number.MAX_SAFE_INTEGER);
    if (trimmed.length < 2 || trimmed.length > 160) return setError(t('errorTitle'));
    if (minutes === null) return setError(t('errorDuration'));
    if (amount === null) return setError(t('errorAmount'));

    const body: Record<string, unknown> = {
      title: trimmed,
      startTime: startTime || null,
      durationMinutes: minutes,
      estimatedCostVnd: amount,
      costScope: scope,
      category,
      note: note.trim() || null,
    };
    if (!activity) body.placeSlug = placeSlug || null;
    await onSubmit(body);
  }

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border-subtle bg-surface-muted p-4">
      {!activity && places.length > 0 ? (
        <Field id={id('place')} label={t('place')} hint={t('placeHint')}>
          <select
            id={id('place')}
            className={inputClass}
            value={placeSlug}
            aria-describedby={id('place-hint')}
            onChange={(e) => pickPlace(e.target.value)}
          >
            <option value="">{t('placeNone')}</option>
            {places.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name[locale]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field id={id('title')} label={t('activityTitle')}>
        <input id={id('title')} className={inputClass} value={title} maxLength={160} required onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('time')} label={t('startTime')} hint={t('startTimeHint')}>
          <input
            id={id('time')}
            type="time"
            className={inputClass}
            value={startTime}
            aria-describedby={id('time-hint')}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field id={id('duration')} label={t('duration')}>
          <input
            id={id('duration')}
            type="number"
            inputMode="numeric"
            min={5}
            max={1440}
            required
            className={inputClass}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id('cost')} label={t('estimatedCost')}>
          <input
            id={id('cost')}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            className={inputClass}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
        <Field id={id('scope')} label={t('costScope')}>
          <select id={id('scope')} className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="group">{t('scopeGroup')}</option>
            <option value="per_person">{t('scopePerPerson')}</option>
          </select>
        </Field>
        <Field id={id('category')} label={t('categoryLabel')}>
          <select id={id('category')} className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {COST_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {tCat(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id={id('note')} label={t('note')}>
        <textarea id={id('note')} rows={2} maxLength={2000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div role="alert" className="text-sm text-primary-strong">
        {error}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonClass({ size: 'sm' })}>
          {activity ? t('saveChanges') : t('addActivitySubmit')}
        </button>
        <button type="button" className={buttonClass({ size: 'sm', variant: 'secondary' })} onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
