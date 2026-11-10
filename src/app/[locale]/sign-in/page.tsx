import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { safeReturnTo } from '@/lib/return-to';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { SignInForm } from '@/components/planner/sign-in-form';
import { buttonClass } from '@/components/ui/button';
import { googleConfig } from '@/server/planner/google';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ returnTo?: string | string[]; error?: string | string[] }>;
};

/** The codes the Google callback may send back (`google-http.ts`). */
const GOOGLE_ERRORS = [
  'google_failed',
  'google_cancelled',
  'google_unverified',
  'account_not_found',
  'account_conflict',
  'link_required',
  'rate_limited',
] as const;
type GoogleError = (typeof GOOGLE_ERRORS)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

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
  const query = await searchParams;
  // Validated here, on the server, before it can reach any navigation call.
  const target = safeReturnTo(first(query.returnTo));
  const t = await getTranslations('signIn');

  // Only a known code is shown; anything else in the URL is ignored.
  const errorCode = first(query.error);
  const googleError = GOOGLE_ERRORS.includes(errorCode as GoogleError) ? (errorCode as GoogleError) : null;

  // Server-side check: the button exists only when Google is configured
  // (ADR 0007, fail closed). No Google value is passed to the client.
  const googleEnabled = googleConfig() !== null;
  const googleStart = `/api/planner/oauth/google/start?${new URLSearchParams({ returnTo: target, locale }).toString()}`;

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="narrow">
        <div className="py-12 md:py-16">
          {googleError ? (
            <p role="alert" className="mb-8 rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-primary-strong">
              {t(`googleErrors.${googleError}`)}
            </p>
          ) : null}
          {googleEnabled ? (
            <div className="mb-10 grid gap-3">
              {/* A plain link: the start route answers with a redirect to Google. */}
              <a href={googleStart} className={buttonClass({ variant: 'secondary', size: 'lg', className: 'w-full' })}>
                {t('googleButton')}
              </a>
              <p className="text-sm text-foreground-muted">{t('googleHint')}</p>
              <p className="mt-4 text-center text-sm text-foreground-muted">
                {t('divider')}
              </p>
            </div>
          ) : null}
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
