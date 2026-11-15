import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export type AdminSection = 'overview' | 'stories' | 'places' | 'reviews' | 'community' | 'runbook';

const linkBase =
  'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-200 ease-gentle';
const linkIdle = 'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary-strong';
const linkCurrent = 'border-primary bg-surface-muted text-primary-strong';

/**
 * Role-aware section navigation for the admin shell. A server component: it
 * hides what the role cannot use, but hiding is not authorization — every
 * route and API call checks the role again.
 */
export function AdminNav({
  current,
  canUsers,
  canContent,
}: {
  current: AdminSection;
  canUsers: boolean;
  canContent: boolean;
}) {
  const t = useTranslations('adminContent.nav');
  const cls = (section: AdminSection) => `${linkBase} ${current === section ? linkCurrent : linkIdle}`;
  const aria = (section: AdminSection) => (current === section ? ('page' as const) : undefined);

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {canUsers ? (
        <Link href="/admin" className={cls('overview')} aria-current={aria('overview')}>
          {t('users')}
        </Link>
      ) : (
        <Link href="/admin" className={cls('overview')} aria-current={aria('overview')}>
          {t('overview')}
        </Link>
      )}
      {canContent ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('content')}>
          <span className="text-sm font-semibold text-foreground-muted">{t('content')}</span>
          <Link href="/admin/content/stories" className={cls('stories')} aria-current={aria('stories')}>
            {t('stories')}
          </Link>
          <Link href="/admin/content/places" className={cls('places')} aria-current={aria('places')}>
            {t('places')}
          </Link>
          <Link href="/admin/content/reviews" className={cls('reviews')} aria-current={aria('reviews')}>
            {t('reviews')}
          </Link>
          <Link href="/admin/community" className={cls('community')} aria-current={aria('community')}>
            {t('community')}
          </Link>
        </div>
      ) : null}
      {canUsers ? (
        <Link href="/admin/runbook" className={cls('runbook')} aria-current={aria('runbook')}>
          {t('runbook')}
        </Link>
      ) : null}
    </nav>
  );
}
