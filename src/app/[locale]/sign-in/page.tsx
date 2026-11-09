import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { safeReturnTo } from '@/lib/return-to';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { SignInForm } from '@/components/planner/sign-in-form';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'signIn' });
  return {
    ...buildPageMetadata({
      href: '/sign-in',
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function SignInPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { returnTo } = await searchParams;
  // Validated here, on the server, before it can reach any navigation call.
  const target = safeReturnTo(Array.isArray(returnTo) ? returnTo[0] : returnTo);
  const t = await getTranslations('signIn');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="narrow">
        <div className="py-12 md:py-16">
          <SignInForm target={target} />
          <p className="mt-10 text-base text-foreground-muted">
            {t('noAccess')}{' '}
            <Link href="/plan-your-trip" className="font-medium text-primary-strong underline underline-offset-4">
              {t('contactLink')}
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
