'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/i18n/routing';
import { api } from '../api';
import type { TripView } from '@/server/planner/repository';
import { Field, inputClass } from '../field';
import { ActivityForm, type CatalogPlace } from './activity-form';
import { ACTIVITIES_PER_DAY_LIMIT, formatDong, type Mutate } from './shared';

type Day = TripView['days'][number];

/** The small outline button used for every row action. */
const rowButton = buttonClass({ size: 'sm', variant: 'secondary' });

const MOVE_ORDER = { up: ['up', 'down', 'day'], down: ['down', 'up', 'day'], day: ['day', 'up', 'down'] } as const;

/** Waits (a few frames) for the page to re-enable the row, then focuses the first usable control. */
function focusMoveControl(activityId: string, control: 'up' | 'down' | 'day', attempt = 0): void {
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-activity-id="${CSS.escape(activityId)}"]`);
    for (const kind of MOVE_ORDER[control]) {
      const el = row?.querySelector<HTMLElement>(`[data-move="${kind}"]:not(:disabled)`);
      if (el) {
        el.focus();
        return;
      }
    }
    if (attempt < 60) focusMoveControl(activityId, control, attempt + 1);
  });
}

export function DayCard({
  tripId,
  day,
  dayCount,
  fullDays,
  places,
  busy,
  mutate,
}: {
  tripId: string;
  day: Day;
  dayCount: number;
  /** Day numbers already at the activity limit: nothing can be added or moved into them. */
  fullDays: Set<number>;
  places: CatalogPlace[];
  busy: boolean;
  mutate: Mutate;
}) {
  const t = useTranslations('tripEditor');
  const tDetail = useTranslations('tripDetail');
  const locale = useLocale() as Locale;
  const base = `/api/planner/${encodeURIComponent(tripId)}`;

  const [editingDay, setEditingDay] = useState(false);
  const [dayTitle, setDayTitle] = useState(day.title ?? '');
  const [dayNote, setDayNote] = useState(day.note ?? '');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function saveDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await mutate(
      t('daySaved'),
      (version) =>
        api<TripView>(`${base}/days/${day.dayNumber}`, {
          method: 'PATCH',
          version,
          body: { title: dayTitle.trim() || null, note: dayNote.trim() || null },
        }),
      { refocus: true },
    );
    if (ok) setEditingDay(false);
  }

  /**
   * The move controls are disabled while the write is in flight, so focus would
   * drop to <body> and a keyboard user would lose their place. Once the page
   * has re-rendered, put it back on the control they used — on the moved row,
   * wherever it landed — falling back to whichever control there is still
   * enabled (the up button is disabled on the first row, and so on).
   */
  const move = async (
    activityId: string,
    toDayNumber: number,
    toIndex: number,
    control: 'up' | 'down' | 'day',
  ) => {
    const ok = await mutate(
      t('moved'),
      (version) =>
        api<TripView>(`${base}/reorder`, {
          method: 'PATCH',
          version,
          body: { op: 'move-activity', activityId, toDayNumber, toIndex },
        }),
      { conflictMessage: t('errorDayFull', { max: ACTIVITIES_PER_DAY_LIMIT }) },
    );
    if (ok) focusMoveControl(activityId, control);
    return ok;
  };

  const heading = day.title ?? tDetail('day', { number: day.dayNumber });
  const last = day.activities.length - 1;
  const full = day.activities.length >= ACTIVITIES_PER_DAY_LIMIT;
  const moveTargets = Array.from({ length: dayCount }, (_, i) => i + 1).filter(
    (n) => n !== day.dayNumber && !fullDays.has(n),
  );

  return (
    <li className="rounded-xl border border-border-subtle bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold md:text-xl">{heading}</h3>
          {day.title ? (
            <p className="text-sm text-foreground-muted">{tDetail('day', { number: day.dayNumber })}</p>
          ) : null}
          {day.date ? <p className="mt-1 text-sm text-foreground-muted">{formatDate(day.date, locale)}</p> : null}
          {day.note ? <p className="mt-2 text-base text-foreground-muted">{day.note}</p> : null}
        </div>
        {!editingDay ? (
          <button
            type="button"
            disabled={busy}
            className={rowButton}
            aria-label={t('editDayLabel', { day: day.dayNumber })}
            onClick={() => {
              setDayTitle(day.title ?? '');
              setDayNote(day.note ?? '');
              setEditingDay(true);
            }}
          >
            {t('editDay')}
          </button>
        ) : null}
      </div>

      {editingDay ? (
        <form onSubmit={saveDay} className="mt-4 grid gap-4 rounded-lg border border-border-subtle bg-surface-muted p-4">
          <Field id={`day-${day.dayNumber}-title`} label={t('dayTitle')}>
            <input
              id={`day-${day.dayNumber}-title`}
              className={inputClass}
              value={dayTitle}
              maxLength={160}
              onChange={(e) => setDayTitle(e.target.value)}
            />
          </Field>
          <Field id={`day-${day.dayNumber}-note`} label={t('dayNote')}>
            <textarea
              id={`day-${day.dayNumber}-note`}
              rows={2}
              maxLength={2000}
              className={inputClass}
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={buttonClass({ size: 'sm' })}>
              {t('saveChanges')}
            </button>
            <button type="button" className={rowButton} onClick={() => setEditingDay(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {day.activities.length === 0 && !adding ? (
        <p className="mt-4 text-base text-foreground-muted">{t('dayEmpty')}</p>
      ) : null}

      <ul className="mt-4 grid list-none gap-4 p-0">
        {day.activities.map((activity, index) => (
          <li key={activity.id} data-activity-id={activity.id} className="grid gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
            {editingId === activity.id ? (
              <ActivityForm
                idPrefix={`edit-${activity.id}`}
                busy={busy}
                places={places}
                activity={activity}
                onCancel={() => setEditingId(null)}
                onSubmit={async (body) => {
                  const ok = await mutate(
                    t('activitySaved'),
                    (version) =>
                      api<TripView>(`${base}/activities/${encodeURIComponent(activity.id)}`, { method: 'PATCH', version, body }),
                    { refocus: true },
                  );
                  if (ok) setEditingId(null);
                  return ok;
                }}
              />
            ) : (
              <>
                <div className="flex gap-4">
                  <span className="w-16 shrink-0 text-sm font-medium text-primary-strong tabular-nums">
                    {activity.startTime ?? tDetail('anytime')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base">{activity.title}</span>
                    <span className="mt-0.5 block text-sm text-foreground-muted">
                      {t('durationValue', { minutes: activity.durationMinutes })} ·{' '}
                      {formatDong(activity.estimatedCostVnd, locale)}
                      {activity.costScope === 'per_person' ? ` ${t('perPersonSuffix')}` : ''}
                    </span>
                    {activity.note ? (
                      <span className="mt-0.5 block text-sm text-foreground-muted">{activity.note}</span>
                    ) : null}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    className={rowButton}
                    data-move="up"
                    aria-label={t('moveUpLabel', { title: activity.title })}
                    onClick={() => move(activity.id, day.dayNumber, index - 1, 'up')}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === last}
                    className={rowButton}
                    data-move="down"
                    aria-label={t('moveDownLabel', { title: activity.title })}
                    onClick={() => move(activity.id, day.dayNumber, index + 1, 'down')}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  {moveTargets.length > 0 ? (
                    <>
                      <label htmlFor={`move-${activity.id}`} className="sr-only">
                        {t('moveToDayLabel', { title: activity.title })}
                      </label>
                      <select
                        id={`move-${activity.id}`}
                        data-move="day"
                        className={`${inputClass} !w-auto`}
                        disabled={busy}
                        value=""
                        onChange={(e) => {
                          const target = Number(e.target.value);
                          if (target) void move(activity.id, target, 0, 'day');
                        }}
                      >
                        <option value="">{t('moveToDay')}</option>
                        {moveTargets.map((n) => (
                          <option key={n} value={n}>
                            {tDetail('day', { number: n })}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    className={rowButton}
                    aria-label={t('editActivityLabel', { title: activity.title })}
                    onClick={() => setEditingId(activity.id)}
                  >
                    {t('edit')}
                  </button>
                  {confirmId === activity.id ? (
                    <div role="group" aria-label={t('deleteConfirmLabel', { title: activity.title })} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-primary-strong">{t('deleteActivityConfirm')}</span>
                      <button
                        type="button"
                        disabled={busy}
                        className={buttonClass({ size: 'sm' })}
                        onClick={async () => {
                          const ok = await mutate(
                            t('activityDeleted'),
                            (version) =>
                              api<TripView>(`${base}/activities/${encodeURIComponent(activity.id)}`, { method: 'DELETE', version }),
                            { refocus: true },
                          );
                          if (ok) setConfirmId(null);
                        }}
                      >
                        {t('confirmYes')}
                      </button>
                      <button type="button" className={rowButton} onClick={() => setConfirmId(null)}>
                        {t('confirmNo')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className={rowButton}
                      aria-label={t('deleteActivityLabel', { title: activity.title })}
                      onClick={() => setConfirmId(activity.id)}
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {adding ? (
          <ActivityForm
            idPrefix={`add-${day.dayNumber}`}
            busy={busy}
            places={places}
            onCancel={() => setAdding(false)}
            onSubmit={async (body) => {
              const ok = await mutate(
                t('activityAdded'),
                (version) =>
                  api<TripView>(`${base}/activities`, {
                    method: 'POST',
                    version,
                    body: { ...body, dayNumber: day.dayNumber },
                  }),
                { refocus: true, conflictMessage: t('errorDayFull', { max: ACTIVITIES_PER_DAY_LIMIT }) },
              );
              if (ok) setAdding(false);
              return ok;
            }}
          />
        ) : (
          <>
            <button
              type="button"
              disabled={busy || full}
              className={rowButton}
              aria-label={t('addActivityLabel', { day: day.dayNumber })}
              aria-describedby={full ? `day-${day.dayNumber}-full` : undefined}
              onClick={() => setAdding(true)}
            >
              {t('addActivity')}
            </button>
            {full ? (
              <p id={`day-${day.dayNumber}-full`} className="mt-2 text-sm text-foreground-muted">
                {t('dayFull', { max: ACTIVITIES_PER_DAY_LIMIT })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
