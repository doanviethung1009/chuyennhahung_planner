import { getTranslations } from 'next-intl/server';

/**
 * First focusable element on every page. Visually hidden until focused, so
 * keyboard users can jump past the header without seeing clutter.
 */
export async function SkipLink() {
  const t = await getTranslations('nav');

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-pill focus:bg-primary focus:px-5 focus:text-primary-foreground focus:shadow-lift"
    >
      {t('skipToContent')}
    </a>
  );
}
