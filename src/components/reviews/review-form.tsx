'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { contribution, contributionOpen } from '@/content/site';
import { ApiError, api } from '@/components/planner/api';
import { Field, inputClass } from '@/components/planner/field';
import type { OwnReview } from '@/server/planner/schemas';

const BODY_MIN = 60;
const BODY_MAX = 1_000;

type Place = { slug: string; name: string };

type Props =
  | { mode: 'guest'; places: Place[] }
  | {
      mode: 'planner';
      place: Place;
      existing: OwnReview | null;
      /** Pre-filled visit date, if the trip has one that is not in the future. */
      defaultVisitedOn: string;
      onSaved: (review: OwnReview) => void;
      onUnauthorized: () => void;
    };

/**
 * One review form for both entry points (ADR 0014). A visitor's goes live at
 * once; a Planner author's waits for staff. Closed — with a neutral notice —
 * until the owner has published the contribution terms and takedown contact.
 */
export function ReviewForm(props: Props) {
  const t = useTranslations('communityReviews');
  const locale = useLocale() as Locale;
  const uid = useId();
  const planner = props.mode === 'planner';
  const existing = planner ? props.existing : null;
  const today = new Date().toISOString().slice(0, 10);

  const [placeSlug, setPlaceSlug] = useState(planner ? props.place.slug : '');
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [visitedOn, setVisitedOn] = useState(existing?.visitedOn ?? (planner ? props.defaultVisitedOn : ''));
  const [body, setBody] = useState(existing?.body ?? '');
  const [lang, setLang] = useState<'vi' | 'en'>(existing?.lang ?? locale);
  const [name, setName] = useState('');
  const [authorDisplay, setAuthorDisplay] = useState<'name' | 'anonymous'>(existing?.authorDisplay ?? 'name');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  if (!contributionOpen) {
    return <p className="rounded-md border border-border-strong bg-surface p-4 text-sm">{t('form.closed')}</p>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    setMessage('');
    try {
      if (props.mode === 'planner') {
        const saved = await api<OwnReview>(`/api/planner/reviews/${encodeURIComponent(props.place.slug)}`, {
          method: 'PUT',
          body: { rating, body, lang, visitedOn, authorDisplay },
        });
        props.onSaved(saved);
        setMessage(t('form.posted'));
      } else {
        await api('/api/community/reviews', {
          method: 'POST',
          body: {
            placeSlug,
            rating,
            body,
            lang,
            visitedOn,
            authorName: name.trim() === '' ? null : name.trim(),
            website: honeypot,
          },
        });
        setBody('');
        setMessage(t('form.posted'));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && props.mode === 'planner') return props.onUnauthorized();
      setFailed(true);
      const code = error instanceof ApiError ? error.code : 'generic';
      setMessage(
        code === 'rate_limited' || code === 'invalid_state' || code === 'validation_failed' || code === 'invalid_reference'
          ? t(`form.errors.${code}`)
          : t('form.errors.generic'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="grid gap-5">
      {contribution.terms ? (
        <div className="rounded-md bg-surface-muted p-4 text-sm text-foreground-muted">
          <p className="font-medium text-foreground">{t('form.termsHeading')}</p>
          <p className="mt-1 whitespace-pre-line">{contribution.terms[locale]}</p>
          {contribution.takedownContact ? (
            <p className="mt-2">
              {t('form.takedown')}{' '}
              <a
                href={`mailto:${contribution.takedownContact}`}
                className="font-medium text-primary-strong underline underline-offset-4"
              >
                {contribution.takedownContact}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {props.mode === 'guest' ? (
        <Field id={`${uid}-place`} label={t('form.place')} hint={t('form.placeHint')}>
          <select
            id={`${uid}-place`}
            required
            className={inputClass}
            value={placeSlug}
            disabled={busy}
            aria-describedby={`${uid}-place-hint`}
            onChange={(e) => setPlaceSlug(e.target.value)}
          >
            <option value="">{t('form.placeChoose')}</option>
            {props.places.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id={`${uid}-rating`} label={t('form.rating')}>
          <select
            id={`${uid}-rating`}
            className={inputClass}
            value={rating}
            disabled={busy}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {t('form.ratingOption', { n })}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-visited`} label={t('form.visited')} hint={t('form.visitedHint')}>
          <input
            id={`${uid}-visited`}
            type="date"
            required
            max={today}
            className={inputClass}
            value={visitedOn}
            disabled={busy}
            aria-describedby={`${uid}-visited-hint`}
            onChange={(e) => setVisitedOn(e.target.value)}
          />
        </Field>
        <Field id={`${uid}-lang`} label={t('form.lang')}>
          <select
            id={`${uid}-lang`}
            className={inputClass}
            value={lang}
            disabled={busy}
            onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>

      <Field id={`${uid}-body`} label={t('form.body')} hint={t('form.bodyHint', { min: BODY_MIN, max: BODY_MAX })}>
        <textarea
          id={`${uid}-body`}
          required
          rows={5}
          minLength={BODY_MIN}
          maxLength={BODY_MAX}
          className={inputClass}
          value={body}
          disabled={busy}
          aria-describedby={`${uid}-body-hint`}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="mt-1 text-xs text-foreground-muted">{t('form.bodyCount', { count: body.length, max: BODY_MAX })}</p>
      </Field>

      {props.mode === 'guest' ? (
        <>
          <Field id={`${uid}-name`} label={t('form.name')} hint={t('form.nameHint')}>
            <input
              id={`${uid}-name`}
              type="text"
              minLength={2}
              maxLength={60}
              className={inputClass}
              value={name}
              disabled={busy}
              aria-describedby={`${uid}-name-hint`}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              {t('form.honeypot')}
              <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </label>
          </div>
        </>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium">{t('form.authorLabel')}</legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(['name', 'anonymous'] as const).map((value) => (
              <label key={value} className="inline-flex min-h-11 items-center gap-2 text-base">
                <input
                  type="radio"
                  name={`${uid}-author`}
                  value={value}
                  checked={authorDisplay === value}
                  disabled={busy}
                  onChange={() => setAuthorDisplay(value)}
                />
                {t(`form.author.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-sm text-foreground-muted">{planner ? t('form.plannerNote') : t('form.guestNote')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={buttonClass({ size: 'md' })}>
          {busy ? t('form.sending') : t('form.submit')}
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${failed ? 'text-primary-strong' : 'text-foreground-muted'}`}>
          {message}
        </p>
      </div>
    </form>
  );
}
