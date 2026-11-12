'use client';

import { useTranslations } from 'next-intl';
import { LinesField, LocalizedField, LocalizedListField, SelectField, TextField } from './form-kit';
import { RecordShell } from './record-shell';

/** The `placeUpdateSchema` keys this editor sends. Affiliate links are not edited here. */
const FIELDS = [
  'name',
  'destinationSlug',
  'location',
  'coords',
  'category',
  'images',
  'description',
  'suggestedMinutes',
  'estimatedCostVnd',
  'rating',
  'personalNote',
] as const;

const CATEGORIES = [
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

function Fields() {
  const t = useTranslations('adminContent.places');
  return (
    <section aria-labelledby="place-general" className="grid gap-5">
      <h2 id="place-general" className="font-display text-2xl text-foreground">
        {t('sectionGeneral')}
      </h2>
      <LocalizedField path="name" label={t('fieldName')} />
      <LocalizedField path="location" label={t('fieldLocation')} />
      <LocalizedListField path="description" label={t('fieldDescription')} paragraphs />
      <LocalizedField path="personalNote" label={t('fieldNote')} multiline nullable />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField path="destinationSlug" label={t('fieldDestination')} />
        <SelectField
          path="category"
          label={t('fieldCategory')}
          options={CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }))}
        />
        <TextField path="coords.lat" label={t('fieldLat')} type="number" />
        <TextField path="coords.lng" label={t('fieldLng')} type="number" />
        <TextField path="suggestedMinutes" label={t('fieldMinutes')} type="number" />
        <TextField path="estimatedCostVnd" label={t('fieldCost')} type="number" />
        <TextField path="rating" label={t('fieldRating')} type="number" hint={t('ratingHint')} />
      </div>
      <LinesField path="images" label={t('fieldImages')} hint={t('imagesHint')} />
    </section>
  );
}

export function PlaceEditor({ slug }: { slug: string }) {
  return (
    <RecordShell
      apiPath={`/api/admin/travel/places/${encodeURIComponent(slug)}`}
      statusPath={null}
      fields={FIELDS}
      lifecycle={false}
      back="places"
    >
      {() => <Fields />}
    </RecordShell>
  );
}
