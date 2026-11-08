/**
 * Responsive UI verification.
 *
 * Drives the locally installed Chrome through puppeteer-core (no browser
 * download) and captures each key route at phone, tablet and desktop widths.
 * Also asserts there is no horizontal overflow, which is the failure mode a
 * screenshot alone can hide.
 *
 * Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] ?? 'http://localhost:3000';
const outDir = resolve(process.argv[3] ?? 'screenshots');

const viewports = [
  { name: 'mobile', width: 375, height: 812, isMobile: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: true },
  { name: 'desktop', width: 1440, height: 950, isMobile: false },
];

const routes = [
  { name: 'home-vi', path: '/', full: true },
  { name: 'home-en', path: '/en', full: false },
  { name: 'stories', path: '/chuyen-di-choi', full: false },
  { name: 'story-detail', path: '/chuyen-di-choi/ba-ngay-o-ha-giang-khong-co-ke-hoach', full: false },
  { name: 'destinations', path: '/kham-pha', full: false },
  { name: 'destination-detail', path: '/kham-pha/ha-giang', full: false },
  { name: 'map', path: '/ban-do', full: false },
  { name: 'itineraries', path: '/len-lich-trinh', full: false },
  { name: 'itinerary-detail', path: '/len-lich-trinh/ha-giang-4-ngay-3-dem', full: false },
  { name: 'plan', path: '/thiet-ke-chuyen-di', full: false },
  { name: 'reviews', path: '/goc-review', full: false },
  { name: 'about', path: '/ve-nha-hung', full: false },
  { name: 'not-found', path: '/khong-ton-tai', full: false },
];

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--no-sandbox', '--hide-scrollbars'],
});

const problems = [];

for (const viewport of viewports) {
  const page = await browser.newPage();
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 2,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
  });

  for (const route of routes) {
    const url = `${base}${route.path}`;
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });

    // 304 means the browser reused its cache — the route still resolved.
    const status = response?.status() ?? 0;
    const ok = route.name === 'not-found' ? status === 404 : status === 200 || status === 304;
    if (!ok) {
      problems.push(`${route.name} @ ${viewport.name}: unexpected HTTP ${status}`);
    }

    // Horizontal overflow check — the classic mobile regression.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) {
      problems.push(`${route.name} @ ${viewport.name}: horizontal overflow of ${overflow}px`);
    }

    await page.screenshot({
      path: resolve(outDir, `${route.name}__${viewport.name}.png`),
      fullPage: route.full,
    });
  }

  await page.close();
}

// Mobile navigation drawer, captured open.
const navPage = await browser.newPage();
await navPage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await navPage.goto(base, { waitUntil: 'networkidle0' });
await navPage.click('button[aria-controls]');
await navPage.waitForSelector('[role="dialog"]', { timeout: 5000 });
const drawerLinks = await navPage.$$eval('[role="dialog"] a', (as) =>
  as.map((a) => a.textContent.trim()),
);
await navPage.screenshot({ path: resolve(outDir, 'nav-drawer__mobile.png') });
await navPage.close();

await browser.close();

console.log(`screenshots → ${outDir}`);
console.log(`mobile drawer links: ${JSON.stringify(drawerLinks)}`);
if (problems.length) {
  console.error('\nPROBLEMS:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('no HTTP or overflow problems found');
