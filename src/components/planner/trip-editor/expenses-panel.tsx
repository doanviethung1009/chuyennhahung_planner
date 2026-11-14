'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/i18n/routing';
import type { TripView } from '@/server/planner/repository';
import { api } from '../api';
import { Field, inputClass } from '../field';
import { COST_CATEGORIES, formatDong, wholeNumber, type Mutate } from './shared';

type Expense = TripView['expenses'][number];
const rowButton = buttonClass({ size: 'sm', variant: 'secondary' });

function ExpenseForm({
  idPrefix,
  view,
  expense,
  busy,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  view: TripView;
  expense?: Expense;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => ReturnType<Mutate>;
  onCancel: () => void;
}) {
  const t = useTranslations('tripEditor');
  const tCat = useTranslations('tripEditor.category');
  const tDetail = useTranslations('tripDetail');

  const currentDay = expense?.dayId ? view.days.find((d) => d.id === expense.dayId)?.dayNumber : undefined;
  const [label, setLabel] = useState(expense?.label ?? '');
  const [category, setCategory] = useState<string>(expense?.category ?? 'other');
  const [amount, setAmount] = useState(String(expense?.amountVnd ?? ''));
  const [scope, setScope] = useState<string>(expense?.costScope ?? 'group');
  const [dayNumber, setDayNumber] = useState(currentDay ? String(currentDay) : '');
  const [paidOn, setPaidOn] = useState(expense?.paidOn ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState('');

  // The link to an activity is kept as it is: this form edits money, not the plan.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const trimmed = label.trim();
    const value = wholeNumber(amount, 0, Number.MAX_SAFE_INTEGER);
    if (trimmed.length < 2 || trimmed.length > 160) return setError(t('errorLabel'));
    if (value === null) return setError(t('errorAmount'));
    await onSubmit({
      label: trimmed,
      category,
      amountVnd: value,
      costScope: scope,
      // Left out for a linked expense: its day comes from the activity.
      ...(expense?.activityId ? {} : { dayNumber: dayNumber ? Number(dayNumber) : null }),
      paidOn: paidOn || null,
      note: note.trim() || null,
    });
  }

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border-subtle bg-surface-muted p-4" aria-busy={busy}>
      <Field id={id('label')} label={t('expenseLabel')}>
        <input id={id('label')} className={inputClass} value={label} maxLength={160} required onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id('amount')} label={t('expenseAmount')}>
          <input
            id={id('amount')}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('day')} label={t('expenseDay')} hint={expense?.activityId ? t('expenseDayLinked') : undefined}>
          <select
            id={id('day')}
            className={inputClass}
            value={dayNumber}
            // A day follows the linked activity: the API refuses a different one.
            disabled={Boolean(expense?.activityId)}
            aria-describedby={expense?.activityId ? id('day-hint') : undefined}
            onChange={(e) => setDayNumber(e.target.value)}
          >
            <option value="">{t('expenseWholeTrip')}</option>
            {view.days.map((day) => (
              <option key={day.id} value={day.dayNumber}>
                {tDetail('day', { number: day.dayNumber })}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id('paid')} label={t('paidOn')}>
          <input id={id('paid')} type="date" className={inputClass} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
      </div>
      <Field id={id('note')} label={t('note')}>
        <textarea id={id('note')} rows={2} maxLength={2000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div role="alert" className="text-sm text-primary-strong">
        {error}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={buttonClass({ size: 'sm' })}>
          {expense ? t('saveChanges') : t('addExpenseSubmit')}
        </button>
        <button type="button" className={rowButton} onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

export function ExpensesPanel({ view, busy, mutate }: { view: TripView; busy: boolean; mutate: Mutate }) {
  const t = useTranslations('tripEditor');
  const tCat = useTranslations('tripEditor.category');
  const tDetail = useTranslations('tripDetail');
  const locale = useLocale() as Locale;
  const base = `/api/planner/${encodeURIComponent(view.trip.id)}/expenses`;

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section aria-labelledby="detail-expenses" className="grid gap-4">
      <h2 id="detail-expenses" className="font-display text-2xl font-semibold">
        {t('expensesHeading')}
      </h2>
      <p className="text-base text-foreground-muted">
        {t('expensesTotal', {
          paid: formatDong(view.budget.actualTotalVnd, locale),
          remaining: formatDong(view.budget.remainingVnd, locale),
        })}
      </p>

      {view.expenses.length === 0 && !adding ? <p className="text-base text-foreground-muted">{t('expensesEmpty')}</p> : null}

      <ul className="grid list-none gap-4 p-0">
        {view.expenses.map((expense) => {
          const dayNumber = expense.dayId ? view.days.find((d) => d.id === expense.dayId)?.dayNumber : undefined;
          return (
            <li key={expense.id} className="grid gap-3 rounded-xl border border-border-subtle bg-surface p-4">
              {editingId === expense.id ? (
                <ExpenseForm
                  idPrefix={`ex-${expense.id}`}
                  view={view}
                  expense={expense}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (body) => {
                    const ok = await mutate(
                      t('expenseSaved'),
                      (version) => api<TripView>(`${base}/${encodeURIComponent(expense.id)}`, { method: 'PATCH', version, body }),
                      { refocus: true },
                    );
                    if (ok) setEditingId(null);
                    return ok;
                  }}
                />
              ) : (
                <>
                  <div>
                    <p className="text-base font-medium">{expense.label}</p>
                    <p className="mt-0.5 text-sm text-foreground-muted">
                      {formatDong(expense.amountVnd, locale)}
                      {expense.costScope === 'per_person' ? ` ${t('perPersonSuffix')}` : ''} · {tCat(expense.category)} ·{' '}
                      {dayNumber ? tDetail('day', { number: dayNumber }) : t('expenseWholeTrip')}
                      {expense.paidOn ? ` · ${formatDate(expense.paidOn, locale)}` : ''}
                    </p>
                    {expense.note ? <p className="mt-0.5 text-sm text-foreground-muted">{expense.note}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className={rowButton}
                      aria-label={t('editExpenseLabel', { label: expense.label })}
                      onClick={() => setEditingId(expense.id)}
                    >
                      {t('edit')}
                    </button>
                    {confirmId === expense.id ? (
                      <div role="group" aria-label={t('deleteConfirmLabel', { title: expense.label })} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-primary-strong">{t('deleteExpenseConfirm')}</span>
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonClass({ size: 'sm' })}
                          onClick={async () => {
                            const ok = await mutate(
                              t('expenseDeleted'),
                              (version) => api<TripView>(`${base}/${encodeURIComponent(expense.id)}`, { method: 'DELETE', version }),
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
                        aria-label={t('deleteExpenseLabel', { label: expense.label })}
                        onClick={() => setConfirmId(expense.id)}
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <ExpenseForm
          idPrefix="ex-new"
          view={view}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSubmit={async (body) => {
            const ok = await mutate(t('expenseAdded'), (version) => api<TripView>(base, { method: 'POST', version, body }), {
              refocus: true,
            });
            if (ok) setAdding(false);
            return ok;
          }}
        />
      ) : (
        <div>
          <button type="button" disabled={busy} className={rowButton} onClick={() => setAdding(true)}>
            {t('addExpense')}
          </button>
        </div>
      )}
    </section>
  );
}
