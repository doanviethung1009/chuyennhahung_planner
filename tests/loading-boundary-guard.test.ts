import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'src', 'app', '[locale]');

/**
 * A `loading.tsx` wraps its page in Suspense, so Next sends the status line (200) before
 * the page runs. Above a route that calls `notFound()`, every unknown slug or token would
 * answer 200 instead of 404. It happened once (UXS-1, caught by the e2e smoke: a revoked
 * share link returned 200). `loading.tsx` therefore belongs only on leaf routes.
 */
function loadingDirs(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (existsSync(join(path, 'loading.tsx'))) found.push(path);
    found.push(...loadingDirs(path));
  }
  return found;
}

// `my-trips/[id]` is a client page that never calls `notFound()` (a missing trip is a
// message), so it may sit under a `loading.tsx`.
const ALLOWED_DYNAMIC_CHILDREN = new Set(['my-trips']);

describe('loading.tsx placement', () => {
  it('is not at the locale root, where it would cover every route', () => {
    expect(existsSync(join(ROOT, 'loading.tsx'))).toBe(false);
  });

  it('never sits above a dynamic segment (except the client-only trip page)', () => {
    for (const dir of loadingDirs(ROOT)) {
      const dynamic = readdirSync(dir).filter((n) => n.startsWith('[') && statSync(join(dir, n)).isDirectory());
      const name = dir.split('/').pop() ?? '';
      if (dynamic.length > 0) expect(ALLOWED_DYNAMIC_CHILDREN.has(name), `${dir} has ${dynamic.join(',')}`).toBe(true);
    }
  });
});
