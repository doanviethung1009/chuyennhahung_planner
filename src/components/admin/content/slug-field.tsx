'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { inputClass } from '@/components/planner/field';
import { isValidSlug } from '@/lib/slug';
import { publicContentPath } from '@/lib/public-path';

export const RESERVED_SLUGS = ['new'];
const DEBOUNCE_MS = 400;

type Check = 'free' | 'taken' | 'unknown';

/**
 * Slug input for the create forms (P07-22): hint, explicit "regenerate", public
 * URL preview and a debounced availability check. The check only informs; the
 * server still answers `409 slug_conflict` on submit, and only the reserved
 * slug blocks the form client-side.
 */
export function SlugField({
  kind,
  value,
  invalid,
  disabled,
  onChange,
  onRegenerate,
}: {
  kind: 'stories' | 'places';
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}) {
  const tc = useTranslations('adminContent.create');
  const tf = useTranslations('adminContent.form');
  const id = useId();
  const slug = value.trim();
  const reserved = RESERVED_SLUGS.includes(slug);
  const valid = !reserved && isValidSlug(slug);
  const [result, setResult] = useState<{ slug: string; check: Check } | null>(null);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/admin/travel/${kind}/${encodeURIComponent(slug)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((response) => {
          const check: Check = response.status === 200 ? 'taken' : response.status === 404 ? 'free' : 'unknown';
          setResult({ slug, check });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ slug, check: 'unknown' });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, slug, valid]);

  let status: string | null = null;
  if (reserved) status = tc('reservedSlug');
  else if (slug !== '' && !valid) status = tc('slugInvalid');
  else if (valid) {
    const check = result?.slug === slug ? result.check : null;
    status =
      check === 'free'
        ? tc('slugFree')
        : check === 'taken'
          ? tc('slugTaken')
          : check === 'unknown'
            ? tc('slugUnknown')
            : tc('slugChecking');
  }
  const bad = invalid || reserved;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {tc('fieldSlug')}
      </label>
      <div className="mt-1.5 flex flex-wrap items-start gap-3">
        <input
          id={id}
          value={value}
          disabled={disabled}
          lang="vi"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={bad || undefined}
          aria-describedby={`${id}-hint ${id}-status${valid ? ` ${id}-preview` : ''}${bad ? ` ${id}-err` : ''}`}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-w-0 flex-1 ${bad ? 'border-primary' : ''}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onRegenerate}
          className={buttonClass({ variant: 'secondary', size: 'md' })}
        >
          {tc('slugRegenerate')}
        </button>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-foreground-muted">
        {tc('slugAutoHint')}
      </p>
      <p id={`${id}-status`} role="status" aria-live="polite" className="mt-1.5 min-h-5 text-sm font-medium text-foreground">
        {status}
      </p>
      {valid ? (
        <div id={`${id}-preview`} className="mt-1.5 text-sm text-foreground-muted">
          <p className="font-medium text-foreground">{tc('previewHeading')}</p>
          <p lang="vi">{tc('previewVi', { path: publicContentPath(kind, slug, 'vi') })}</p>
          <p lang="en">{tc('previewEn', { path: publicContentPath(kind, slug, 'en') })}</p>
        </div>
      ) : null}
      {bad ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm font-medium text-primary-strong">
          {tf('invalid')}
        </p>
      ) : null}
    </div>
  );
}
