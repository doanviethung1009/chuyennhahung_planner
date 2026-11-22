import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { siteConfig } from '@/content/site';
import { Container } from '@/components/ui/container';
import { MainNav, type NavEntryView } from './main-nav';
import { isGroup, primaryNav } from './nav-items';

export async function SiteHeader() {
  const [t, locale] = await Promise.all([
    getTranslations('nav'),
    getLocale(),
  ]);

  const items: NavEntryView[] = primaryNav.map((entry) =>
    isGroup(entry)
      ? {
          key: entry.key,
          label: t(entry.key),
          items: entry.items.map((item) => ({ ...item, label: t(item.key) })),
        }
      : { ...entry, label: t(entry.key) },
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/85 backdrop-blur-md">
      <Container width="wide" className="2xl:max-w-screen-2xl">
        <div className="flex h-(--header-h) items-center justify-between gap-3">
          <Link
            href="/"
            className="group flex min-h-11 shrink-0 flex-col justify-center leading-none"
          >
            <span className="font-display text-lg font-semibold tracking-tight text-ink-900 md:text-xl">
              {siteConfig.name}
            </span>
            <span className="hidden text-xs tracking-wide text-foreground-muted md:block">
              {siteConfig.tagline[locale]}
            </span>
          </Link>

          <MainNav
            items={items}
            guestCta={{ href: '/plan-your-trip', label: t('planTrip') }}
            memberCta={{ href: '/my-trips/new', label: t('createTrip') }}
            openLabel={t('openMenu')}
            closeLabel={t('closeMenu')}
            navLabel={t('primary')}
          />
        </div>
      </Container>
    </header>
  );
}
