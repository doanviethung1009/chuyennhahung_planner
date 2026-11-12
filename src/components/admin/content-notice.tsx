import { useTranslations } from 'next-intl';

/**
 * Honest about where an edit goes: it is saved to the content store, but the
 * public pages still render from the built-in site content, so nothing shows
 * on the public site yet. No refresh interval is promised.
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
