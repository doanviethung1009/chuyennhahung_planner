# ADR 0021 — Personalized home page: one public document, personal content filled in the browser from a private projection

🇻🇳 Bản tiếng Việt: [0021-personalized-home.vi.md](0021-personalized-home.vi.md)

- **Status:** Proposed — superseded for the MVP by [ADR 0022](0022-home-mvp-server-session.md); kept as the full-feature design
- **Date:** 2026-11-16
- **Owner:** system-architect
- **Affects:** `src/app/[locale]/page.tsx`, new `src/app/api/planner/home/route.ts`, new `src/components/home/**`, `src/components/layout/` (shared account provider), new `src/lib/home/**`, `messages/*.json`; no migration, no change to `src/content/types.ts`
- **Detail:** [specs-home-personalization.md](../specs-home-personalization.md)

## Context

The owner wants one home page that changes for a guest, a new member and a returning
member. Facts from the repository:

1. `/` is a public, `force-dynamic` page, identical for everyone, with no cookie read.
   Public pages must not import the repository or store (`tests/client-boundary.test.ts`).
2. Who is signed in is already learnt in the browser with `GET /api/planner/session`,
   on purpose: a cookie read in the layout would make every page per-user
   (`useAccount()` in `src/components/layout/account-menu.tsx`).
3. Private Planner routes answer `no-store` and take the owner from the session
   (`src/server/planner/http.ts`). The data a personal home needs already exists per
   owner, but `GET /api/planner` returns whole `Trip` rows (share token, note, budget).
4. There is no stored preference, saved item, profile or notification yet (Phase 11–15).

What we do not know: real traffic split between guests and members, and the share of
visits from shared caches or a CDN once production exists (Phase 09).

## Decision

1. **Keep one route and one server-rendered document for everyone.** `page.tsx` does not
   read `cookies()` or `headers()`, does not import the Planner repository, and renders
   the same bytes for a guest and a member. It additionally embeds a small **public**
   pool (story, itinerary and approved community-trip summaries).
2. **Fill personal slots in the browser.** A client provider calls a new
   `GET /api/planner/home` (after the shared session probe says signed in) and swaps the
   hero for a member band and adds member modules. Failure or 401 leaves the guest page.
3. **Add one read endpoint returning an allow-listed projection**, `HomeSnapshot`
   (counts, one resume trip, up to three others, own destination slugs, modal style and
   pace, own submission statuses). Strict zod schema, `no-store`, per-session limiter
   (30/min), owner from the session only. It never returns a `Trip` row, share token,
   note, budget, moderation text or any credential.
4. **Rank in the browser, with pure functions.** `rankForYou` and `pickNudge` run over
   the public pool and the member's snapshot; the member's signals are not sent to any
   service. Rules and reasons are in the spec, section 5.
5. **One stored hint at most:** a `localStorage` value `member` (no id, name or count)
   that only picks the first skeleton. Nothing else personal is stored client-side.
6. **Do not add a route.** No `/home`, no member-only page; the tour redirects and
   `pathnames` are untouched.

## Options considered

| Option | For | Against |
|---|---|---|
| **A (chosen)** Public document + client islands + private projection endpoint | Safe in any shared cache; matches the existing header pattern; guest page doubles as fallback and SEO page; ranking never leaves the browser | A short moment of guest content or skeleton for members; two sequential requests (session, then home); logic split across server and client |
| B Read the session cookie in `page.tsx` and render per user | No flash; one render | `/` becomes per-user and uncacheable; one missing `Vary` leaks a member's trips to another; a store read on every request; reverses ADR 0004's header decision; breaks the "public pages do not touch the repository" rule |
| C A separate member route (`/home`) | Simple to reason about | Two homepages, which the brief rules out; redirect logic after sign-in; duplicate content |
| D Render server variants chosen by a non-secret cookie flag | Less flash | Still per-user HTML; the flag is forgeable and stale; cache keys must vary by it |
| E Reuse `GET /api/planner` and `/reviews` without a new route | No new surface | Returns share tokens, notes, budgets the page does not need; two calls; couples the UI to full row shapes |

Runner-up: **B**. It lost on one reason — it turns the most visited page into a
per-user document, and the privacy guarantee then rests on every cache layer being
configured correctly forever.

## Consequences

Easier: the guest and crawler experience cannot be affected by member data; no cache
configuration is needed to keep members' data private; the rules are pure and unit
tested; each state can be built and shipped as its own slice; a model can later replace
the rules behind the same input and output types.

Harder: members see guest content or a skeleton for the length of two requests, so
slots need reserved heights and a layout-shift budget (CLS ≤ 0.1) that must be measured;
the session probe must be shared between the header and the home page; the pool and
the rules ship to the client; one new route handler must be listed in `docs/runbook.md`
and covered by tests; the `@` display-name fallback and the isolation test between two
members are obligations, not options. Reversing this means moving to option B, which
requires rethinking caching of `/` and re-doing the privacy review.

Not decided here: stored preferences (Phase 11), saved items (Phase 14), discovery and
notifications (Phase 15), AI suggestions (Phase 06).

## Follow-up

- Accept this ADR and answer the open questions in the spec before slice H1.
- Slice H1: endpoint, schema, tests, `AccountProvider`, slots (backend, then frontend).
- Feature document `docs/features/personalized-home.md` + `.vi.md`, registered in both
  feature indexes; update `docs/architecture.md` + `.vi.md`, `docs/runbook.md` + `.vi.md`,
  `docs/runbook-api.md`, `.claude/context/project-context.md`.
- Roadmap: the owner decides Phase 16 versus folding into Phase 04; `PHASES.md` is not
  edited by this ADR.
- `/sec-check` and `/qc-check` before merging the endpoint slice, on the owner's request.
