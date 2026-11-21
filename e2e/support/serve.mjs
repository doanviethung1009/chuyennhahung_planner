// Starts the production build the way the Dockerfile does (ADR 0033): the repo builds with
// `output: standalone`, where `next start` is unsupported (it redirect-loops on `/`).
// The standalone folder lacks `.next/static` and `public`; copy them in (inside the
// git-ignored `.next/`), then hand over to the standalone server. Host and port come
// from the environment the Playwright config sets.
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const standalone = resolve('.next', 'standalone');
if (!existsSync(resolve(standalone, 'server.js'))) {
  console.error('No standalone build found: run `npm run build` before `npm run e2e`.');
  process.exit(1);
}
cpSync(resolve('.next', 'static'), resolve(standalone, '.next', 'static'), { recursive: true });
if (existsSync('public')) cpSync('public', resolve(standalone, 'public'), { recursive: true });

await import(resolve(standalone, 'server.js'));
