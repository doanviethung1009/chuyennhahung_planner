import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { siteConfig } from '@/content/site';
import { beVietnamPro, lora } from '../../fonts';
import '../../globals.css';

// Admin root layout (ADR 0023). It owns `<html>` for the admin tree only and
// renders no public header, footer or skip link. It never gates access: each
// admin page keeps its own `requireStaff` call.
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: 'adminContent.nav' });

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t('home'), template: `%s — ${t('brand')}` },
    applicationName: siteConfig.name,
    robots: { index: false, follow: false },
    icons: { icon: '/icon.svg' },
  };
}

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${lora.variable} ${beVietnamPro.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
