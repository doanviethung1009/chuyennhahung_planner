# Feature — Plan your trip (Planner entry point)

🇻🇳 Bản tiếng Việt: [plan-your-trip.vi.md](plan-your-trip.vi.md)

## Summary

The entry point to the Planner. A visitor can start designing a trip right away
through two real links — a story with a real itinerary or a blank trip — or ask the family to
suggest a plan, which the page explains in four steps and backs with real contact
routes. **It has no form on purpose**: the page links into the Planner rather than
posting to it, and a submit button with nothing behind it is a dead control. It
promises no AI and no automatic itinerary builder — those are deferred.

The Planner itself ([ADR 0002](../adr/0002-planner-core.md),
[travel-planner-core.md](travel-planner-core.md)) lives behind those links.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |

Reached from the footer, from the home-page CTA section, and from itinerary pages.

## Data

No content collection. Everything on the page comes from the `plan` message
namespace (title, description, intro, `startTitle`…`startBlankHint`, `stepsTitle`,
`step1Title`…`step4Detail`, contact copy, `emailSubject`, `emailBody`) plus `siteConfig.contactEmail` and
`social` from [`src/content/site.ts`](../../src/content/site.ts).

`contactEmail` and the social handles are **owner-action-required**: the mailto
link is only as real as the mailbox behind it.

## How it works

A server component with three sections, each with its own `aria-labelledby`
heading. The first is the primary one, "start designing now", with two `ButtonLink`s
(≥44px): `/stories` (pick a story; the real-itinerary section on each story page leads on to
`/trip-setup/[template]`, which needs a template slug and so cannot be the page's
single target — the itinerary pages do not link to it) and `/my-trips/new` (a blank trip). Below, under "or ask the family
to suggest a plan", come the four-step explanation as an ordered list and the
contact block.

The contact action is a prefilled `mailto:` — subject and body are built from
translated strings and `encodeURIComponent`, so a Vietnamese visitor gets a
Vietnamese draft. The secondary actions are the live social channels (email is
filtered out of that row, since it is already the primary button). Every external
button carries an "opens in new tab" label.

This is the shape the rules require: real affordances, no server dependency on
this page, and no control that does nothing. The page keeps the line that the
family does not sell tours and takes no commission.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/plan-your-trip/page.tsx`](../../src/app/[locale]/plan-your-trip/page.tsx) | The page |
| [`src/components/sections/plan-trip-cta.tsx`](../../src/components/sections/plan-trip-cta.tsx) | Home-page CTA |
| [`src/content/site.ts`](../../src/content/site.ts) | Contact email + social channels |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | `plan` namespace |

## Tests

`tests/plan-your-trip-links.test.ts` proves both link targets exist in the
pathname map and that the new `plan` keys exist in both catalogues.
`tests/routing.test.ts` proves the route exists in both locales and is reachable
from the footer navigation, and `tests/i18n.test.ts` proves every `plan` string
exists in both catalogues with matching placeholders. `npm run verify:ui`
captures the page at three widths.

## Limits and open questions

No form, no persistence, no server action, no rate limiting on this page — none
of it is scaffolded, deliberately. No AI suggestions and no automatic itinerary
builder: both are deferred and need their own ADR. A signed-out visitor who opens
`/my-trips/new` is handled by that page, not this one.

Until then the real risks are mundane: an unmonitored mailbox, and social handles
that have never been verified. Both are listed in
[../usage.md](../usage.md#before-going-live--owner-actions).
