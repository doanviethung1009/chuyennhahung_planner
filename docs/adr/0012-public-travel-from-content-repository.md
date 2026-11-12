# ADR 0012 — Public Travel pages read the content repository, not the typed seed

🇻🇳 Bản tiếng Việt: [0012-public-travel-from-content-repository.vi.md](0012-public-travel-from-content-repository.vi.md)

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-12
- **Owner:** system-architect
- **Decided by:** owner (accepted 2026-11-12, as proposed), system-architect (shape)
- **Affects:** new `src/server/content/public.ts`, `src/server/content/{schemas,repository}.ts`, `src/content/travel/**`, `src/server/planner/catalog.ts`, `src/app/[locale]/{page,stories,destinations}/**`, `src/app/sitemap.ts`, `src/components/{cards,sections}/**`, a new seed script, `Dockerfile`, `docs/usage.*`, `docs/architecture.*`

## Context

[ADR 0011](0011-admin-content-cms.md) lets an editor change stories, places and reviews in the browser, but its implementation notes record that **the edit never reaches the public site**. Verified in the code:

- `/stories`, `/stories/[slug]`, `/destinations/**`, the home page, the sitemap and `components/sections/hero.tsx` import the typed seed in `src/content/**` (`stories.ts`, `destinations.ts`, `types.ts`). The only repository read on a public page is `getPublicTemplate` in `stories/[slug]` and `trip-setup/[template]`.
- The two data sets are **different sets, not two copies of one**. `src/content/stories.ts` holds 6 stories; the content store seeds exactly one (`ba-ngay-lang-man-o-da-lat`, `src/content/travel/seed.ts`). Switching the pages over without importing them would make all six vanish.
- Destinations (9) and itineraries are **not** content-repository entities. The repository only validates slugs against them (`knownDestinationSlugs`, `knownItinerarySlugs` in `repository.ts`).
- `/reviews` renders `VideoReview` (`src/content/video-reviews.ts`): link-free video metadata. The CMS `TravelReview` is a written, rated review with no public page at all.
- Places have **no** `status` (`placeSchema`); `/api/travel/places` already lists every place.
- `generateStaticParams` and `next build`: the Docker build has no database, and today `next build` seeds a throwaway `.data/` by prerendering `stories/[slug]` (see the `Dockerfile` comment). The content store is **still a JSON file** (`instance.ts` calls `createJsonFileStore`); `CONTENT_DATABASE_URL` from [ADR 0008](0008-postgres-document-store.md) is not built and [ADR 0009](0009-postgres-persistence.md) left the content store out. The JSON store caches the document in the process and assumes one writer.

Unknown: how many app instances run today (`deploy/compose.app.yml` was not checked for replicas); real traffic; when the content store moves to PostgreSQL.

## Decision

1. **One server-only read module, `src/server/content/public.ts`,** is the only place public pages obtain Travel content. It exposes `getPublicContent(): Promise<PublicContent>`:

   ```ts
   interface PublicContent {
     listStories(): Promise<PublicStory[]>;                    // published only, newest first
     getStory(slug: string): Promise<PublicStory | null>;      // null for draft, archived, unknown
     listStoriesForDestination(destinationSlug: string): Promise<PublicStory[]>;
     listSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]>; // published, not noindex
   }
   ```

   Pages never import `repository.ts` or `store.ts` and never call the admin routes. An adapter pair sits behind the interface: `repository` (default) and `static` (reads `src/content/stories.ts`, the rollback and the test double). Sorting is by `publishedAt` desc, then slug; the repository's own `listStories` sorts by trip date and is not reused for ordering.

2. **Mapping (the view type is `PublicStory`; `Story` in `src/content/types.ts` is not changed).** Same-named fields pass through (`slug`, `title`, `excerpt`, `cover`, `readingMinutes`; every localized field is already `{ vi, en }`, both required by `localizedTextSchema`, so a story cannot be half-translated).

   | `src/content/types.ts` `Story` | Content entity `TravelStory` | Public view |
   |---|---|---|
   | `body: Localized<string[]>` | `content: StoryBlock[]` (paragraph, heading, image, quote, list, place, cost) | `blocks: StoryBlock[]` — the page renders blocks; `body` is dropped |
   | `publishedAt: 'YYYY-MM-DD'` | `publishedAt: timestamp \| null` | `publishedAt` = UTC date part (what `formatDate` expects) plus `publishedAtIso` for JSON-LD |
   | `destinationSlugs: string[]` | `destinationSlug` (one, required) | `destinationSlugs = [destinationSlug]` or `[]` |
   | `featured: boolean` | none | dropped: nothing reads it (home uses newest-first) |
   | `plannerTemplateSlug?` | none (templates point back with `sourceStorySlug`) | `plannerTemplateSlug: string \| null`, from a new story field (below) |
   | none | `travelDates`, `gallery`, `actualCost`, `placeSlugs`, `reviewIds`, `itinerarySlugs`, `seo`, `updatedAt` | `places: Place[]`, `reviews: TravelReview[]` (published only), `gallery`, `travelDates`, `actualCost`, `updatedAt`, resolved `seo` |

   Two additive schema changes are required so the six static stories survive the move: `storyInputSchema.plannerTemplateSlug: slugSchema.nullable().default(null)` (the static Đà Lạt story links a template that was cut from a *different* story, so it cannot be derived), and `storyInputSchema.destinationSlug` plus `sourceSnapshotSchema.destinationSlug` become **nullable** (two static stories have no destination). Both widen what is accepted, so every stored document still validates.

   `seo`: `title ?? title`, `description` replaces the excerpt in meta, `ogImage ?? cover`, `noindex` is honoured (robots meta, and the story leaves the sitemap). `canonicalPath` and `keywords` are **ignored** in this ADR: URLs are permanent and every page is self-canonical with `hreflang` (open question 6).

3. **Visibility.** Only `status === 'published'` is public. An unknown, draft or archived slug returns `null` and the page calls `notFound()` (404, never 403), as `getPublishedStory` already does for the API. Places carry no status, so they get **no page of their own**: a place is rendered only through a published story that references it (`placeSlugs` or a `place` block). A place used only by an unpublished story appears nowhere on the site; a slug that no longer resolves is omitted and logged, not rendered as a dead link. Reviews follow the same rule: shown only inside a published story that links them (the repository already refuses to publish a story with an unpublished review, and refuses to unpublish a review a published story links, so the filter is defence in depth). `plannerTemplateSlug` keeps today's behaviour: a missing or non-public template removes the itinerary section and the call to action.

4. **Rendering and caching: fully dynamic, no on-demand revalidation.** Every page that reads Travel content (`/`, `/stories`, `/stories/[slug]`, `/destinations/[slug]`, the sitemap) declares `export const dynamic = 'force-dynamic'`; the `revalidate = 60` in `stories/[slug]` is removed. Reads go through the repository, whose JSON store serves the document from an in-process cache (`json-store.ts`) that a write in the same process updates immediately, so a published edit is visible on the next request with no window and no invalidation hook to forget. Static and cheap parts are unchanged: `/about`, `/itineraries/**`, `/reviews` (video), `/map`, and everything not listed. Next.js is `^16.4.5`; `next.config.ts` sets no `cacheComponents`, so `force-dynamic` behaves as it does on the existing API routes.

5. **Build with no store reachable.** Because the pages are dynamic, `next build` performs **no** content read: `generateStaticParams` is removed from `stories/[slug]` and `destinations/[slug]` and the sitemap is built per request. The build-time throwaway `.data/` seed disappears, so the `Dockerfile` step that deletes it can be simplified. A store failure at request time is an HTTP 500 and an empty sitemap is never served in place of a failed one: there is **no silent fallback** to the static seed (same principle as [ADR 0009](0009-postgres-persistence.md) §"no fallback to JSON").

6. **Search engines.** `generateMetadata` on every affected page reads the same `getStory` result (one cached call per request via React `cache`), keeps `buildPageMetadata` and its `hreflang` + `x-default`, and returns `{}` plus the 404 for a null story. The story JSON-LD `Article` gains `dateModified` from `updatedAt` and takes `image` from `seo.ogImage ?? cover`. `src/app/sitemap.ts` becomes async and takes stories from `listSitemapEntries()` with `lastModified = updatedAt`; destinations, itineraries and static pages are unchanged.

7. **Seeding.** The content store gains the six static stories through `src/content/travel/static-stories.ts`, a pure `staticStoryToInput(story)` that produces a `StoryCreateInput`: paragraphs become `paragraph` blocks (the script fails if `vi` and `en` lengths differ), `seo.description = excerpt`, `travelDates = { start: date, end: date }` (an **approximation, not the real trip dates** — flagged per CLAUDE.md rule 8), published with `publishedAt = <date>T00:00:00.000Z`. Two entry points: a **fresh** store gets them from `seedTravelContent`; an **existing** store (it already holds the Đà Lạt story, so the current "seed if no places" guard would skip them) gets them from an explicit `npm run content:seed-static [--dry-run]`. The script creates only slugs that do not exist and never calls an update, so it cannot overwrite a CMS edit. It is deliberately not run on boot: an editor's delete must not be undone by a restart. Running it by hand after a delete does recreate that story (accepted, documented).

8. **After the move, `src/content/**`:** `stories.ts` is kept as the seed source, the `static` adapter and a test fixture, and is no longer the live source (a code comment says so; edits there no longer change production). `destinations.ts`, `itineraries.ts`, `site.ts`, `video-reviews.ts` stay the live source: they are not CMS entities. `types.ts` stays.

9. **Out of scope, untouched.** The permanent tour redirects in `next.config.ts` and `/tour*` routes (CLAUDE.md rule 2); `/itineraries/**`; destinations and the map; `/reviews` (video). `src/server/planner/catalog.ts` takes its `siteStories` (`slug`, `title`, `plannerTemplateSlug`) from the read module instead of `src/content/stories`, so the template-to-story link keeps working.

10. **Rollback.** `PUBLIC_CONTENT_SOURCE=static` selects the `static` adapter at **request time** (pages are dynamic), so reverting is an environment change and a restart, not a rebuild. Default is `repository` once approved. Seeded rows stay in the store harmlessly. While on `static`, CMS edits are invisible again (the ADR 0011 state). Removing the adapter and the flag is a later change.

```mermaid
flowchart LR
  E[Editor, /quan-tri] -->|PATCH, status| A[/api/admin/travel/**]
  A --> R[(Content repository)]
  P[Public pages, sitemap] -->|force-dynamic| M[getPublicContent]
  M -->|PUBLIC_CONTENT_SOURCE=repository| R
  M -.->|=static, rollback| S[src/content/stories.ts]
```

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen): dynamic pages over `public.ts`, no revalidation | Edit visible at once; correct for any writer (admin UI, `curl`, future routes); no build-time DB; one flag rolls back | Every view reads the store; no CDN-style page cache; HTML is `no-store` so nginx cannot micro-cache without an override |
| B: on-demand `revalidatePath`/`revalidateTag` from the status, PATCH, create, delete routes | Fastest pages | Self-hosted cache is per instance, so a second instance stays stale; every writer (including token `curl` and routes not yet written) must call it, and a missed one is a silent stale page; list pages still cannot prerender with no DB. The Next 16 `revalidateTag` signature would also need checking |
| C: time-based ISR (`revalidate = 60`, the ADR 0011 assumption) | One line; cached | Edits lag up to the window, longer per instance; list pages still need the store at build; the editor still cannot trust "saved means live" |
| D: change the content entities to equal `src/content/types.ts` | No view mapping | Destroys the typed block model, travel dates and SEO that ADR 0001 and 0011 built; a regression for the CMS |
| E: keep the typed seed, copy edits back into code | Nothing to build | Not a CMS |

Runner-up B lost on one reason: it is only correct if every writer remembers to invalidate and there is one instance. A is also reversible into B later, because the read module is the seam and no page contract changes.

## Consequences

Easier: the editor's change is public immediately; the sitemap, metadata and JSON-LD come from one source; pages switch from a typed file to a function with no change to cards that already take `Story`-like props; rollback is one variable.

Harder:

- **Per-request cost.** Every story view and the home page read the store. With the in-process JSON cache this is cheap, but it is not measured; measure before claiming. The home page, previously static, is now dynamic.
- **Multi-instance is now visible.** The JSON content store has one writer per process; with more than one app instance, an edit on instance A is not seen by B. That already holds for the API, but public pages now depend on it. The remedy is the content PostgreSQL store (ADR 0008 step 1, not built) and it becomes a prerequisite to run two instances. Until then the app must stay single-instance for content.
- **Schema widening.** `destinationSlug` becomes nullable and a story gets `plannerTemplateSlug`; the admin story form, `listStories` filter, template snapshot and integrity check must handle null.
- **Story renderer.** The detail page must render seven block types (today it renders paragraphs), including `place` and `cost` blocks, with accessible headings (blocks use `h2`/`h3` only).
- **Seeded data is approximate.** Six stories get a trip date equal to their publish date until the owner corrects them.
- **Two stories on one topic.** The static `di-da-lat-lan-thu-sau` and the CMS `ba-ngay-lang-man-o-da-lat` both exist after the move.
- **Drift.** After cutover, `src/content/stories.ts` is a trap: an edit there changes nothing in production.
- **No audit of who published** (unchanged from ADR 0011).

## Follow-up

- Task Contract: `.claude/contracts/public-travel-from-content-repo.md`. State DESIGNED; this ADR is accepted; still gated on PR #41 merging. Feature document `docs/features/public-travel-cms.md` + `.vi.md` (frontend-engineer).
- On acceptance, flip the status, then update `docs/architecture.md` + `.vi.md` (route/caching table, Phase 07 backlog line "public pages read the typed seed"), `docs/usage.*` (`PUBLIC_CONTENT_SOURCE`, `content:seed-static`, build page count, Docker build), and `.claude/context/project-context.md`. ADR 0011's decision 8 is superseded by decision 4 here.
- Open questions for the owner:
  1. Default `PUBLIC_CONTENT_SOURCE` at cutover: `repository` immediately, or `static` until the seed script has run on the VM?
  2. Accept `travelDates = publish date` for six seeded stories, or supply real dates?
  3. Widen `destinationSlug` to nullable (this ADR), or assign a destination to the two destination-less stories?
  4. Places have no `status` and `/api/travel/places` lists all: add a status now, or accept?
  5. Should `/reviews` also list published written reviews (new UI), or only show them inside stories?
  6. Honour `seo.canonicalPath` and `keywords`, or keep ignoring them?
  7. Editors previewing a draft: needed, and by what route?
  8. Is the app one instance today, and when is the content PostgreSQL store wanted?
  9. Is a recreated deleted story after a manual `content:seed-static` acceptable?
