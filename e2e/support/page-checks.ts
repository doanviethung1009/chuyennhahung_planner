import { expect, type Page } from './test';

export const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
] as const;

/** One `<h1>`, no horizontal overflow, no placeholder `href="#"` (CLAUDE.md rules 4 and 5). */
export async function expectHealthyPage(page: Page, label: string): Promise<void> {
  await expect(page.locator('h1'), `${label}: exactly one h1`).toHaveCount(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: horizontal overflow in px`).toBeLessThanOrEqual(0);
  await expect(page.locator('a[href="#"]'), `${label}: no href="#"`).toHaveCount(0);
}
