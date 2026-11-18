'use client';

import { useTranslations } from 'next-intl';
import {
  CheckboxField,
  LinesField,
  LocalizedField,
  LocalizedListField,
  TextField,
} from './form-kit';
import { RecordShell } from './record-shell';

/** The `collectionUpdateSchema` keys this editor sends (the slug is the identity and is not edited). */
const FIELDS = [
  'title',
  'tagline',
  'description',
  'cover',
  'destinationSlugs',
  'storySlugs',
  'placeSlugs',
  'seo',
] as const;

function Fields() {
  const t = useTranslations('adminContent.collections');
  return (
    <>
      <section aria-labelledby="collection-general" className="grid gap-5">
        <h2 id="collection-general" className="font-display text-2xl text-foreground">
          {t('sectionGeneral')}
        </h2>
        <LocalizedField path="title" label={t('fieldTitle')} />
        <LocalizedField path="tagline" label={t('fieldTagline')} />
        <LocalizedListField path="description" label={t('fieldDescription')} paragraphs />
        <TextField path="cover" label={t('fieldCover')} hint={t('coverHint')} />
      </section>
      <section aria-labelledby="collection-members" className="grid gap-5">
        <h2 id="collection-members" className="font-display text-2xl text-foreground">
          {t('sectionMembers')}
        </h2>
        <LinesField path="destinationSlugs" label={t('fieldDestinations')} hint={t('linesHint')} />
        <LinesField path="storySlugs" label={t('fieldStories')} hint={t('linesHint')} />
        <LinesField path="placeSlugs" label={t('fieldPlaces')} hint={t('linesHint')} />
      </section>
      <section aria-labelledby="collection-seo" className="grid gap-5">
        <h2 id="collection-seo" className="font-display text-2xl text-foreground">
          {t('sectionSeo')}
        </h2>
        <LocalizedField path="seo.title" label={t('seoTitle')} nullable />
        <LocalizedField path="seo.description" label={t('seoDescription')} multiline />
        <LocalizedListField path="seo.keywords" label={t('seoKeywords')} />
        <TextField path="seo.ogImage" label={t('seoOgImage')} nullable />
        <TextField path="seo.canonicalPath" label={t('seoCanonical')} nullable />
        <CheckboxField path="seo.noindex" label={t('seoNoindex')} />
      </section>
    </>
  );
}

/** Collection editor (P07-15). Saves with `If-Match`; a 412 shows the reload notice from `RecordShell`. */
export function CollectionEditor({ slug }: { slug: string }) {
  const base = `/api/admin/travel/collections/${encodeURIComponent(slug)}`;
  return (
    <RecordShell apiPath={base} statusPath={`${base}/status`} fields={FIELDS} lifecycle back="collections">
      {() => <Fields />}
    </RecordShell>
  );
}
