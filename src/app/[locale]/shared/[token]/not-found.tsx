import type { Metadata } from 'next';
import LocaleNotFound from '../../not-found';

/**
 * The 404 for a shared-trip token. The layout's `index, follow` would otherwise
 * ride along with Next's own `noindex` on this response; a token URL is never
 * indexed. The generic 404 body is unchanged.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default LocaleNotFound;
