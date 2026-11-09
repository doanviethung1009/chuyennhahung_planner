import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { siteConfig, social } from '@/content/site';
import { Container } from '@/components/ui/container';
import type { NavKey } from './nav-items';

interface Column {
  heading: 'exploreHeading' | 'aboutHeading';
  links: Array<{ key: NavKey; href: StaticPathname }>;
}

const columns: Column[] = [
  {
    heading: 'exploreHeading',
    links: [
      { key: 'stories', href: '/stories' },
      { key: 'destinations', href: '/destinations' },
      { key: 'map', href: '/map' },
      { key: 'itineraries', href: '/itineraries' },
    ],
  },
  {
    heading: 'aboutHeading',
    links: [
      { key: 'about', href: '/about' },
      { key: 'reviews', href: '/reviews' },
      { key: 'planTrip', href: '/plan-your-trip' },
      { key: 'myTrips', href: '/my-trips' },
    ],
  },
];

export async function SiteFooter() {
  const [tNav, tFooter, tCommon, locale] = await Promise.all([
    getTranslations('nav'),
    getTranslations('footer'),
    getTranslations('common'),
    getLocale(),
  ]);

  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-muted">
      <Container width="wide">
        <div className="grid gap-10 py-14 md:grid-cols-2 md:py-16 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="font-display text-xl font-semibold text-ink-900">
              {siteConfig.name}
            </p>
            <p className="mt-1 font-display text-base text-primary-strong italic">
              {siteConfig.tagline[locale]}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground-muted">
              {tFooter('blurb')}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-labelledby={`footer-${column.heading}`}>
              <h2
                id={`footer-${column.heading}`}
                className="text-eyebrow font-display text-foreground-muted"
              >
                {tFooter(column.heading)}
              </h2>
              <ul className="mt-4 flex flex-col gap-1">
                {column.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center text-[0.9375rem] text-ink-700 transition-colors duration-200 ease-gentle hover:text-primary-strong"
                    >
                      {tNav(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2
              id="footer-follow"
              className="text-eyebrow font-display text-foreground-muted"
            >
              {tFooter('followHeading')}
            </h2>
            <ul aria-labelledby="footer-follow" className="mt-4 flex flex-col gap-1">
              {social.map((item) => (
                <li key={item.platform}>
                  <a
                    href={item.url}
                    {...(item.platform === 'email'
                      ? {}
                      : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="inline-flex min-h-10 items-center gap-2 text-[0.9375rem] text-ink-700 transition-colors duration-200 ease-gentle hover:text-primary-strong"
                  >
                    {item.platform === 'email' ? siteConfig.contactEmail : item.label}
                    {item.platform === 'email' ? null : (
                      <span className="sr-only">{tCommon('opensInNewTab')}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border-subtle py-6">
          <p className="text-sm text-foreground-muted">
            {tFooter('rights', { year: new Date().getFullYear() })}
          </p>
        </div>
      </Container>
    </footer>
  );
}
