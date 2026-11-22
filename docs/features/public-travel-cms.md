# Feature — Public Travel pages from the content repository

🇻🇳 Bản tiếng Việt: [public-travel-cms.vi.md](public-travel-cms.vi.md)

## Summary

The home page, the stories list, each story, the destination pages and the sitemap now read stories from the content repository that editors change in the admin CMS, instead of the typed seed in `src/content/stories.ts`. A published edit is visible on the next request; a draft, archived or unknown story is a 404. Design: [ADR 0012](../adr/0012-public-travel-from-content-repository.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/` | `/` | `/en` |
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |
| sitemap | `/sitemap.xml` | same file |

No route is added or changed. The permanent `/tour*` redirects are untouched.

## Data

`getPublicContent()` in `src/server/content/public.ts` returns `PublicStory` (published only): `blocks` (paragraph, heading, image, quote, list, place, cost), `places`, published `reviews`, `seo` (title, description, ogImage, noindex), `updatedAt`, `publishedAtIso`, `plannerTemplateSlug`. Message namespace `storyPage` holds the new strings. Destinations, itineraries and video reviews still come from `src/content/**`.

## How it works

Every affected page and the sitemap declare `dynamic = 'force-dynamic'`; there is no `generateStaticParams` or `revalidate`, so `next build` reads no content. The story page memoises one `getStory` per request (React `cache`) for `generateMetadata` and the page. A null story gives `{}` metadata and `notFound()`. `StoryBlocks` renders the seven block types: the page owns the only `h1`, heading blocks are `h2`/`h3`, images use the block alt text, consecutive cost blocks form one list formatted with `formatVnd`. Places not embedded as a block get a "places" section; published reviews get a "reviews" section. A `noindex` story gets robots `noindex` and leaves the sitemap. JSON-LD `Article` carries `dateModified` and the SEO image. The itinerary section and call to action appear only when `plannerTemplateSlug` is set; its days are loaded from the repository instance, and a failure there hides the section. Images go through `CoverImage`; `canOptimizeImage` (`src/lib/image-src.ts`) sends any https host that `next.config.ts` does not list to `next/image` as `unoptimized`, so a CMS image from another host cannot crash the page. A store error is a 500; there is no fallback to the seed. `PUBLIC_CONTENT_SOURCE=static` (backend) is the rollback.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/page.tsx`, `stories/page.tsx`, `stories/[slug]/page.tsx`, `destinations/[slug]/page.tsx` | Read stories through `getPublicContent()` |
| `src/app/sitemap.ts` | Async sitemap from `listSitemapEntries()` |
| `src/components/story/story-blocks.tsx` | Block renderer and place card |
| `src/components/cards/story-card.tsx`, `sections/{hero,latest-stories}.tsx` | Take `PublicStory`-shaped data |
| `src/components/ui/cover-image.tsx`, `src/lib/image-src.ts` | Image host allow-check |
| `src/components/admin/content-notice.tsx`, `admin/content/story-editor.tsx` | New notice wording; destination may be empty |
| `messages/vi.json`, `messages/en.json` | `storyPage`, notice and destination hint |

## Tests

`tests/public-travel-pages.test.ts`: force-dynamic and no static params on the five modules; no import of `@/content/stories` under `app` or `components`; sitemap lists published, indexable stories with `lastModified`; draft slug gives `{}` metadata and a 404; JSON-LD `dateModified`, noindex robots, a single `h1`; all block types render; a non-Unsplash https image renders without throwing. `tests/client-boundary.test.ts` gains a case that no page imports `server/content/repository` or `store`. Not tested: pixel layout.

## Limits and open questions

- Every view reads the store; single instance only until the content PostgreSQL store exists.
- `gallery` is not rendered (gallery items have no alt text). `actualCost` is not rendered and no longer reaches `PublicStory` or `GET /api/travel/stories*` (STORY-API-PROJ); re-add it, projected, when the cost summary layout is agreed.
- Images from hosts other than `images.unsplash.com` are served unoptimized; the host list in `src/lib/image-src.ts` must stay in step with `next.config.ts`.
- The seeded stories carry approximate trip dates (owner to correct).
- The story page still loads template days through `@/server/content/instance`, because `PublicStory` carries only the template slug.
