# Feature — Video reviews

🇻🇳 Bản tiếng Việt: [video-reviews.vi.md](video-reviews.vi.md)

## Summary

A shelf of the short videos the family has published, with the two channel
buttons that actually reach them. It exists to make the social presence visible
from the site without pretending to be a video player.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/reviews` | `/goc-review` | `/en/reviews` |

A home-page section renders the same cards.

## Data

[`src/content/video-reviews.ts`](../../src/content/video-reviews.ts) — 6 items of
type `VideoReview`: `id`, `title`, `platform` (`tiktok` / `facebook` /
`youtube`), `durationSeconds`, `destinationSlug`, `cover`, `publishedAt`. Sorted
newest-first by the exported `videoReviewsNewestFirst`.

There is **no URL field**, and that absence is the whole design of this feature.

Channel links come from `social` in [`src/content/site.ts`](../../src/content/site.ts),
filtered to drop the email entry. Those handles are **owner-action-required**
defaults.

## How it works

Server components only. `VideoCard` is deliberately **presentational**: no
anchor, no play button, no hover lift. We hold no per-video URLs, so a card that
linked to the channel would imply it opens that specific clip — a link that lies
about its destination, which is worse than no link. The rule "no placeholder
links, no dead buttons" is what produced this shape.

Visitors reach the clips through the two `ButtonExternalLink` channel buttons at
the top of the page, which are the only links we can guarantee. They carry an
"opens in new tab" label from the `common` namespace.

`durationSeconds` renders through `formatDuration` as `m:ss`.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/reviews/page.tsx`](../../src/app/[locale]/reviews/page.tsx) | Page, channel buttons, card grid |
| [`src/components/cards/video-card.tsx`](../../src/components/cards/video-card.tsx) | Presentational card |
| [`src/components/sections/video-reviews-section.tsx`](../../src/components/sections/video-reviews-section.tsx) | Home-page section |
| [`src/content/video-reviews.ts`](../../src/content/video-reviews.ts) | Seed data + newest-first order |
| [`src/content/site.ts`](../../src/content/site.ts) | Channel URLs — needs the owner's real handles |

## Tests

`tests/content.test.ts` has a dedicated `keeps video reviews link-free` case,
so the decision above cannot be undone by accident, plus unique video `id`s,
`destinationSlug` resolution, locale completeness and cover existence.

## Limits and open questions

The cards do not play or open anything. To make them clickable: add a URL field
to `VideoReview` in `src/content/types.ts`, fill it for all six items, wrap the
card body in an anchor, and update the `keeps video reviews link-free` test —
that test failing is the intended signal, not an obstacle.

View counts, embeds and automatic sync with TikTok or Facebook are all out of
scope; there is no API client here and adding one would make a static site depend
on a third party at build time.
