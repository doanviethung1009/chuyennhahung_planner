# ADR 0021 — Home MVP reads the session on the server, for the home page only

🇻🇳 Bản tiếng Việt: [0021-home-mvp-server-session.vi.md](0021-home-mvp-server-session.vi.md)

- **Status:** Accepted (project owner, 2026-11-17)
- **Date:** 2026-11-17
- **Owner:** system-architect
- **Affects:** `src/app/[locale]/page.tsx`, new `src/server/planner/home-page.ts`, new `src/lib/home/continue-trip.ts`, new `src/components/home/home-member-band.tsx`, `messages/*.json`; no migration, no new route or endpoint
- **Supersedes:** the decision in [ADR 0020](0020-personalized-home.md) (client islands plus a new endpoint), **for the MVP only**
- **Detail:** [specs-home-mvp.md](../specs-home-mvp.md)

## Context

The MVP is small: a band for a member with no trip ("create your first trip") and a
band for a member with a trip ("Continue Planning"); guests keep today's page. The
owner asked to prefer Server Components, reuse the session and My Trips, add no
database, keep public SEO and protect private trips.

[ADR 0020](0020-personalized-home.md) answered a larger question and rejected reading
the session on the server (its option B), mainly because it makes `/` a per-user
document. Facts found since, in the repository:

1. `/` is already `force-dynamic`; there is no static or cached render to lose.
2. Server components already read the session cookie and call `identify` with only the
   cookie forwarded: `readAdminPageAccess` (ADR 0010 §7).
3. The test that keeps request data out of the header guards the layout and header, not
   `page.tsx` (`tests/header-account.test.ts`).
4. The deploy has no shared cache: the nginx config sets no `proxy_cache`.
5. A visitor with no cookie costs nothing extra: `cookies()` is read and nothing else.

What we do not know: whether production will put a CDN or shared cache in front of `/`
(Phase 09), and whether Next sends `private, no-store` on this dynamic render — the
second is checked by a test before merge.

## Decision

1. **`/` reads the session cookie on the server, and only `/`.** A new module,
   `src/server/planner/home-page.ts`, mirrors `admin-page.ts`: cookie → `identify`
   (cookie only) → `listTrips` → an allow-listed `HomeMember` value. Any failure,
   missing cookie, invalid session or pending password change yields `guest`.
2. **The page for a request without the cookie stays byte-identical** to today's.
   `generateMetadata`, the layout and the header stay cookie-free.
3. **One server component** renders the band above the hero; no client component, no
   client fetch, no new endpoint.
4. **A response to a request that carries the cookie must be `private, no-store`.**
   Verified by a test; if Next does not emit it, a conditional header rule (`has`
   cookie) is added in `next.config.ts`.
5. **ADR 0020 stays the target for the full feature** and the path back if a shared
   cache is introduced.

## Options considered

| Option | For | Against |
|---|---|---|
| **A (chosen)** Server Component reads the cookie on `/` | No client JavaScript, no flash or layout shift, no new endpoint, one store read only for signed-in members; fits the owner's brief and the admin-page precedent | `/` is a per-user document for cookie requests; a future CDN must bypass the cache for them; the privacy guarantee rests on the `private, no-store` header and an isolation test |
| B ADR 0020: public shell, client islands, new `GET /api/planner/home` | Safe in any shared cache; guest page doubles as fallback | A new endpoint, provider, skeletons and a layout-shift budget for a one-band feature; two sequential requests; more code than the feature earns |
| C Server read inside `<Suspense>` with a streamed band | Shell shows first | A band inserted above the hero after first paint shifts layout for members; the data read is a few milliseconds, so streaming buys nothing |

Runner-up: **B**. It lost on one reason — it is the right design for a larger,
cache-fronted home page but too much machinery for two bands while no shared cache
exists. Reversing to B later is additive: the pure functions and the `HomeMember` type
carry over.

## Consequences

Easier: the MVP is a small, server-only change reviewable in one PR; guests, crawlers
and SEO are untouched; no new API surface or client code to secure; members get the
band in the first byte.

Harder: `/` is no longer identical for everyone, so any future CDN or shared cache must
vary or bypass on the session cookie — this must be decided before Phase 09 (spec Q5);
the isolation test between two members and the byte-identical guest test are
obligations; the existing rule "public pages stay free of request data" now has one
named exception, which `tests/home-page-boundary.test.ts` encodes so it cannot spread
to the layout, header, metadata or other public pages. Reversing means removing one
component line and one module.

## Follow-up

- Accept this ADR and answer Q1–Q5 in the spec before code.
- Mark ADR 0020 as superseded for the MVP (done in this change) and keep it as the
  full-feature design.
- Feature document `docs/features/home-continue-planning.md` + `.vi.md`; update
  `docs/architecture.md` + `.vi.md` and `.claude/context/project-context.md` with the
  one-line exception.
- `/sec-check` and `/qc-check` on the owner's request before merge.
