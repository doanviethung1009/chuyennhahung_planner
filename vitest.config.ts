import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    // Component tests are `.test.tsx` and opt in to jsdom per file (ADR 0027).
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup-env.ts'],
    // next-intl imports `next/navigation` without an extension; Vite must resolve it (component tests).
    server: { deps: { inline: ['next-intl'] } },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
