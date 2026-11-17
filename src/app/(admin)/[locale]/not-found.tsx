import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';

/**
 * The one admin 404 (ADR 0023 §5). A forbidden role and an unknown admin URL
 * both end here, so the page is no oracle for which admin routes exist.
 */
export default async function AdminNotFound() {
  const t = await getTranslations('adminContent.notFound');

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-eyebrow text-primary-strong">404</p>
      <h1 className="mt-4 font-display text-4xl font-semibold">{t('title')}</h1>
      <p className="mt-4 text-lg text-foreground-muted">{t('description')}</p>
      <div className="mt-8">
        <ButtonLink href="/" size="lg">
          {t('cta')}
        </ButtonLink>
      </div>
    </main>
  );
}
