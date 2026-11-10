# Usage — Chuyện Nhà Hưng

🇻🇳 Bản tiếng Việt: [usage.vi.md](usage.vi.md)

How to run, verify and extend the app. For *what it is made of*, read
[architecture.md](architecture.md).

## Requirements

- **Node 24 LTS**, pinned in `.nvmrc` (`24.22.2`) — run `nvm use` in the repo. CI
  reads the same file, so local and CI cannot drift apart. `engines.node` is
  `>=24`, and npm warns on anything older.
  The `magic-string` override that Node 20.14 needed is gone. Vitest is still on
  3.x: Node 24 *allows* Vitest 4/5 now, but that upgrade has not been done.
- npm (the repo ships `package-lock.json`).
- Google Chrome at the default macOS path, only for `npm run verify:ui`.

## Install and run

```bash
npm install
npm run dev          # http://localhost:3000
```

Vietnamese is at `/`, English at `/en`. The site renders with no `.env` at all;
every variable below has a working default or disables a feature by failing
closed.

| Variable | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://chuyennhahung.vn` | Canonicals, `hreflang`, sitemap. Must be set at **build** time |
| `ADMIN_API_TOKEN` | *unset* | Guards every admin route. Unset, or shorter than 32 chars, and they all answer `503` — never an open default |
| `TRAVEL_CONTENT_STORE` | `.data/travel-content.json` | Where the content store lives |
| `TRAVEL_CONTENT_AUTOSEED` | `true` | Set `false` to skip seeding demo content on first use |
| `PLANNER_STORE` | `.data/planner.json` | Where Planner trips live. Separate file from the content store by design |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *unset* | Google sign-in ([ADR 0007](adr/0007-password-and-google-sign-in.md)). Both required; without them the Google routes answer 404 and the button is hidden. Server-only — never `NEXT_PUBLIC_*` |
| `GOOGLE_SIGNUP_ENABLED` | `true` | `false` stops a first Google sign-in from creating an account; existing accounts still sign in |
| `GOOGLE_REDIRECT_URI` | *derived* | Override for the callback URL; otherwise `NEXT_PUBLIC_SITE_URL` (or the request origin) + `/api/planner/oauth/google/callback`. Must match Google Cloud Console exactly |

`.data/` is gitignored. Nothing in it is seeded for the Planner — see
*Provision a Planner traveller* below.

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

### Provision a Planner traveller

Staff accounts are provisioned by an operator; the access token is shown
**once** — if it is lost, rotate it; it cannot be read back. Customers can also
create their own account by signing in with Google (see below). Add an `email`
and the response also carries a `temporaryPassword`, shown once; the person signs
in at `/dang-nhap` with it and is sent to `/doi-mat-khau` to choose their own.

```bash
# 1. A real secret, at least 32 characters, or every admin route answers 503.
export ADMIN_API_TOKEN="$(openssl rand -base64 36)"

# 2. Create the traveller. Keep `accessToken` from the response.
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"handle":"hung-tran","displayName":"Hưng Trần"}'

# 3. That token — not the admin one — is what reaches their trips.
curl -s http://localhost:3000/api/planner -H "authorization: Bearer <accessToken>"
```

A browser does not use that token directly — it signs in once and gets an
`HttpOnly` cookie ([ADR 0004](adr/0004-planner-identity.md)). With curl, use a
cookie jar:

```bash
# Sign in. The cookie lands in the jar; it is never readable by JavaScript.
curl -s -c jar.txt -X POST http://localhost:3000/api/planner/session \
  -H 'content-type: application/json' \
  -d '{"accessToken":"<accessToken>"}'

# Reads need nothing more.
curl -s -b jar.txt http://localhost:3000/api/planner

# Mutations must state a same-origin Origin — that is the CSRF rule cookies
# oblige, and a cookie request without it is refused with 403.
curl -s -b jar.txt -X POST http://localhost:3000/api/planner \
  -H 'origin: http://localhost:3000' -H 'content-type: application/json' \
  -d '{"source":"blank","title":"Đà Lạt 3 ngày","destinationSlug":"da-lat","durationDays":3,"partySize":2,"budget":{"targetTotalVnd":5000000}}'

# Sign out.
curl -s -b jar.txt -X DELETE http://localhost:3000/api/planner/session \
  -H 'origin: http://localhost:3000'
```

A session lasts 14 days, or 7 days without use. `rotate-token` signs the
traveller out everywhere.

Password and Google ([ADR 0007](adr/0007-password-and-google-sign-in.md)):

```bash
# Create a staff account with an email: keep `temporaryPassword` (shown once).
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"handle":"lan-nguyen","displayName":"Lan Nguyễn","email":"lan@example.com"}'

# Forgotten password: a new temporary one, and every session ends.
curl -s -X POST http://localhost:3000/api/admin/planner/users/<userId>/reset-password \
  -H "authorization: Bearer $ADMIN_API_TOKEN"

# Remove a Google link.
curl -s -X DELETE http://localhost:3000/api/admin/planner/users/<userId>/google \
  -H "authorization: Bearer $ADMIN_API_TOKEN"
```

To turn Google on locally, create an OAuth client of type *Web application* in
Google Cloud Console, register
`http://localhost:3000/api/planner/oauth/google/callback` as a redirect URI, and
set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` (never
committed). A first Google sign-in with an email no account has creates one.
An email that already has an account is refused with `link_required` — Google is
never linked by email. The person signs in with their password and follows
"Link your Google account" on `/doi-mat-khau` instead.

Mutating an existing trip needs the version from its `ETag`:

```bash
curl -s -X PATCH http://localhost:3000/api/planner/<id> \
  -H "authorization: Bearer <accessToken>" \
  -H 'if-match: "3"' -H 'content-type: application/json' \
  -d '{"partySize":4}'
```

Without `If-Match` the answer is 428; with a stale version, 412. See
[features/travel-planner-core.md](features/travel-planner-core.md) for the full
endpoint list.

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
5. **Google sign-in** — create the Google OAuth client, register the production
   redirect URI, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the
   deployment environment.
6. **Privacy notice** — customers who sign up with Google have their name and
   email stored; publish a privacy notice and a way to ask for deletion (Decree
   13/2023) before signup is on in production, or set
   `GOOGLE_SIGNUP_ENABLED=false` until then.

## Deploy

`npm run build` emits a fully prerendered app with no runtime data dependency, so
any Next.js host (Vercel, a Node server behind nginx, a container) works.
`NEXT_PUBLIC_SITE_URL` must be set at **build** time — it is baked into
canonicals, `hreflang` and the sitemap. Content changes require a rebuild;
there is no CMS and no revalidation path yet.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `require() of ES Module` from `@tailwindcss/node` | Running on a Node older than `.nvmrc` — run `nvm use` |
| `npm warn EBADENGINE` on install | Same cause: a Node older than `.nvmrc`. Run `nvm use`, then `npm ci` |
| `npm warn install-scripts … not yet covered by allowScripts` | A dependency with an install script is new, or an approved one changed version — approvals in `package.json` `allowScripts` are pinned to `pkg@version`. Check the package is the one you expect, then `npm install-scripts approve <pkg>` and commit the `package.json` change. Note that `--dry-run` writes anyway on npm 11.19 |
| A Vietnamese URL 404s | Pathname missing from `pathnames` in `routing.ts`, or the folder name does not match the internal pathname |
| `MISSING_MESSAGE` at runtime | Key added to one catalogue only |
| `npm run verify:ui` cannot launch | Chrome is not at the hard-coded macOS path in `scripts/screenshots.mjs` |
| Diacritics render wrong | A font was added without the `vietnamese` subset |
