import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { getDestination } from '@/content/destinations';
import type { HomeMember } from '@/server/planner/home-page';
import { Badge, MetaRow } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

/**
 * The one extra band a signed-in member sees above the hero (ADR 0022).
 *
 * A server component with no client JavaScript: the band is part of the first
 * response, so there is no skeleton and no layout shift. It receives only the
 * allow-listed `HomeMember`; trip titles are plain text nodes. A guest gets
 * `null`, which leaves the public page exactly as it was.
 */
export async function HomeMemberBand({ member, locale }: { member: HomeMember; locale: Locale }) {
  if (member.status === 'guest') return null;

  const [t, tPlanning] = await Promise.all([getTranslations('home.member'), getTranslations('planning')]);

  if (member.status === 'continue') {
    const { trip } = member;
    const destination = getDestination(trip.destinationSlug);
    const when =
      trip.startDate === null
        ? t('noDate')
        : trip.daysUntilStart === 0
          ? t('leavingToday')
          : trip.daysUntilStart !== null
            ? t('countdown', { count: trip.daysUntilStart })
            : null;

    return (
      <section aria-labelledby="home-member-heading" className="border-b border-border-subtle bg-surface-muted">
        <Container width="wide">
          <div className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between md:py-7">
            <div className="min-w-0">
              <p className="text-eyebrow text-primary-strong">{t('continueEyebrow')}</p>
              <h2
                id="home-member-heading"
                className="mt-2 line-clamp-2 font-display text-xl font-semibold text-ink-900 md:text-2xl"
              >
                {trip.title}
              </h2>
              <MetaRow
                className="mt-2"
                items={[
                  destination?.name[locale] ?? trip.destinationSlug,
                  t('days', { count: trip.durationDays }),
                  when,
                ]}
              />
              <div className="mt-3">
                <Badge tone="accent">{tPlanning(trip.planningStatus)}</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={{ pathname: '/my-trips/[id]', params: { id: trip.id } }} size="lg">
                {t('continueCta')}
              </ButtonLink>
              <ButtonLink href="/my-trips" variant="ghost" size="lg">
                {t('allTrips')}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  const first = member.status === 'first-trip';

  return (
    <section aria-labelledby="home-member-heading" className="border-b border-border-subtle bg-surface-muted">
      <Container width="wide">
        <div className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between md:py-7">
          <div className="min-w-0 md:max-w-2xl">
            <p className="text-eyebrow text-primary-strong">{t('startEyebrow')}</p>
            <h2
              id="home-member-heading"
              className="mt-2 font-display text-xl font-semibold text-ink-900 md:text-2xl"
            >
              {first ? t('firstTitle') : t('nextTitle')}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-foreground-muted">
              {first ? t('firstLead') : t('nextLead')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row">
            <ButtonLink href="/my-trips/new" size="lg">
              {t('createCta')}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
