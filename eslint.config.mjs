import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/** eslint-config-next 16 ships native flat configs — no FlatCompat needed. */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      // Playwright output (WEB-3), git-ignored.
      'playwright-report/**',
      'test-results/**',
      '.claude/skills/**',
      // Transient agent worktrees carry their own copy of the vendored skill.
      '.claude/worktrees/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

export default config;
