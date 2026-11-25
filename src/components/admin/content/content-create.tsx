'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api } from '@/components/planner/api';
import { EditorProvider, LocalizedField, LocalizedListField, SelectField, TextField } from './form-kit';
import type { Draft, Json } from './form-kit';
import { getAt, setAt } from './form-kit';
import { checkPlaceDraft, problemsFromIssues, type FieldProblem } from './issue-reason';
import { LiveNotice } from './notices';
import { RESERVED_SLUGS, SlugField } from './slug-field';
import { slugify } from '@/lib/slug';
import { useErrorNotice, type Notice } from './use-record';

const PLACE_CATEGORIES = [
  'cafe',
  'restaurant',
  'street-food',
  'viewpoint',
  'stay',
  'market',
  'museum',
  'nature',
  'activity',
  'transport',
] as const;

const EMPTY_STORY: Draft = {
  slug: '',
  title: { vi: '', en: '' },
  excerpt: { vi: '', en: '' },
  firstParagraph: { vi: '', en: '' },
  cover: '',
  destinationSlug: null,
  travelDates: { start: '', end: '' },
  readingMinutes: 5,
  seo: { description: { vi: '', en: '' } },
};

const EMPTY_PLACE: Draft = {
  slug: '',
  name: { vi: '', en: '' },
  destinationSlug: '',
  location: { vi: '', en: '' },
  coords: { lat: null, lng: null },
  category: 'cafe',
  description: { vi: [], en: [] },
  suggestedMinutes: 60,
  estimatedCostVnd: 0,
};

/** Body for POST: the form's one extra key becomes the story's first paragraph block. */
function toStoryBody(draft: Draft): Draft {
  const { firstParagraph, ...rest } = draft;
  return { ...rest, content: [{ type: 'paragraph', text: firstParagraph as Json }] };
}

/** Server issue paths for the first block map back onto the single form field. */
function mapIssue(path: string): string {
  return path.startsWith('content.0.text') ? path.replace('content.0.text', 'firstParagraph') : path;
}

/**
 * "New" form for a story or place: only the fields the create schema requires.
 * The rest is filled in on the normal edit page, where the record opens after
 * creation (ADR 0011). A story or place is always created as a draft by the server (ADR 0035).
 */
export function ContentCreate({ kind }: { kind: 'stories' | 'places' }) {
  const t = useTranslations('adminContent');
  const ts = useTranslations('adminContent.stories');
  const tp = useTranslations('adminContent.places');
  const tc = useTranslations('adminContent.create');
  const tf = useTranslations('adminContent.form');
  const te = useTranslations('adminContent.errors');
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const describe = useErrorNotice();
  const [draft, setDraft] = useState<Draft>(kind === 'stories' ? EMPTY_STORY : EMPTY_PLACE);
  const [issues, setIssues] = useState<ReadonlySet<string>>(new Set());
  const [reasons, setReasons] = useState<ReadonlyMap<string, string>>(new Map());
  // Bumped on every refusal so the first marked box takes focus, even far above the sticky bar.
  const [focusTick, setFocusTick] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);

  // Until the editor touches the slug box, it follows the Vietnamese title.
  const [slugEdited, setSlugEdited] = useState(false);
  // `LocalizedField` sets the whole `{ vi, en }` object under `title` / `name`.
  const titleKey = kind === 'stories' ? 'title' : 'name';
  const viTitle = (source: Draft) => String(getAt(source, `${titleKey}.vi`) ?? '');

  const set = (path: string, value: Json) => {
    setDraft((current) => {
      const next = setAt(current, path, value);
      return path === titleKey && !slugEdited ? setAt(next, 'slug', slugify(viTitle(next))) : next;
    });
    setNotice(null);
  };

  const setSlug = (value: string) => {
    setSlugEdited(true);
    setDraft((current) => setAt(current, 'slug', value));
    setNotice(null);
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    const next = slugify(viTitle(draft));
    setDraft((current) => setAt(current, 'slug', next));
    // A title too short to make a slug clears the box: say so instead of failing silently.
    setNotice(next === '' ? { kind: 'error', text: tc('slugRegenerateEmpty') } : null);
  };

  useEffect(() => {
    if (focusTick === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
    first?.scrollIntoView({ block: 'center' });
  }, [focusTick]);

  /** Marks every refused field and says why under it. */
  function showProblems(problems: FieldProblem[]) {
    setIssues(new Set(problems.map((problem) => problem.path)));
    setReasons(
      new Map(problems.map((problem) => [problem.path, tf(`reasons.${problem.reason.key}`, { n: problem.reason.n ?? 0 })])),
    );
    setFocusTick((tick) => tick + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = String(draft.slug ?? '').trim();
    if (RESERVED_SLUGS.includes(slug)) {
      showProblems([{ path: 'slug', reason: { key: 'reserved' } }]);
      setNotice({ kind: 'error', text: tc('reservedSlug') });
      return;
    }
    // Same rules as the server, so an editor sees every gap at once instead of one failed save.
    const problems = kind === 'places' ? checkPlaceDraft(draft) : [];
    if (problems.length > 0) {
      showProblems(problems);
      setNotice({ kind: 'error', text: te('validation_failed') });
      return;
    }
    setPending(true);
    setNotice(null);
    setIssues(new Set());
    setReasons(new Map());
    try {
      const body = kind === 'stories' ? toStoryBody(draft) : draft;
      const created = await api<{ slug: string }>(`/api/admin/travel/${kind}`, { method: 'POST', body });
      if (kind === 'stories') {
        router.push({ pathname: '/admin/content/stories/[slug]', params: { slug: created.slug } });
      } else {
        router.push({ pathname: '/admin/content/places/[slug]', params: { slug: created.slug } });
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'validation_failed') {
        showProblems(problemsFromIssues(failure.issues.map((issue) => ({ ...issue, path: mapIssue(issue.path) }))));
      }
      if (failure instanceof ApiError && failure.code === 'slug_conflict') {
        showProblems([{ path: 'slug', reason: { key: 'invalid' } }]);
        setNotice({ kind: 'error', text: tc('slugConflict') });
      } else {
        setNotice(describe(failure));
      }
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8">
      <p>
        {kind === 'stories' ? (
          <Link href="/admin/content/stories" className="font-medium text-primary-strong underline underline-offset-4">
            {ts('back')}
          </Link>
        ) : (
          <Link href="/admin/content/places" className="font-medium text-primary-strong underline underline-offset-4">
            {tp('back')}
          </Link>
        )}
      </p>
      <p className="rounded-md border border-border-subtle bg-surface p-4 text-base text-foreground">
        {kind === 'stories' ? tc('storyNote') : tc('placeNote')}
        {kind === 'places' ? <span className="mt-2 block">{tc('placeRequiredNote')}</span> : null}
      </p>

      <form ref={formRef} noValidate onSubmit={(event) => void submit(event)} aria-busy={pending} className="grid gap-8">
        <EditorProvider value={{ draft, issues, reasons, disabled: pending, set }}>
          {kind === 'stories' ? (
            <section aria-labelledby="create-general" className="grid gap-5">
              <h2 id="create-general" className="font-display text-2xl text-foreground">
                {ts('sectionGeneral')}
              </h2>
              <SlugField
                kind={kind}
                value={String(draft.slug ?? '')}
                invalid={issues.has('slug')}
                disabled={pending}
                onChange={setSlug}
                onRegenerate={regenerateSlug}
              />
              <LocalizedField path="title" label={ts('fieldTitle')} />
              <LocalizedField path="excerpt" label={ts('fieldExcerpt')} multiline rows={3} />
              <LocalizedField path="firstParagraph" label={tc('fieldFirstParagraph')} multiline rows={4} hint={tc('firstParagraphHint')} />
              <div className="grid gap-5 md:grid-cols-2">
                <TextField path="cover" label={ts('fieldCover')} hint={ts('imageHint')} />
                <TextField path="destinationSlug" label={ts('fieldDestination')} hint={ts('destinationHint')} nullable />
                <TextField path="travelDates.start" label={ts('fieldStart')} type="date" />
                <TextField path="travelDates.end" label={ts('fieldEnd')} type="date" />
                <TextField path="readingMinutes" label={ts('fieldReading')} type="number" />
              </div>
              <LocalizedField path="seo.description" label={ts('seoDescription')} multiline />
            </section>
          ) : (
            <section aria-labelledby="create-general" className="grid gap-5">
              <h2 id="create-general" className="font-display text-2xl text-foreground">
                {tp('sectionGeneral')}
              </h2>
              <SlugField
                kind={kind}
                value={String(draft.slug ?? '')}
                invalid={issues.has('slug')}
                disabled={pending}
                onChange={setSlug}
                onRegenerate={regenerateSlug}
              />
              <LocalizedField path="name" label={tp('fieldName')} />
              <LocalizedField path="location" label={tp('fieldLocation')} />
              <LocalizedListField path="description" label={tp('fieldDescription')} paragraphs />
              <div className="grid gap-5 md:grid-cols-2">
                <TextField path="destinationSlug" label={tp('fieldDestination')} />
                <SelectField
                  path="category"
                  label={tp('fieldCategory')}
                  options={PLACE_CATEGORIES.map((value) => ({ value, label: tp(`categories.${value}`) }))}
                />
                <TextField path="coords.lat" label={tp('fieldLat')} hint={tc('hintLat')} type="number" />
                <TextField path="coords.lng" label={tp('fieldLng')} hint={tc('hintLng')} type="number" />
                <TextField path="suggestedMinutes" label={tp('fieldMinutes')} hint={tc('hintMinutes')} type="number" />
                <TextField path="estimatedCostVnd" label={tp('fieldCost')} hint={tc('hintCost')} type="number" />
              </div>
            </section>
          )}
        </EditorProvider>

        <div className="sticky bottom-0 z-10 grid gap-3 border-t border-border-subtle bg-surface py-4">
          <LiveNotice notice={notice} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClass({ size: 'md' })}>
              {pending ? t('form.saving') : kind === 'stories' ? tc('submitStory') : tc('submitPlace')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
