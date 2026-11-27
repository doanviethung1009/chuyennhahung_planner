'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { inputClass } from '@/components/planner/field';
import { numberToText, parseNumberText } from './number-text';

/**
 * Small form kit for the content editors. The draft is a plain JSON record;
 * every field addresses a dotted path into it (`title.vi`, `content.2.text.en`),
 * which is the same path format the API reports in a 422 `issues` list, so an
 * invalid field can be marked exactly where the server complained.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Draft = { [key: string]: Json };

export function getAt(root: Json | undefined, path: string): Json | undefined {
  let node: Json | undefined = root;
  for (const part of path.split('.')) {
    if (node === null || node === undefined || typeof node !== 'object') return undefined;
    node = (node as Record<string, Json>)[part];
  }
  return node;
}

export function setAt(root: Draft, path: string, value: Json): Draft {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return root;
  const clone: Draft | Json[] = Array.isArray(root) ? ([...root] as Json[]) : { ...root };
  const key = head as keyof typeof clone;
  (clone as Record<string, Json>)[key as string] =
    rest.length === 0
      ? value
      : setAt(((clone as Record<string, Json>)[key as string] ?? {}) as Draft, rest.join('.'), value);
  return clone as Draft;
}

interface EditorContext {
  draft: Draft;
  issues: ReadonlySet<string>;
  /** Why each marked path was refused, already worded; a path without one shows the generic line. */
  reasons?: ReadonlyMap<string, string>;
  disabled: boolean;
  set: (path: string, value: Json) => void;
}

const Ctx = createContext<EditorContext | null>(null);

export function EditorProvider({ value, children }: { value: EditorContext; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditor(): EditorContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('form field used outside EditorProvider');
  return ctx;
}

const invalidClass = 'border-primary';

function Invalid({ id, text }: { id: string; text?: string }) {
  const t = useTranslations('adminContent.form');
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-primary-strong">
      {text ?? t('invalid')}
    </p>
  );
}

function Hint({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="mt-1.5 text-sm text-foreground-muted">
      {text}
    </p>
  ) : null;
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter(Boolean).join(' ');
  return list || undefined;
}

/** A single-value input: text, number, date, select or a multi-line textarea. */
export function TextField({
  path,
  label,
  hint,
  multiline,
  rows = 4,
  type = 'text',
  lang,
  nullable,
}: {
  path: string;
  label: string;
  hint?: string;
  /** Store `null` instead of an empty string. */
  nullable?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'number' | 'date';
  lang?: string;
}) {
  const { draft, issues, reasons, disabled, set } = useEditor();
  const id = useId();
  const raw = getAt(draft, path);
  const value = raw === null || raw === undefined ? '' : String(raw);
  const bad = issues.has(path);
  const common = {
    id,
    value,
    disabled,
    lang,
    'aria-invalid': bad || undefined,
    'aria-describedby': describedBy(hint && `${id}-hint`, bad && `${id}-err`),
    className: `${inputClass} ${bad ? invalidClass : ''}`,
  };
  const onText = (text: string) => set(path, nullable && text === '' ? null : text);
  const onNumber = (text: string) => set(path, text.trim() === '' ? null : Number(text));
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">
        {multiline ? (
          <textarea {...common} rows={rows} onChange={(e) => onText(e.target.value)} />
        ) : type === 'number' ? (
          <input {...common} type="number" inputMode="decimal" step="any" onChange={(e) => onNumber(e.target.value)} />
        ) : (
          <input {...common} type={type} onChange={(e) => onText(e.target.value)} />
        )}
      </div>
      <Hint id={`${id}-hint`} text={hint} />
      {bad ? <Invalid id={`${id}-err`} text={reasons?.get(path)} /> : null}
    </div>
  );
}

/**
 * A number typed as text (see `number-text.ts`). The draft holds a number when the
 * text reads as one, the raw string when it does not (so the check can say so),
 * and `null` when the box is empty. `integer` also accepts `50.000` as 50000.
 */
export function NumberField({
  path,
  label,
  hint,
  integer,
}: {
  path: string;
  label: string;
  hint?: string;
  integer?: boolean;
}) {
  const { draft, issues, reasons, disabled, set } = useEditor();
  const id = useId();
  const [text, setText] = useState(() => numberToText(getAt(draft, path)));
  const bad = issues.has(path);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy(hint && `${id}-hint`, bad && `${id}-err`)}
          className={`${inputClass} ${bad ? invalidClass : ''}`}
          onChange={(e) => {
            setText(e.target.value);
            set(path, parseNumberText(e.target.value, integer === true));
          }}
        />
      </div>
      <Hint id={`${id}-hint`} text={hint} />
      {bad ? <Invalid id={`${id}-err`} text={reasons?.get(path)} /> : null}
    </div>
  );
}

export function SelectField({
  path,
  label,
  options,
  allowEmpty,
  emptyLabel,
}: {
  path: string;
  label: string;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const { draft, issues, reasons, disabled, set } = useEditor();
  const id = useId();
  const raw = getAt(draft, path);
  const bad = issues.has(path);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">
        <select
          id={id}
          disabled={disabled}
          value={raw === null || raw === undefined ? '' : String(raw)}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          className={`${inputClass} ${bad ? invalidClass : ''}`}
          onChange={(e) => set(path, e.target.value === '' ? null : e.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {bad ? <Invalid id={`${id}-err`} text={reasons?.get(path)} /> : null}
    </div>
  );
}

export function CheckboxField({ path, label }: { path: string; label: string }) {
  const { draft, disabled, set } = useEditor();
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        checked={getAt(draft, path) === true}
        onChange={(e) => set(path, e.target.checked)}
        className="size-5 accent-primary"
      />
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
    </div>
  );
}

/** A list of strings edited one per line (images, slugs). */
export function LinesField({ path, label, hint }: { path: string; label: string; hint?: string }) {
  const { draft, issues, disabled, set } = useEditor();
  const id = useId();
  const list = getAt(draft, path);
  const [text, setText] = useState(() => (Array.isArray(list) ? list.join('\n') : ''));
  const bad = [...issues].some((issue) => issue === path || issue.startsWith(`${path}.`));
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1.5">
        <textarea
          id={id}
          rows={3}
          disabled={disabled}
          value={text}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy(hint && `${id}-hint`, bad && `${id}-err`)}
          className={`${inputClass} ${bad ? invalidClass : ''}`}
          onChange={(e) => {
            setText(e.target.value);
            set(
              path,
              e.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            );
          }}
        />
      </div>
      <Hint id={`${id}-hint`} text={hint} />
      {bad ? <Invalid id={`${id}-err`} /> : null}
    </div>
  );
}

const LOCALES = ['vi', 'en'] as const;

/** The reason under one language box, when the server or the pre-check named that exact path. */
function LocaleReason({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="mt-1.5 text-sm font-medium text-primary-strong">
      {text}
    </p>
  ) : null;
}

function LocalizedShell({
  legend,
  hint,
  bad,
  children,
}: {
  legend: string;
  hint?: string;
  bad: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset
      className="min-w-0 rounded-md border border-border-subtle p-4"
      aria-describedby={describedBy(hint && `${id}-hint`, bad && `${id}-err`)}
    >
      <legend className="px-2 text-sm font-semibold text-foreground">{legend}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
      <Hint id={`${id}-hint`} text={hint} />
      {bad ? <Invalid id={`${id}-err`} /> : null}
    </fieldset>
  );
}

/** vi + en side by side for one `{ vi, en }` value. `nullable` stores null when both are empty. */
export function LocalizedField({
  path,
  label,
  multiline,
  rows = 3,
  nullable,
  hint,
}: {
  path: string;
  label: string;
  multiline?: boolean;
  rows?: number;
  nullable?: boolean;
  hint?: string;
}) {
  const { draft, issues, reasons, disabled, set } = useEditor();
  const t = useTranslations('adminContent.form');
  const baseId = useId();
  const raw = getAt(draft, path);
  const current = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { vi: '', en: '' }) as Record<
    string,
    Json
  >;
  const bad = [...issues].some((issue) => issue === path || issue.startsWith(`${path}.`));
  const explained = LOCALES.some((locale) => issues.has(`${path}.${locale}`) && reasons?.has(`${path}.${locale}`));

  function change(locale: (typeof LOCALES)[number], text: string) {
    const next = { vi: String(current.vi ?? ''), en: String(current.en ?? ''), [locale]: text };
    set(path, nullable && next.vi.trim() === '' && next.en.trim() === '' ? null : next);
  }

  return (
    <LocalizedShell legend={label} hint={hint} bad={bad && !explained}>
      {LOCALES.map((locale) => {
        const id = `${baseId}-${locale}`;
        const fieldBad = issues.has(`${path}.${locale}`);
        const props = {
          id,
          lang: locale,
          disabled,
          value: String(current[locale] ?? ''),
          'aria-invalid': fieldBad || undefined,
          'aria-describedby': fieldBad && reasons?.has(`${path}.${locale}`) ? `${id}-err` : undefined,
          className: `${inputClass} ${fieldBad ? invalidClass : ''}`,
          onChange: (e: { target: { value: string } }) => change(locale, e.target.value),
        };
        return (
          <div key={locale}>
            <label htmlFor={id} className="block text-sm font-medium text-foreground-muted">
              {t(locale === 'vi' ? 'langVi' : 'langEn')}
            </label>
            <div className="mt-1.5">{multiline ? <textarea {...props} rows={rows} /> : <input {...props} />}</div>
            {fieldBad ? <LocaleReason id={`${id}-err`} text={reasons?.get(`${path}.${locale}`)} /> : null}
          </div>
        );
      })}
    </LocalizedShell>
  );
}

/**
 * vi + en lists. `paragraphs` separates entries by a blank line (long text);
 * otherwise one entry per line (tags, bullet points).
 */
export function LocalizedListField({
  path,
  label,
  paragraphs,
  hint,
}: {
  path: string;
  label: string;
  paragraphs?: boolean;
  hint?: string;
}) {
  const { draft, issues, reasons, disabled, set } = useEditor();
  const t = useTranslations('adminContent.form');
  const baseId = useId();
  const sep = paragraphs ? '\n\n' : '\n';
  const raw = getAt(draft, path);
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { vi: [], en: [] }) as Record<
    string,
    Json
  >;
  const [texts, setTexts] = useState<Record<string, string>>(() => ({
    vi: Array.isArray(source.vi) ? source.vi.join(sep) : '',
    en: Array.isArray(source.en) ? source.en.join(sep) : '',
  }));
  const bad = [...issues].some((issue) => issue === path || issue.startsWith(`${path}.`));
  const explained = LOCALES.some((locale) => issues.has(`${path}.${locale}`) && reasons?.has(`${path}.${locale}`));

  function change(locale: (typeof LOCALES)[number], text: string) {
    const nextTexts = { ...texts, [locale]: text };
    setTexts(nextTexts);
    const parse = (value: string) =>
      (paragraphs ? value.split(/\n\s*\n/) : value.split('\n')).map((line) => line.trim()).filter(Boolean);
    set(path, { vi: parse(nextTexts.vi ?? ''), en: parse(nextTexts.en ?? '') });
  }

  return (
    <LocalizedShell
      legend={label}
      hint={hint ?? t(paragraphs ? 'paragraphsHint' : 'linesHint')}
      bad={bad && !explained}
    >
      {LOCALES.map((locale) => {
        const id = `${baseId}-${locale}`;
        return (
          <div key={locale}>
            <label htmlFor={id} className="block text-sm font-medium text-foreground-muted">
              {t(locale === 'vi' ? 'langVi' : 'langEn')}
            </label>
            <div className="mt-1.5">
              <textarea
                id={id}
                lang={locale}
                rows={paragraphs ? 6 : 3}
                disabled={disabled}
                value={texts[locale] ?? ''}
                aria-invalid={issues.has(`${path}.${locale}`) || undefined}
                aria-describedby={issues.has(`${path}.${locale}`) && reasons?.has(`${path}.${locale}`) ? `${id}-err` : undefined}
                className={`${inputClass} ${issues.has(`${path}.${locale}`) ? invalidClass : ''}`}
                onChange={(e) => change(locale, e.target.value)}
              />
            </div>
            {issues.has(`${path}.${locale}`) ? <LocaleReason id={`${id}-err`} text={reasons?.get(`${path}.${locale}`)} /> : null}
          </div>
        );
      })}
    </LocalizedShell>
  );
}
