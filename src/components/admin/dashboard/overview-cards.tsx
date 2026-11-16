import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Overview } from '@/server/admin/overview';

/** Dashboard cards (P07-11). Server component: counts arrive already filtered by role. */
export async function OverviewCards({ overview }: { overview: Overview }) {
  const t = await getTranslations('adminContent.overview');

  if (overview.cards.length === 0) {
    return <p className="text-base text-foreground-muted">{t('empty')}</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {overview.cards.map((card) => (
        <li key={card.id} className="rounded-lg border border-border-strong bg-surface p-5">
          <h3 className="text-base font-medium text-foreground">{t(`cardsLabel.${card.id}`)}</h3>
          {card.state === 'unavailable' ? (
            <>
              <p className="mt-2 font-display text-2xl text-foreground-muted">{t('unavailable')}</p>
              <p className="mt-1 text-sm text-foreground-muted">{t('unavailableHint')}</p>
            </>
          ) : card.detail ? (
            <p className="mt-2 font-display text-2xl text-foreground">{t(`runtimeValue.${card.detail}`)}</p>
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">{card.count}</p>
          )}
          {card.severity === 'attention' ? (
            <p className="mt-1 text-sm font-medium text-primary-strong">{t('attention')}</p>
          ) : null}
          <Link
            href={card.href}
            className="mt-3 inline-flex min-h-11 items-center font-medium text-primary-strong underline underline-offset-4"
          >
            {t('open')}
            <span className="sr-only">: {t(`cardsLabel.${card.id}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
