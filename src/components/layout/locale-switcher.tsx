'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import NextLink from 'next/link';
import { getPathname, usePathname } from '@/i18n/navigation';
import { locales } from '@/i18n/routing';

/**
 * Renders one link per locale pointing at the *same* page. Because it is a
 * real link rather than a scripted switch, it works before hydration and can
 * be opened in a new tab.
 */
export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslations('locale');
  const active = useLocale();
  const pathname = usePathname();
  const params = useParams();

  return (
    <div
      className={`inline-flex items-center rounded-pill border border-border-strong bg-surface p-0.5 ${className}`}
      role="group"
      aria-label={t('label')}
    >
      {locales.map((locale) => {
        const isActive = locale === active;

        return (
          <NextLink
            key={locale}
            // `getPathname` follows `localePrefix: 'as-needed'`, so VI stays
            // unprefixed. next-intl's own `Link locale=` always writes the
            // prefix (even `/vi/...`), which costs a 307 back (CORE-12 / P-5).
            // @ts-expect-error -- params are validated at runtime by next-intl
            href={getPathname({ locale, href: { pathname, params } })}
            hrefLang={locale}
            aria-current={isActive ? 'true' : undefined}
            className={`inline-flex min-h-11 min-w-11 justify-center items-center rounded-pill px-3 text-sm font-medium transition-colors duration-200 ease-gentle ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <span aria-hidden="true">{locale.toUpperCase()}</span>
            <span className="sr-only">
              {isActive ? t(locale) : t('switchTo', { name: t(locale) })}
            </span>
          </NextLink>
        );
      })}
    </div>
  );
}
