import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Parses the real `@theme` block rather than a copy, so the thresholds below
 * fail if someone edits a colour token into an inaccessible pair.
 */
const css = readFileSync(
  resolve(import.meta.dirname, '../src/app/globals.css'),
  'utf8',
);

const themeBlock = css.slice(css.indexOf('@theme {'), css.indexOf('\n}', css.indexOf('@theme {')));

const rawTokens: Record<string, string> = {};
for (const match of themeBlock.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
  rawTokens[match[1]!] = match[2]!.trim();
}

/** Resolves `var(--color-x)` aliases down to a literal hex value. */
function resolveToken(name: string, seen = new Set<string>()): string {
  const value = rawTokens[name];
  if (!value) throw new Error(`unknown token --color-${name}`);
  if (seen.has(name)) throw new Error(`circular token --color-${name}`);
  seen.add(name);

  const alias = value.match(/^var\(--color-([\w-]+)\)$/);
  return alias ? resolveToken(alias[1]!, seen) : value;
}

function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const channels = toRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('design tokens', () => {
  it('defines the full semantic alias set', () => {
    for (const token of [
      'background',
      'surface',
      'surface-muted',
      'foreground',
      'foreground-muted',
      'primary',
      'primary-strong',
      'primary-foreground',
      'accent',
      'border',
      'border-strong',
      'ring',
    ]) {
      expect(rawTokens, `missing --color-${token}`).toHaveProperty(token);
      expect(resolveToken(token)).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  // WCAG 2.1: 4.5:1 for body text, 3:1 for large text and UI boundaries.
  const bodyPairs: Array<[string, string]> = [
    ['foreground', 'background'],
    ['foreground', 'surface'],
    ['foreground', 'surface-muted'],
    ['foreground-muted', 'background'],
    ['foreground-muted', 'surface-muted'],
    ['primary-strong', 'background'],
    ['primary-strong', 'surface-muted'],
    ['primary-foreground', 'primary'],
    ['accent', 'background'],
  ];

  it.each(bodyPairs)('meets AA body contrast: %s on %s', (fg, bg) => {
    const ratio = contrast(resolveToken(fg), resolveToken(bg));
    expect(
      Number(ratio.toFixed(2)),
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  // Only boundaries that *identify* a control are in scope for WCAG 1.4.11.
  // `--color-border` / `--color-border-subtle` are decorative hairlines between
  // surfaces and are deliberately excluded; controls use `--color-border-strong`.
  const uiPairs: Array<[string, string]> = [
    ['primary', 'background'],
    ['ring', 'background'],
    ['border-strong', 'background'],
    ['border-strong', 'surface-muted'],
  ];

  it.each(uiPairs)('meets AA non-text contrast: %s on %s', (fg, bg) => {
    const ratio = contrast(resolveToken(fg), resolveToken(bg));
    expect(
      Number(ratio.toFixed(2)),
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
  });

  it('loads both typefaces with the Vietnamese subset', () => {
    const layout = readFileSync(
      resolve(import.meta.dirname, '../src/app/[locale]/layout.tsx'),
      'utf8',
    );
    const subsets = [...layout.matchAll(/subsets:\s*\[([^\]]+)\]/g)];

    expect(subsets.length).toBe(2);
    for (const match of subsets) {
      expect(match[1], 'a font is missing the vietnamese subset').toContain(
        'vietnamese',
      );
    }
  });
});
