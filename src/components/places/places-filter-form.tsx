import { getTranslations } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { destinations } from '@/content/destinations';
import { provincesWithDestinations } from '@/content/provinces';
import { buttonClass } from '@/components/ui/button';
import { Field, inputClass } from '@/components/planner/field';
import { placeCategories, type PlacesListParams } from './places-list-params';

/**
 * A plain GET form: it works without JavaScript and every state is a shareable URL.
 * Submitting always starts from page 1 because `page` is not a field.
 */
export async function PlacesFilterForm({ params, locale }: { params: PlacesListParams; locale: Locale }) {
  const [t, tCat] = await Promise.all([getTranslations('placesList'), getTranslations('places')]);
  const filtered = Boolean(params.q || params.destination || params.province || params.category);

  return (
    <form
      method="get"
      action={getPathname({ href: '/places', locale })}
      role="search"
      aria-label={t('filtersLabel')}
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="md:col-span-2 lg:col-span-1">
        <Field id="pl-q" label={t('searchLabel')}>
          <input
            id="pl-q"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={params.q}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
      </div>
      <Field id="pl-province" label={t('provinceLabel')}>
        <select id="pl-province" name="province" defaultValue={params.province} className={inputClass}>
          <option value="">{t('allProvinces')}</option>
          {provincesWithDestinations.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name[locale]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pl-destination" label={t('destinationLabel')}>
        <select id="pl-destination" name="destination" defaultValue={params.destination} className={inputClass}>
          <option value="">{t('allDestinations')}</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name[locale]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pl-category" label={t('categoryLabel')}>
        <select id="pl-category" name="category" defaultValue={params.category} className={inputClass}>
          <option value="">{t('allCategories')}</option>
          {placeCategories.map((c) => (
            <option key={c} value={c}>
              {tCat(`categories.${c}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass({ size: 'sm' })}>
          {t('searchButton')}
        </button>
        {filtered ? (
          <Link href="/places" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline-offset-4 hover:underline">
            {t('clearFilters')}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
