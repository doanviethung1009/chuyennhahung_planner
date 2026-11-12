import { useTranslations } from 'next-intl';

/**
 * Honest about where an edit goes (ADR 0012): the public pages read the same
 * content store, so a published edit shows on the next request. Drafts and
 * archived records stay off the public site.
 */
export function ContentNotice() {
  const t = useTranslations('adminContent.notice');
  return (
    <aside aria-labelledby="content-notice-title" className="rounded-md border border-border-strong bg-surface-muted p-4">
      <h2 id="content-notice-title" className="text-base font-semibold text-foreground">
        {t('title')}
      </h2>
      <p className="mt-1.5 text-base text-foreground-muted">{t('body')}</p>
    </aside>
  );
}
