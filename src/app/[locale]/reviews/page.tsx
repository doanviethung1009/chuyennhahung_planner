import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { social } from '@/content/site';
import { videoReviewsNewestFirst } from '@/content/video-reviews';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { VideoCard } from '@/components/cards/video-card';
import { ButtonExternalLink } from '@/components/ui/button';

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'reviews' });

  return buildPageMetadata({
    href: '/reviews',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

export default async function ReviewsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon] = await Promise.all([
    getTranslations('reviews'),
    getTranslations('common'),
  ]);

  const channels = social.filter((item) => item.platform !== 'email');

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={
          <p className="text-sm text-foreground-muted">
            {t('count', { count: videoReviewsNewestFirst.length })}
          </p>
        }
      />

      <Container width="wide">
        <div className="py-12 md:py-16">
          <section
            aria-labelledby="channels-heading"
            className="rounded-2xl bg-surface-muted p-6 md:p-8"
          >
            <h2
              id="channels-heading"
              className="font-display text-xl font-semibold md:text-2xl"
            >
              {t('channelsTitle')}
            </h2>
            <p className="mt-2 text-base text-foreground-muted">
              {t('channelsLead')}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {channels.map((channel) => (
                <ButtonExternalLink
                  key={channel.platform}
                  href={channel.url}
                  size="lg"
                  variant={channel.platform === 'tiktok' ? 'primary' : 'secondary'}
                  newTabLabel={tCommon('opensInNewTab')}
                >
                  {t('followOn', { platform: channel.label })}
                </ButtonExternalLink>
              ))}
            </div>
          </section>

          {videoReviewsNewestFirst.length === 0 ? (
            <p className="mt-12 text-foreground-muted">{t('empty')}</p>
          ) : (
            <ul className="mt-12 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {videoReviewsNewestFirst.map((video, i) => (
                <li key={video.id}>
                  <VideoCard video={video} locale={locale} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
