'use client';

import { useTranslations } from 'next-intl';
import { LinesField, LocalizedField, LocalizedListField, CheckboxField, SelectField, TextField, getAt } from './form-kit';
import type { Draft } from './form-kit';
import { RecordShell } from './record-shell';

/** The `storyUpdateSchema` keys this editor sends. Cost and linked places are not edited here. */
const FIELDS = [
  'title',
  'excerpt',
  'content',
  'cover',
  'gallery',
  'destinationSlug',
  'travelDates',
  'itinerarySlugs',
  'travelStyle',
  'readingMinutes',
  'seo',
] as const;

const TRAVEL_STYLES = ['romantic', 'family', 'solo', 'friends', 'adventure', 'budget', 'foodie', 'relaxed'] as const;

const BLOCK_TYPES = ['paragraph', 'heading', 'image', 'quote', 'list', 'place', 'cost'] as const;
const isBlockType = (type: string): type is (typeof BLOCK_TYPES)[number] => (BLOCK_TYPES as readonly string[]).includes(type);

function Block({ index, type }: { index: number; type: string }) {
  const t = useTranslations('adminContent.stories');
  const p = `content.${index}`;
  return (
    <section aria-labelledby={`block-${index}`} className="grid gap-4 rounded-md border border-border-subtle p-4">
      <h3 id={`block-${index}`} className="text-base font-semibold text-foreground">
        {t('block', { n: index + 1, type: isBlockType(type) ? t(`blockTypes.${type}`) : type })}
      </h3>
      {type === 'paragraph' ? <LocalizedField path={`${p}.text`} label={t('blockText')} multiline rows={4} /> : null}
      {type === 'heading' ? <LocalizedField path={`${p}.text`} label={t('blockHeading')} /> : null}
      {type === 'image' ? (
        <>
          <TextField path={`${p}.src`} label={t('blockImageSrc')} />
          <LocalizedField path={`${p}.alt`} label={t('blockAlt')} />
          <LocalizedField path={`${p}.caption`} label={t('blockCaption')} nullable />
        </>
      ) : null}
      {type === 'quote' ? (
        <>
          <LocalizedField path={`${p}.text`} label={t('blockQuote')} multiline />
          <TextField path={`${p}.attribution`} label={t('blockAttribution')} nullable />
        </>
      ) : null}
      {type === 'list' ? <LocalizedListField path={`${p}.items`} label={t('blockItems')} /> : null}
      {type === 'place' ? <LocalizedField path={`${p}.note`} label={t('blockNote')} multiline nullable /> : null}
      {type === 'cost' ? (
        <>
          <LocalizedField path={`${p}.label`} label={t('blockCostLabel')} />
          <TextField path={`${p}.amountVnd`} label={t('blockAmount')} type="number" />
        </>
      ) : null}
    </section>
  );
}

function Fields({ draft }: { draft: Draft }) {
  const t = useTranslations('adminContent.stories');
  const tf = useTranslations('adminContent.form');
  const blocks = getAt(draft, 'content');
  const list = Array.isArray(blocks) ? blocks : [];
  return (
    <>
      <section aria-labelledby="story-general" className="grid gap-5">
        <h2 id="story-general" className="font-display text-2xl text-foreground">
          {t('sectionGeneral')}
        </h2>
        <LocalizedField path="title" label={t('fieldTitle')} />
        <LocalizedField path="excerpt" label={t('fieldExcerpt')} multiline rows={3} />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField path="cover" label={t('fieldCover')} hint={t('imageHint')} />
          <TextField path="destinationSlug" label={t('fieldDestination')} />
          <TextField path="travelDates.start" label={t('fieldStart')} type="date" />
          <TextField path="travelDates.end" label={t('fieldEnd')} type="date" />
          <TextField path="readingMinutes" label={t('fieldReading')} type="number" />
          <SelectField
            path="travelStyle"
            label={t('fieldStyle')}
            allowEmpty
            emptyLabel={tf('none')}
            options={TRAVEL_STYLES.map((value) => ({ value, label: t(`styles.${value}`) }))}
          />
        </div>
        <LinesField path="gallery" label={t('fieldGallery')} hint={t('linesHint')} />
        <LinesField path="itinerarySlugs" label={t('fieldItineraries')} hint={t('linesHint')} />
      </section>

      <section aria-labelledby="story-content" className="grid gap-5">
        <div>
          <h2 id="story-content" className="font-display text-2xl text-foreground">
            {t('sectionContent')}
          </h2>
          <p className="mt-2 text-base text-foreground-muted">{t('contentHint')}</p>
        </div>
        {list.map((block, index) => (
          <Block key={index} index={index} type={String((block as { type?: unknown } | null)?.type ?? '')} />
        ))}
      </section>

      <section aria-labelledby="story-seo" className="grid gap-5">
        <h2 id="story-seo" className="font-display text-2xl text-foreground">
          {t('sectionSeo')}
        </h2>
        <LocalizedField path="seo.title" label={t('seoTitle')} nullable hint={t('seoTitleHint')} />
        <LocalizedField path="seo.description" label={t('seoDescription')} multiline />
        <LocalizedListField path="seo.keywords" label={t('seoKeywords')} />
        <TextField path="seo.ogImage" label={t('seoOgImage')} nullable hint={t('imageHint')} />
        <TextField path="seo.canonicalPath" label={t('seoCanonical')} nullable />
        <CheckboxField path="seo.noindex" label={t('seoNoindex')} />
      </section>
    </>
  );
}

export function StoryEditor({ slug }: { slug: string }) {
  const base = `/api/admin/travel/stories/${encodeURIComponent(slug)}`;
  return (
    <RecordShell apiPath={base} statusPath={`${base}/status`} fields={FIELDS} lifecycle back="stories">
      {(draft) => <Fields draft={draft} />}
    </RecordShell>
  );
}
