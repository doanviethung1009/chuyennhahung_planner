import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MEMBER_HOME_TABS, DEFAULT_MEMBER_HOME_TAB, type MemberHomeTab } from '@/lib/member-home-tab';

const LABEL = {
  map: 'sectionMap',
  trips: 'sectionTrips',
  share: 'sectionShare',
} as const satisfies Record<MemberHomeTab, string>;

/**
 * The sections of the member home (ADR 0032). Real links to `?tab=…`, not an
 * ARIA tablist: each section is its own URL answered by the server, so Back,
 * deep links and "open in a new tab" work and so does a browser without
 * JavaScript. The open section carries `aria-current="page"`.
 */
export async function MemberHomeTabs({ active }: { active: MemberHomeTab }) {
  const t = await getTranslations('myTrips');
  return (
    <nav aria-label={t('sections')} className="overflow-x-auto border-b border-border-subtle">
      <ul className="flex min-w-max list-none gap-2 p-0">
        {MEMBER_HOME_TABS.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab}>
              <Link
                href={tab === DEFAULT_MEMBER_HOME_TAB ? '/my-trips' : { pathname: '/my-trips', query: { tab } }}
                scroll={false}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-4 text-base font-medium transition-colors duration-200 ease-gentle ${
                  current
                    ? 'border-primary text-primary-strong'
                    : 'border-transparent text-foreground-muted hover:text-foreground'
                }`}
              >
                {t(LABEL[tab])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
