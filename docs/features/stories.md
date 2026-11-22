# Feature — Stories

🇻🇳 Bản tiếng Việt: [stories.vi.md](stories.vi.md)

## Summary

The heart of the site: first-person accounts of trips the family actually took.
Stories are what makes this a storytelling site rather than a catalogue, and
every other collection links back into them.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |

## Data

[`src/content/stories.ts`](../../src/content/stories.ts) — 6 items of type
`Story`: `slug`, `title`, `excerpt`, `body` (an array of paragraphs, localized),
`publishedAt` (ISO date, used for `datePublished` and sorting), `readingMinutes`,
`destinationSlugs`, `cover`, `featured`.

`destinationSlugs` must name destinations that exist — `tests/content.test.ts`
fails on a dangling reference.

Helpers exported alongside the data: `storiesNewestFirst`, `storyBySlug`,
`getStory(slug)`, `getStoriesForDestination(destinationSlug)`.

## How it works

Both pages are server components. The index renders `storiesNewestFirst` through
`StoryCard`; the detail page looks the story up with `getStory` and calls
`notFound()` on a miss, which renders the localized `not-found.tsx`.

`generateStaticParams` prerenders every slug in every locale at build time. Body
paragraphs render through the `Prose` primitive so typography stays consistent
without a markdown pipeline. Dates are formatted by `formatDate` from
[`src/lib/format.ts`](../../src/lib/format.ts) with `vi-VN` / `en-GB` and a fixed
UTC timezone, so a story never shifts a day depending on where it is rendered.

Each story also emits `Article` JSON-LD and feeds the "latest stories" section on
the home page.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/stories/page.tsx`](../../src/app/[locale]/stories/page.tsx) | Index |
| [`src/app/[locale]/stories/[slug]/page.tsx`](../../src/app/[locale]/stories/[slug]/page.tsx) | Detail, `generateStaticParams`, JSON-LD |
| [`src/components/cards/story-card.tsx`](../../src/components/cards/story-card.tsx) | Card |
| [`src/components/sections/latest-stories.tsx`](../../src/components/sections/latest-stories.tsx) | Home-page section |
| [`src/content/stories.ts`](../../src/content/stories.ts) | Seed data + lookups |

## Tests

`tests/content.test.ts` covers slugs (unique, URL-safe), cross-references
(`destinationSlugs` resolve), locale completeness on every `Localized<T>` field,
and that each `cover` file exists on disk. Rendering is verified visually via
`npm run verify:ui`, which captures the index and
`/chuyen-di-choi/ba-ngay-o-ha-giang-khong-co-ke-hoach` at three widths.

## Limits and open questions

No tags, no search, no pagination — at six stories none of those earn their
weight, and all three become real work past roughly thirty. Body text is a plain
array of paragraphs: no headings, images or pull quotes inside a story. Adding
rich bodies means either a markdown pipeline or a block type in
`src/content/types.ts`, and that is a decision worth an ADR rather than an
incremental patch.

Covers are generated SVG until the owner supplies photographs.

**Story reviews (STORY-REVIEWS-PROJ).** `PublicStory.reviews` holds `PublicReview` (via `toPublicReview` in `src/server/content/public.ts`): only `id`, `title`, `rating`, `visitedOn`, `body`, `pros` and `cons`. A story page and its RSC payload never carry `status`, `publishedAt`, timestamps, `subject`, `costVnd` or `author`. Only published reviews are included. Test: `tests/public-content.test.ts`.
