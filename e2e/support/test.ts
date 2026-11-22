import { randomInt } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';

/**
 * Every test gets its own client address (RFC 5737 range), so the per-IP
 * sign-in and write limiters (10 sign-ins a minute) never throttle the suite.
 * The app reads `x-forwarded-for` (src/server/rate-limit.ts); nothing else changes.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ 'x-forwarded-for': `203.0.113.${randomInt(1, 254)}` });
  },
});

export { expect };
export type { Page };
