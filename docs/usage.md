# Usage — Chuyện Nhà Hưng

🇻🇳 Bản tiếng Việt: [usage.vi.md](usage.vi.md)

How to run, verify and extend the app. For *what it is made of*, read
[architecture.md](architecture.md).

## Requirements

- **Node ≥ 20.9.** Two consequences of the current `20.14` on this machine:
  `package.json` pins `magic-string` via `overrides` because `@tailwindcss/node`
  `require()`s an ES module, and Vitest is held at 3.x because Vitest 4/5 need
  Vite 7/8 (Node ≥ 20.19). **Drop both pins once Node ≥ 20.19.**
- npm (the repo ships `package-lock.json`).
- Google Chrome at the default macOS path, only for `npm run verify:ui`.

## Install and run

```bash
npm install
npm run dev          # http://localhost:3000
```

Vietnamese is at `/`, English at `/en`. There is no `.env` file to create;
`NEXT_PUBLIC_SITE_URL` is the only variable and it falls back to
`https://chuyennhahung.vn`.

One more step per clone, which git cannot do for you — turn on the tracked git
hooks that keep commits off `main`:

```bash
git config core.hooksPath .githooks
```

`pre-commit` refuses a commit while you are on `main`, and `pre-push` refuses a
push that would move `main`; both point you at the branch-and-PR route instead.
Override deliberately with `--no-verify` if you ever really mean it.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build — prerenders all 57 pages |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, flat config |
| `npm run test` | Vitest, run-once |
| `npm run verify:ui` | Screenshots 13 routes at 375/768/1440 into `screenshots/`, fails on horizontal overflow |
| `npm run covers` | Regenerates the SVG cover artwork into `public/images/covers/` |

`verify:ui` needs a dev or production server already running, and takes an
optional base URL and output directory:
`node scripts/screenshots.mjs http://localhost:3000 out/shots`.

## Definition of done

Every change ends with these three, and with their **real output stated**:

```bash
npm run typecheck && npm run lint && npm run test
```

A UI change adds a look at 375px, 768px and 1280px. If something failed or was
skipped, say so — a passing summary over a failing run is the one unrecoverable
mistake here.

`.github/workflows/ci.yml` runs the same three plus `npm run build` on every PR
into `main`. Treat it as a second opinion, not as a gate: these checks **cannot
be made required** while the repository is private on GitHub Free, because
branch protection and rulesets are unavailable there. A red run therefore does
not stop a merge — a human still has to look.

## Common tasks

### Add a content item

1. Append to the collection in `src/content/<collection>.ts`, filling `vi` **and**
   `en` on every `Localized<T>` field. `typecheck` catches a missing locale.
2. Keep the slug lowercase, hyphenated, unique — `tests/content.test.ts` enforces it.
3. Run `npm run covers` so the item gets cover art, or point `cover` at a real
   photograph in `public/images/`.
4. A destination also needs real WGS84 `coords`; the map projects them and a
   wrong value puts a truthful-looking pin in the wrong place.

### Add a user-visible string

Add the key to **both** `messages/vi.json` and `messages/en.json`, then read it
with `useTranslations` / `getTranslations`. Never hard-code a string in a
component. `tests/i18n.test.ts` checks key parity, ICU placeholder parity, and
flags a Vietnamese value copied verbatim into English.

### Add a route

1. Add the internal pathname plus its VI and EN segments to `pathnames` in
   [`src/i18n/routing.ts`](../src/i18n/routing.ts).
2. Create the matching folder under `src/app/[locale]/`.
3. Export `generateMetadata` using `buildPageMetadata` from
   [`src/lib/metadata.ts`](../src/lib/metadata.ts).
4. Add it to `src/app/sitemap.ts`, and to `primaryNav` / `footerExtraNav` in
   [`nav-items.ts`](../src/components/layout/nav-items.ts) if it belongs in a menu.
5. Add a nav label to both message catalogues.
6. Add the route to `scripts/screenshots.mjs`.
7. Document it: a feature document in [`features/`](features/README.md) in both
   languages, and the route table in [architecture.md](architecture.md) and
   [architecture.vi.md](architecture.vi.md).

### Add a design token

Add it to `@theme` in [`globals.css`](../src/app/globals.css) — the only legal
place — then use the generated utility. If it is a text or control colour, extend
`tests/design-tokens.test.ts` so its contrast is asserted, not assumed.

### Add a locale

Three changes, together: `locales` + `pathnames` in `routing.ts`, a new
`messages/<locale>.json`, and the new key on every `Localized<T>` field in
`src/content/**`. `tests/i18n.test.ts` and `tests/content.test.ts` fail until all
three are done.

## Before going live — owner actions

These are plausible defaults, **not verified**. Confirm each with the owner:

1. **Facebook handle** — `src/content/site.ts` assumes `chuyennhahung`.
2. **Contact email** — `hello@chuyennhahung.vn` must exist; the planning page
   links a prefilled `mailto:` to it.
3. **Site URL** — set `NEXT_PUBLIC_SITE_URL`; it drives canonicals, `hreflang`
   and the sitemap.
4. **Photography** — swap the generated SVG covers for real photos.

## Deploy

`npm run build` emits a fully prerendered app with no runtime data dependency, so
any Next.js host (Vercel, a Node server behind nginx, a container) works.
`NEXT_PUBLIC_SITE_URL` must be set at **build** time — it is baked into
canonicals, `hreflang` and the sitemap. Content changes require a rebuild;
there is no CMS and no revalidation path yet.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `require() of ES Module` from `@tailwindcss/node` | Node < 20.19 and the `magic-string` override was removed |
| Vitest refuses to start | Vitest 4/5 installed on Node < 20.19 — stay on 3.x |
| A Vietnamese URL 404s | Pathname missing from `pathnames` in `routing.ts`, or the folder name does not match the internal pathname |
| `MISSING_MESSAGE` at runtime | Key added to one catalogue only |
| `npm run verify:ui` cannot launch | Chrome is not at the hard-coded macOS path in `scripts/screenshots.mjs` |
| Diacritics render wrong | A font was added without the `vietnamese` subset |
