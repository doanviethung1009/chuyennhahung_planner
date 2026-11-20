import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { getDestination } from '@/content/destinations';
import { loadSharedMemberMap, sharedMapDestinations } from '@/server/planner/shared-map-page';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { VietnamMap } from '@/components/map/vietnam-map';

type Params = { params: Promise<{ locale: Locale; token: string }> };

/** A token is a bearer secret: this page is always rendered per request (ADR 0030 §5). */
export const dynamic = 'force-dynamic';

/**
 * Metadata never depends on the token, the owner or the lookup: the same generic,
 * never-indexed values answer every request, so a failure (which renders the
 * same 404) and a success cannot be told apart from the head either. No title
 * with a name, no alternates, no Open Graph, no JSON-LD.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sharedMap' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharedMemberMapPage({ params }: Params) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  // Every failure — format, unknown, revoked, owner gone, limiter — is `null`.
  const map = await loadSharedMemberMap(await headers(), token);
  if (!map) notFound();

  const t = await getTranslations('sharedMap');
  const destinations = sharedMapDestinations(map.points);
  const buckets = new Map(map.points.map((p) => [p.slug, p.visitsBucket]));

  return (
    <>
      <PageHeader
        title={map.displayName ? t('titleNamed', { name: map.displayName }) : t('title')}
        description={t('description')}
      />
      <Container width="wide">
        <div className="grid gap-12 py-12 md:py-16 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-muted p-6 md:p-8">
              <VietnamMap destinations={destinations} locale={locale} mapLabel={t('mapLabel')} />
            </div>
            <div className="mt-5 rounded-xl border border-border-subtle p-4">
              <h2 className="text-eyebrow text-foreground-muted">{t('legend')}</h2>
              <p className="mt-2 flex items-center gap-3 text-sm text-foreground-muted">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 shrink-0 rounded-pill border-2 border-cream-50 bg-primary shadow-soft"
                />
                {t('legendVisited')}
              </p>
              <p className="mt-2 text-sm text-foreground-muted">{t('legendBuckets')}</p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">{t('listTitle')}</h2>
            {destinations.length === 0 ? (
              <p className="mt-3 text-base text-foreground-muted">{t('empty')}</p>
            ) : (
              <ul className="mt-6 flex list-none flex-col gap-1 p-0">
                {destinations.map((destination) => {
                  const bucket = buckets.get(destination.slug) ?? 1;
                  return (
                    <li
                      key={destination.slug}
                      className="flex min-h-12 items-center justify-between gap-4 border-b border-border-subtle px-3 py-3"
                    >
                      <span className="font-display text-lg font-semibold text-ink-900">
                        {getDestination(destination.slug)?.name[locale] ?? destination.slug}
                      </span>
                      <span className="shrink-0 text-sm text-foreground-muted">
                        {t(`bucket${bucket}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
