import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';

/**
 * What a visitor sees while a dynamic public page is still being read (UXS-1).
 *
 * Used by `loading.tsx` files only on LEAF routes (see `tests/loading-boundary-guard.test.ts`):
 * a `loading.tsx` makes Next send the status line before the page runs, so above a route
 * that calls `notFound()` it would turn every 404 into a 200.
 *
 * The skeleton is `aria-hidden` and carries no heading: the page that replaces it
 * brings its own single `<h1>`. One `role="status"` line tells assistive tech that
 * something is loading. Pulsing only runs for visitors who have not asked for
 * reduced motion.
 */
export async function PageSkeleton() {
  const t = await getTranslations('states');
  const block = 'rounded-md bg-surface-muted motion-safe:animate-pulse';

  return (
    <>
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div aria-hidden="true">
        <div className="border-b border-border-subtle bg-surface-muted">
          <Container width="wide">
            <div className="max-w-3xl py-12 md:py-16 lg:py-20">
              <div className={`${block} h-4 w-24 bg-surface`} />
              <div className={`${block} mt-4 h-10 w-3/4 bg-surface`} />
              <div className={`${block} mt-5 h-5 w-full bg-surface`} />
            </div>
          </Container>
        </div>
        <Container width="wide">
          <ul className="grid list-none grid-cols-1 gap-6 p-0 py-12 sm:grid-cols-2 md:py-16 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="rounded-xl border border-border-subtle p-4">
                <div className={`${block} aspect-[4/3] w-full`} />
                <div className={`${block} mt-4 h-5 w-2/3`} />
                <div className={`${block} mt-3 h-4 w-full`} />
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </>
  );
}
