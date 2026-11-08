# Feature — Plan your trip (Planner entry point)

🇻🇳 Bản tiếng Việt: [plan-your-trip.vi.md](plan-your-trip.vi.md)

## Summary

The page where a visitor asks the family to plan a trip for them. Today it
explains how that works in four steps and hands over real contact routes. **It
has no form on purpose** — wiring it to the Planner API is frontend work that has
not started, and a submit button with nothing behind it is a dead control.

The Planner *backend* has since shipped ([ADR 0002](../adr/0002-planner-core.md),
[travel-planner-core.md](travel-planner-core.md)), so the contract this page will
eventually post to already exists. What is missing is the UI, not the server.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |

Reached from the footer, from the home-page CTA section, and from itinerary pages.

## Data

No content collection. Everything on the page comes from the `plan` message
namespace (title, description, intro, `step1Title`…`step4Detail`, contact copy,
`emailSubject`, `emailBody`, `browseCta`) plus `siteConfig.contactEmail` and
`social` from [`src/content/site.ts`](../../src/content/site.ts).

`contactEmail` and the social handles are **owner-action-required**: the mailto
link is only as real as the mailbox behind it.

## How it works

A server component with three sections, each with its own `aria-labelledby`
heading: the four-step explanation as an ordered list, the contact block, and a
fallback link to the itineraries.

The primary action is a prefilled `mailto:` — subject and body are built from
translated strings and `encodeURIComponent`, so a Vietnamese visitor gets a
Vietnamese draft. The secondary actions are the live social channels (email is
filtered out of that row, since it is already the primary button). Every external
button carries an "opens in new tab" label.

This is the shape the rules require: real affordances, no server dependency, and
no control that does nothing.

## Files

| Path | Role |
|---|---|
| [`src/app/[locale]/plan-your-trip/page.tsx`](../../src/app/[locale]/plan-your-trip/page.tsx) | The page |
| [`src/components/sections/plan-trip-cta.tsx`](../../src/components/sections/plan-trip-cta.tsx) | Home-page CTA |
| [`src/content/site.ts`](../../src/content/site.ts) | Contact email + social channels |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | `plan` namespace |

## Tests

Covered indirectly: `tests/routing.test.ts` proves the route exists in both
locales and is reachable from the footer navigation, and `tests/i18n.test.ts`
proves every `plan` string exists in both catalogues with matching placeholders.
`npm run verify:ui` captures the page at three widths. There is no behavioural
test, because there is no behaviour yet.

## Limits and open questions

No form, no persistence, no server action, no rate limiting — none of it is
scaffolded, deliberately. Opening the Planner phase means, in order: an approved
ADR for the data model and the submission contract, then the backend (validation
at the boundary, authorization, idempotent writes, safe error shapes), then the
form.

Until then the real risks are mundane: an unmonitored mailbox, and social handles
that have never been verified. Both are listed in
[../usage.md](../usage.md#before-going-live--owner-actions).
