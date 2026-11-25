'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DestinationOption } from '@/lib/destination-options';
import { SelectField, getAt, useEditor } from './form-kit';

/**
 * The destination of a place as a picker over the known destinations, so an
 * editor never has to guess a slug. A value already stored that is not in the
 * list (an old or renamed destination) stays selectable instead of silently
 * turning blank.
 */
export function DestinationField({ path, options }: { path: string; options: readonly DestinationOption[] }) {
  const t = useTranslations('adminContent.places');
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const { draft } = useEditor();
  const current = getAt(draft, path);

  const items = options.map((option) => ({ value: option.slug, label: option.name[locale] }));
  if (typeof current === 'string' && current !== '' && !items.some((item) => item.value === current)) {
    items.push({ value: current, label: current });
  }

  return <SelectField path={path} label={t('fieldDestination')} options={items} allowEmpty emptyLabel={t('destinationEmpty')} />;
}
