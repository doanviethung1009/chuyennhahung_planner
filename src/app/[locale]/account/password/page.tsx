import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { safeReturnTo } from '@/lib/return-to';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/layout/page-header';
import { ChangePasswordForm, type GoogleLinkStatus } from '@/components/planner/change-password-form';
import { googleConfig } from '@/server/planner/google';

type Params = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ returnTo?: string | string[]; google?: string | string[] }>;
};

/** The outcomes the Google callback reports back here (`google-http.ts`). */
const LINK_STATUSES: readonly GoogleLinkStatus[] = [
  'linked',
  'google_failed',
  'google_cancelled',
  'google_unverified',
  'account_conflict',
  'rate_limited',
];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'changePassword' });
  return {
    ...buildPageMetadata({
      href: '/account/password',
      locale,
      title: t('metaTitle'),
      description: t('description'),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * Change password (ADR 0007). Where a temporary-password sign-in lands, and
 * where any Planner call that answers `password_change_required` sends the
 * browser. The form itself handles a missing session by going to sign-in.
 *
 * Also where a signed-in user links Google to their account — the only way an
 * existing account gains a Google link.
 */
export default async function ChangePasswordPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const target = safeReturnTo(first(query.returnTo));
  const status = first(query.google);
  const linkStatus = LINK_STATUSES.includes(status as GoogleLinkStatus) ? (status as GoogleLinkStatus) : null;
  // Server-side check, as on the sign-in page: no Google value reaches the client.
  const googleLinkHref =
    googleConfig() !== null
      ? `/api/planner/oauth/google/start?${new URLSearchParams({ intent: 'link', locale }).toString()}`
      : null;
  const t = await getTranslations('changePassword');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Container width="narrow">
        <div className="py-12 md:py-16">
          <ChangePasswordForm target={target} googleLinkHref={googleLinkHref} linkStatus={linkStatus} />
        </div>
      </Container>
    </>
  );
}
