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

The Planner has no signup. Every traveller is provisioned by an operator, and the
access token is shown **once** — if it is lost, rotate it; it cannot be read back.

It takes two keys, and they are easy to mix up:

| Key | Who holds it | What it opens |
|---|---|---|
| `ADMIN_API_TOKEN` | the operator (the server, from `.env.local`) | the admin API — creating travellers, rotating their codes |
| `accessToken` | one traveller | that traveller's trips — it is the code typed on `/dang-nhap` |

**Step 1 — give the server the admin key.** The *server* has to read it; an
`export` in your terminal only reaches the commands you type there, not a
`npm run dev` that is already running. Put it in `.env.local` (gitignored) and
restart the dev server (skip this if the file already has that line):

```bash
printf 'ADMIN_API_TOKEN=%s\n' "$(openssl rand -base64 36 | tr -d '\n/+=')" >> .env.local
```

**Step 2 — load the same key into your terminal**, from the folder that holds
`.env.local`, so `curl` can send it. Nothing is printed:

```bash
export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env.local | cut -d= -f2-)"
```

**Step 3 — find the port.** `npm run dev` prints `Local: http://localhost:<port>`.
If 3000 is taken, Next moves to 3001, 3002… and `localhost:3000` is then
*someone else's* server. Use the port this server printed; the examples below
say 3000.

**Step 4 — create the traveller.** Keep `accessToken` from the response: it is
shown **once** and only its digest is stored.

```bash
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"handle":"hung-tran","displayName":"Hưng Trần"}'
```

A successful answer looks like
`{"user":{"id":"usr_…","handle":"hung-tran",…},"accessToken":"…64 characters…"}`.
Give the `accessToken` to the traveller privately; never paste it in a chat,
an issue or a commit.

Other admin calls on travellers:

```bash
# List travellers (no codes are ever returned).
curl -s http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN"

# Lost or leaked code: issue a new one. The old one stops working at once and
# the traveller is signed out everywhere.
curl -s -X POST http://localhost:3000/api/admin/planner/users/<userId>/rotate-token \
  -H "authorization: Bearer $ADMIN_API_TOKEN"
```

The traveller's code — not the admin key — is what reaches their trips:

```bash
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

### Try the Planner end to end

The whole reader journey from [the follow-the-footsteps feature](features/follow-hung-footsteps.md),
done by hand in a browser. Do it after *Provision a Planner traveller*, with
the traveller's `accessToken` at hand. Paths are the Vietnamese ones; the
English site has the same pages under `/en`.

1. **Read the story.** Open `/chuyen-di-choi/di-da-lat-lan-thu-sau`. Near the end
   there is a "Lịch trình thực tế" section (the real days of that trip) and a
   button to plan your own. Today this is the only story linked to a template
   (`da-lat-3-ngay-lang-man`); other stories show neither.
2. **Customise the copy.** The button opens `/tao-chuyen-di/da-lat-3-ngay-lang-man`.
   Fill in title, start date, party size, budget, style, pace and a note, then
   save. You do not need to be signed in yet: the draft is kept in this browser
   tab only (`sessionStorage`), never on the server.
3. **Sign in.** Saving while signed out sends you to `/dang-nhap`. Paste the
   `accessToken`. You come back to the form with the draft still filled in, and
   the trip is saved. The browser now holds an `HttpOnly` session cookie; the
   code itself is not stored in the browser.
4. **Find it in My Trips.** `/chuyen-di-cua-toi` lists the trip. Open it. From the
   detail page you can set the planning status (Draft / Planned / Completed),
   duplicate, archive and share. The copy is independent: changing it never
   changes the original template or the story.
5. **Share it.** In "Chia sẻ chuyến đi", change "Ai xem được":

   | Choice | Who can open the link | Search engines |
   |---|---|---|
   | Riêng tư (private) | nobody — there is no link | — |
   | Ai có đường dẫn đều xem được (unlisted) | anyone who has the link | not indexed |
   | Công khai (public) | anyone who has the link | may be indexed |

   Then "Sao chép đường dẫn". The link looks like `/chia-se/<43 characters>`.
6. **Open it as a stranger.** Paste the link in a private window. You see the
   itinerary read-only, with no edit controls and no sign-in. You do not see the
   owner, the trip's own note or any expense.
7. **Take it back.** "Tạo đường dẫn mới" kills the old link at once and makes a
   new one; "Ngừng chia sẻ" returns the trip to private. Reload the private
   window: the old link now shows the site's not-found page ("Đi lạc rồi").

If a step does not behave like this, see *Troubleshooting* below.

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
| `require() of ES Module` from `@tailwindcss/node` | Running on a Node older than `.nvmrc` — run `nvm use` |
| `npm warn EBADENGINE` on install | Same cause: a Node older than `.nvmrc`. Run `nvm use`, then `npm ci` |
| `npm warn install-scripts … not yet covered by allowScripts` | A dependency with an install script is new, or an approved one changed version — approvals in `package.json` `allowScripts` are pinned to `pkg@version`. Check the package is the one you expect, then `npm install-scripts approve <pkg>` and commit the `package.json` change. Note that `--dry-run` writes anyway on npm 11.19 |
| A Vietnamese URL 404s | Pathname missing from `pathnames` in `routing.ts`, or the folder name does not match the internal pathname |
| `MISSING_MESSAGE` at runtime | Key added to one catalogue only |
| `npm run verify:ui` cannot launch | Chrome is not at the hard-coded macOS path in `scripts/screenshots.mjs` |
| Diacritics render wrong | A font was added without the `vietnamese` subset |
| `admin_auth_unconfigured` (503) from an admin route | The **server** has no `ADMIN_API_TOKEN` of 32+ characters. Put it in `.env.local` and restart `npm run dev` — an `export` in another terminal does not reach a running server. If it is set, you are calling a different server: check the port `npm run dev` printed |
| `unauthorized` (401) from an admin route | The key `curl` sent differs from the server's. Re-run the `export … .env.local` line in the folder that holds that `.env.local` |
| `localhost:3000` answers, but with old behaviour or another app | Another dev server (another worktree, another project) holds port 3000; yours moved to 3001+. Use the printed port, or stop the other server |
| Sign-in says the code is wrong | It is the traveller's `accessToken`, not `ADMIN_API_TOKEN`; or it was rotated. Rotate again and use the new one |
| Sign-in says to wait | The sign-in rate limit (10 per minute) — wait for the time shown |
| A share link shows the not-found page ("Đi lạc rồi") | The trip is private, archived, or the link was replaced by "Tạo đường dẫn mới" — all look the same on purpose |
