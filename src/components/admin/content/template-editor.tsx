'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from '@/components/planner/api';
import { inputClass } from '@/components/planner/field';
import { EditorProvider, LinesField, LocalizedField, SelectField, TextField, type Draft, type Json } from './form-kit';
import { LiveNotice } from './notices';
import { setAt } from './form-kit';
import { useErrorNotice, type Notice } from './use-record';
import {
  PACES,
  TRAVEL_STYLES,
  VISIBILITIES,
  appendIndex,
  buildPatch,
  canMoveOut,
  isSourceStale,
  normalizeIssuePath,
  shiftIds,
  type TemplateDay,
  type TemplateRecord,
} from './template-utils';

const linkClass = 'font-medium text-primary-strong underline underline-offset-4';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm font-medium text-foreground-muted">{label}</dt>
      <dd className="text-base text-foreground">{children}</dd>
    </div>
  );
}

/** Template editor (P07-6). Every write sends `If-Match`; ordering uses `reorder` / `move-activity` so activity ids survive. */
export function TemplateEditor({ slug }: { slug: string }) {
  const t = useTranslations('adminContent.templates');
  const tf = useTranslations('adminContent.form');
  const ts = useTranslations('adminContent.status');
  const te = useTranslations('adminContent.errors');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const base = `/api/admin/travel/templates/${encodeURIComponent(slug)}`;

  const [record, setRecord] = useState<TemplateRecord | null>(null);
  const [draft, setDraft] = useState<TemplateRecord | null>(null);
  const [loadFailed, setLoadFailed] = useState<Notice | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [issues, setIssues] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoadFailed(null);
    try {
      const data = await api<TemplateRecord>(base);
      setRecord(data);
      setDraft(data);
      setIssues(new Set());
      setNotice(null);
      setFormKey((k) => k + 1);
      try {
        const story = await api<{ updatedAt: string }>(`/api/admin/travel/stories/${encodeURIComponent(data.sourceStorySlug)}`);
        setSourceUpdatedAt(story.updatedAt);
      } catch {
        setSourceUpdatedAt(null); // the source story may be gone: the snapshot stays
      }
    } catch (failure) {
      setLoadFailed(describe(failure));
    }
  }, [base, describe]);

  useEffect(() => {
    // Initial fetch on mount; state is set after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const patch = useMemo(() => (record && draft ? buildPatch(record, draft) : {}), [record, draft]);
  const dirty = Object.keys(patch).length > 0;

  const set = useCallback((path: string, value: Json) => {
    setDraft((current) => (current ? (setAt(current as unknown as Draft, path, value) as unknown as TemplateRecord) : current));
    setNotice(null);
  }, []);

  function failure(error: unknown, attempted?: Record<string, unknown>) {
    if (error instanceof ApiError && error.code === 'validation_failed') {
      setIssues(new Set(error.issuePaths.map(normalizeIssuePath)));
    }
    if (error instanceof ApiError && error.code === 'invalid_state' && attempted?.visibility === 'public') {
      setNotice({ kind: 'error', text: t('publishBlocked') });
      return;
    }
    setNotice(describe(error));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!record || !dirty) return;
    setPending(true);
    setNotice(null);
    setIssues(new Set());
    try {
      const saved = await api<TemplateRecord>(base, { method: 'PATCH', body: patch, version: record.updatedAt });
      setRecord(saved);
      setDraft(saved);
      setFormKey((k) => k + 1);
      setNotice({ kind: 'ok', text: ts('saved') });
    } catch (error) {
      failure(error, patch);
    } finally {
      setPending(false);
    }
  }

  async function order(path: string, body: unknown, okText: string) {
    if (!record) return;
    setPending(true);
    setNotice(null);
    try {
      const saved = await api<TemplateRecord>(`${base}/${path}`, { method: 'POST', body, version: record.updatedAt });
      setRecord(saved);
      setDraft(saved);
      setFormKey((k) => k + 1);
      setNotice({ kind: 'ok', text: okText });
    } catch (error) {
      failure(error);
    } finally {
      setPending(false);
    }
  }

  const back = (
    <p>
      <Link href="/admin/content/templates" className={linkClass}>
        {t('back')}
      </Link>
    </p>
  );

  if (!record || !draft) {
    return (
      <div className="grid gap-5">
        {back}
        {loadFailed ? (
          <>
            <LiveNotice notice={loadFailed} />
            <div>
              <button type="button" onClick={() => void load()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                {te('reload')}
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="text-base text-foreground-muted">
            {tf('loading')}
          </p>
        )}
      </div>
    );
  }

  const snapshot = record.sourceSnapshot;
  const stale = isSourceStale(snapshot.storyUpdatedAt, sourceUpdatedAt);
  const locked = dirty || pending;
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale);

  return (
    <div className="grid gap-8">
      {back}

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-surface p-4">
        <span className="inline-flex min-h-7 items-center rounded-pill border border-border-strong bg-surface px-3 text-sm font-medium text-foreground">
          {t(`visibility.${record.visibility}`)}
        </span>
        <p className="text-sm text-foreground-muted md:ml-auto">{tf('updatedAt', { date: fmt(record.updatedAt) })}</p>
      </div>

      <form key={formKey} onSubmit={save} aria-busy={pending} className="grid gap-8">
        <EditorProvider value={{ draft: draft as unknown as Draft, issues, disabled: pending, set }}>
          <section aria-labelledby="tpl-general" className="grid gap-5">
            <h2 id="tpl-general" className="font-display text-2xl text-foreground">
              {t('sectionGeneral')}
            </h2>
            <LocalizedField path="title" label={t('fieldTitle')} />
            <LocalizedField path="summary" label={t('fieldSummary')} multiline />
            <LocalizedField path="groupSize" label={t('fieldGroupSize')} />
            <div className="grid gap-5 md:grid-cols-3">
              <SelectField path="travelStyle" label={t('fieldTravelStyle')} options={TRAVEL_STYLES.map((v) => ({ value: v, label: t(`style.${v}`) }))} />
              <SelectField path="pace" label={t('fieldPace')} options={PACES.map((v) => ({ value: v, label: t(`pace.${v}`) }))} />
              <SelectField path="visibility" label={t('fieldVisibility')} options={VISIBILITIES.map((v) => ({ value: v, label: t(`visibility.${v}`) }))} />
            </div>
            <p className="text-sm text-foreground-muted">{t('visibilityHint')}</p>
            <LinesField path="itinerarySlugs" label={t('fieldItineraries')} hint={t('linesHint')} />
          </section>

          <section aria-labelledby="tpl-days" className="grid gap-6">
            <h2 id="tpl-days" className="font-display text-2xl text-foreground">
              {t('sectionDays')}
            </h2>
            <p className="text-sm text-foreground-muted">{locked && !pending ? t('orderLocked') : t('orderHint')}</p>
            {draft.days.map((day, dayIndex) => (
              <DayCard
                key={`${dayIndex}-${day.day}`}
                day={day}
                dayIndex={dayIndex}
                allDays={record.days}
                locked={locked}
                onReorder={(ids) => void order('reorder', { day: day.day, activityIds: ids }, t('ordered'))}
                onMove={(activityId, toDay) =>
                  void order(
                    'move-activity',
                    { activityId, toDay, toIndex: appendIndex(record.days.find((d) => d.day === toDay)) },
                    t('moved'),
                  )
                }
              />
            ))}
          </section>
        </EditorProvider>

        <div className="sticky bottom-0 z-10 grid gap-3 border-t border-border-subtle bg-surface py-4">
          <LiveNotice notice={notice} onReload={() => void load()} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending || !dirty} className={buttonClass({ size: 'md' })}>
              {pending ? tf('saving') : tf('save')}
            </button>
            <p className="text-sm text-foreground-muted">{dirty ? tf('unsaved') : tf('noChanges')}</p>
          </div>
        </div>
      </form>

      <section aria-labelledby="tpl-derived" className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4">
        <h2 id="tpl-derived" className="font-display text-2xl text-foreground">
          {t('sectionDerived')}
        </h2>
        <p className="text-sm text-foreground-muted">{t('derivedHint')}</p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={t('derivedDuration')}>{t('days', { count: record.durationDays })}</Fact>
          <Fact label={t('derivedCost')}>{record.estimatedTotalVnd.toLocaleString(locale)} ₫</Fact>
          <Fact label={t('derivedPlaces')}>{record.placeSlugs.length === 0 ? tf('none') : record.placeSlugs.join(', ')}</Fact>
          <Fact label={t('derivedVersion')}>{record.version}</Fact>
        </dl>
      </section>

      <section aria-labelledby="tpl-source" className="grid gap-3 rounded-md border border-border-subtle bg-surface p-4">
        <h2 id="tpl-source" className="font-display text-2xl text-foreground">
          {t('sectionSource')}
        </h2>
        <p className="text-sm text-foreground-muted">{t('snapshotHint')}</p>
        {stale ? (
          <p role="status" className="rounded-md border border-primary bg-surface-muted px-4 py-3 text-base text-foreground">
            {t('sourceStale')}
          </p>
        ) : sourceUpdatedAt === null ? (
          <p className="text-sm text-foreground-muted">{t('sourceUnknown')}</p>
        ) : null}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t('snapshotStory')}>
            <Link href={{ pathname: '/admin/content/stories/[slug]', params: { slug: snapshot.storySlug } }} className={linkClass}>
              {snapshot.storySlug}
            </Link>
          </Fact>
          <Fact label={t('snapshotTitle')}>{snapshot.title[locale === 'en' ? 'en' : 'vi']}</Fact>
          <Fact label={t('snapshotDates')}>
            {snapshot.travelDates.start} – {snapshot.travelDates.end}
          </Fact>
          <Fact label={t('snapshotCost')}>
            {snapshot.actualCostTotalVnd === null ? tf('none') : `${snapshot.actualCostTotalVnd.toLocaleString(locale)} ₫`}
          </Fact>
          <Fact label={t('snapshotPlaces')}>{snapshot.placeSlugs.length === 0 ? tf('none') : snapshot.placeSlugs.join(', ')}</Fact>
          <Fact label={t('snapshotTaken')}>{fmt(snapshot.snapshotTakenAt)}</Fact>
        </dl>
      </section>
    </div>
  );
}

function DayCard({
  day,
  dayIndex,
  allDays,
  locked,
  onReorder,
  onMove,
}: {
  day: TemplateDay;
  dayIndex: number;
  allDays: readonly TemplateDay[];
  locked: boolean;
  onReorder: (ids: string[]) => void;
  onMove: (activityId: string, toDay: number) => void;
}) {
  const t = useTranslations('adminContent.templates');
  const ids = day.activities.map((a) => a.id);
  const otherDays = allDays.filter((d) => d.day !== day.day);
  const movable = canMoveOut(day);
  const dayPath = `days.${dayIndex}`;
  const headingId = `tpl-day-${dayIndex}`;

  return (
    <article aria-labelledby={headingId} className="grid gap-5 rounded-md border border-border-subtle bg-surface p-4">
      <h3 id={headingId} className="font-display text-xl text-foreground">
        {t('dayHeading', { n: day.day })}
      </h3>
      <LocalizedField path={`${dayPath}.title`} label={t('fieldDayTitle')} />
      <LocalizedField path={`${dayPath}.summary`} label={t('fieldDaySummary')} multiline nullable />
      <ol className="grid gap-4">
        {day.activities.map((activity, index) => {
          const path = `${dayPath}.activities.${index}`;
          const upIds = shiftIds(ids, index, -1);
          const downIds = shiftIds(ids, index, 1);
          const selectId = `${headingId}-move-${index}`;
          return (
            <li key={activity.id} className="grid gap-4 rounded-md border border-border-subtle p-4">
              <h4 className="text-lg font-medium text-foreground">{t('activityHeading', { n: index + 1 })}</h4>
              <LocalizedField path={`${path}.title`} label={t('fieldActTitle')} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField path={`${path}.placeSlug`} label={t('fieldPlace')} hint={t('placeHint')} nullable />
                <TextField path={`${path}.startTime`} label={t('fieldStart')} hint={t('startHint')} nullable />
                <TextField path={`${path}.durationMinutes`} label={t('fieldDuration')} type="number" />
                <TextField path={`${path}.estimatedCostVnd`} label={t('fieldCost')} type="number" />
              </div>
              <LocalizedField path={`${path}.note`} label={t('fieldNote')} multiline nullable />
              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  disabled={locked || !upIds}
                  onClick={() => upIds && onReorder(upIds)}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  {t('moveUp')}
                </button>
                <button
                  type="button"
                  disabled={locked || !downIds}
                  onClick={() => downIds && onReorder(downIds)}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  {t('moveDown')}
                </button>
                {otherDays.length > 0 ? (
                  <div>
                    <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
                      {t('moveToDay')}
                    </label>
                    <select
                      id={selectId}
                      className={`${inputClass} mt-1.5`}
                      disabled={locked || !movable}
                      value=""
                      onChange={(e) => e.target.value && onMove(activity.id, Number(e.target.value))}
                    >
                      <option value="">{t('moveChoose')}</option>
                      {otherDays.map((d) => (
                        <option key={d.day} value={d.day}>
                          {t('dayHeading', { n: d.day })}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
