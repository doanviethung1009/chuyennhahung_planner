import type { Metadata } from 'next';
import LocaleNotFound from '../../not-found';

/**
 * The 404 for a shared-map token. Next resolves the layout's metadata for this
 * response (`index, follow`) next to its own `noindex`, and the page's own
 * `generateMetadata` never runs once `notFound()` is thrown. Stating the robots
 * here keeps a single, never-indexed answer (ADR 0030 §5); the generic 404 body
 * is unchanged, so a wrong token still looks like any other missing page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default LocaleNotFound;
