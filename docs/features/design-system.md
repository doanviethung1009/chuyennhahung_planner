# Feature — Design system and tokens

🇻🇳 Bản tiếng Việt: [design-system.vi.md](design-system.vi.md)

## Summary

One warm, paper-and-clay visual language across the whole site, defined once so
it cannot drift. Accessibility is part of the system rather than a review step:
contrast is asserted by a test that parses the real CSS.

## Routes

None. This feature is the substrate every page renders through.

## Data

No content collection. The source of truth is the `@theme` block in
[`src/app/globals.css`](../../src/app/globals.css):

- **Palette** — cream and sand surfaces, clay terracotta primary, jade accent,
  gold highlight, ink text.
- **Semantic aliases** — `background`, `surface`, `surface-muted`, `foreground`,
  `foreground-muted`, `primary`, `primary-strong`, `primary-foreground`,
  `accent`, `highlight`, `border`, `border-subtle`, `border-strong`, `ring`.
- **Type** — `--font-display` (Lora) and `--font-sans` (Be Vietnam Pro), both
  loaded via `next/font` with the `vietnamese` subset, plus an `eyebrow` text
  size with its own tracking.
- **Radii, shadows, motion** — `--radius-xs…2xl` and `--radius-pill`,
  three warm low-contrast shadows, `--ease-gentle` and `--animate-rise`.

Two aliases exist for accessibility reasons and should not be "simplified away":
`--color-primary` is `clay-600` rather than `clay-500` because clay-500 only
reaches 3.9:1 against white button text, and `--color-border-strong` exists
because decorative hairlines are too light to identify a control under WCAG
1.4.11.

## How it works

Tailwind v4 is CSS-first: every token in `@theme` becomes a utility, so
`--color-surface-muted` is usable as `bg-surface-muted` with no config file.
Components use those utilities and nothing else — **a hard-coded colour, font,
radius or shadow anywhere outside `globals.css` is a defect.** Need a new value?
Add the token first.

The base layer sets `color-scheme: light`, the sticky-header height `--header-h`
(4rem, 4.75rem from `64rem` up — the mobile drawer offsets itself by it),
the admin top-bar height `--admin-bar-h` (3.5rem; the admin sidebar sticks
below it — ADR 0023), `text-wrap: balance` on headings and `pretty` on paragraphs, and the Vietnamese
font stack on `body`.

Primitives in `src/components/ui/` are the second half of the system: `Button`
(with `buttonClass`, `ButtonLink` and `ButtonExternalLink`, which carries the
"opens in new tab" label), `Container`, `Section`, `Badge`, `Prose`,
`CoverImage`. `CoverImage` optimizes raster formats through `next/image` and
bypasses the optimizer only for SVG.

## Files

| Path | Role |
|---|---|
| [`src/app/globals.css`](../../src/app/globals.css) | `@theme` tokens + base layer — the only place tokens are defined |
| [`src/app/[locale]/layout.tsx`](../../src/app/[locale]/layout.tsx) | `next/font` loading with the `vietnamese` subset |
| [`src/components/ui/`](../../src/components/ui) | Primitives built on the tokens |
| [`tests/design-tokens.test.ts`](../../tests/design-tokens.test.ts) | Parses the CSS, asserts contrast |
| [`scripts/screenshots.mjs`](../../scripts/screenshots.mjs) | Responsive verification |

## Tests

`tests/design-tokens.test.ts` reads `globals.css`, resolves `var()` chains, and
asserts the full semantic alias set exists, nine body-text pairs clear WCAG AA
4.5:1, four control-boundary pairs clear 3:1, and both typefaces are loaded with
the `vietnamese` subset. It has already caught two real failures — hence
`clay-600` and `--color-border-strong`.

`npm run verify:ui` screenshots 13 routes at 375 / 768 / 1440 and **fails on
horizontal overflow**, which is the failure mode a screenshot alone hides.

## Limits and open questions

Light mode only: `color-scheme: light` is set explicitly and there is no dark
palette. Adding one means a second set of semantic aliases and a second pass of
the contrast test, which is real work rather than a media query.

The contrast test covers the pairs that are listed. A new token used in a
combination nobody added to `bodyPairs` or `uiPairs` is unverified — extending
those arrays is part of adding a colour, not an optional extra.

`verify:ui` hard-codes the macOS Chrome path, so it does not run in CI as written.
