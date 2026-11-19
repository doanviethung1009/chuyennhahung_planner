import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listQuery, type PlacesListParams } from './places-list-params';

const linkClass =
  'inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-5 text-sm font-medium text-ink-700 hover:border-primary hover:text-primary-strong';

/** Real links, so paging works without JavaScript and keeps `q` and the filters. */
export async function PlacesPagination({
  params,
  page,
  pageCount,
}: {
  params: PlacesListParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const t = await getTranslations('placesList');
  const href = (target: number) => ({ pathname: '/places' as const, query: listQuery(params, target) });

  return (
    <nav aria-label={t('paginationLabel')} className="mt-10 flex flex-wrap items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          <span aria-hidden="true" className="mr-2">←</span>
          {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-foreground-muted" aria-current="page">
        {t('pageOf', { page, pageCount })}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          {t('next')}
          <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
