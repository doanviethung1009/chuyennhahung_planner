# Feature — Trip template list

🇻🇳 Bản tiếng Việt: [trip-template-list.vi.md](trip-template-list.vi.md)

## Summary

A public page listing the trip templates the owner has opened to everyone. Each
text-only card shows the plan's length, style, pace, group and estimated cost, and has
one button, "Use this template", that goes straight to `/trip-setup/[template]` so the
visitor can make their own copy in the Planner. Before this page a template could only
be reached from the call to action at the end of a story. Task: WEB-2 = P04-4.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/trip-templates` | `/lich-trinh-mau` | `/en/trip-templates` |

The page is indexable and is in the sitemap; an empty or failed list is `noindex, follow`.
`/trip-setup/[template]` stays `noindex`. Linked from the footer ("Explore" column) and
from the template button on `/plan-your-trip`. Not in the primary navigation.

## Data

- Reads `TravelTemplate` through `getRepository().listTemplates({ visibility: 'public', limit: 100, offset: 0 })`.
  No API, schema or repository change.
- **"Withdrawn" means `visibility` back to `private`.** That is the only condition used,
  the same as `/trip-setup/[template]`, `GET /api/travel/templates` and the story call to
  action, so every card on the page leads somewhere that works. The state of the source
  story is not checked.
- `PublicTemplateCard` (`src/server/content/public-templates.ts`) is an explicit allow-list built
  field by field: `slug`, `title`, `summary`, `durationDays`, `travelStyle`, `pace`,
  `groupSize`, `estimatedTotalVnd`, `destinationSlug` (only to look up the destination name).
  It carries no source story, snapshot, version, timestamps, visibility, itinerary or place
  slugs, or any day/activity data.
- Messages: `tripTemplates` and `nav.tripTemplates` (vi and en); labels for style and pace
  reuse `travelStyle` and `pace`; cost uses `formatVnd`.
- The seed holds one public template (`da-lat-3-ngay-lang-man`); more need real data from
  the owner. Nothing was invented to fill the page.

## How it works

`page.tsx` is a server component, `force-dynamic`, so a withdrawn template disappears on the
next request. It calls `listPublicTemplates()`; the `visibility: 'public'` filter lives in that
function, not at the call site. Order is by slug (as `listTemplates` returns it).

- **Cards:** `TemplateCard` is a pure component receiving translated labels as props. One `<h2>`,
  one link; the link text is "Use this template" plus a screen-reader-only template title.
  No image: templates have no image field.
- **Empty:** a message with real links to `/stories` and `/my-trips/new`; page is `noindex`.
- **Error:** a store failure is caught in the page, logged with the error name only, and shown
  as a `role="alert"` block with a retry link to the same page. It is never shown as "empty".
- **Layout:** one column at 375px, two at 768px, three at 1280px; one `<h1>` from `PageHeader`.

## Files

| Path | Role |
|---|---|
| `src/server/content/public-templates.ts` | `PublicTemplateCard`, `toPublicTemplateCard`, `listPublicTemplates` |
| `src/app/[locale]/trip-templates/page.tsx` | The page, metadata, empty/error branching |
| `src/components/templates/template-card.tsx` | Text-only card |
| `src/components/templates/template-states.tsx` | Empty and error blocks |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route and sitemap entry |
| `src/components/layout/site-footer.tsx` | Footer link |
| `src/app/[locale]/plan-your-trip/page.tsx` | Template button now points here |
| `messages/vi.json`, `messages/en.json` | `tripTemplates`, `nav.tripTemplates`, `plan-your-trip` button text |

## Tests

- `tests/trip-templates-list.test.ts` (node): the route map; only public templates are listed and one
  turned private disappears on the next read; a store failure rejects instead of reading as empty;
  the card has exactly the allow-listed keys and no internal field appears in its JSON; sitemap,
  footer and `/plan-your-trip` wiring; vi/en key parity; `noindex` for empty and failed lists.
- `tests/dom/template-card.test.tsx` (jsdom, ADR 0027): one `h2`, exactly one link to
  `/tao-chuyen-di/<slug>` (`/en/trip-setup/<slug>` in EN), a screen-reader-only title in the link, no
  `href="#"`; empty state links; error state is an alert with a retry link.
- Not covered: rendering the async page itself (not possible in jsdom) and the 375/768/1280 layout,
  which was checked by hand.

## Limits and open questions

- A template still `public` whose source story was unpublished or deleted is listed and works. Fixing it
  at the root is P07-21, so every surface changes at once.
- No filter, search or pagination: the seed has one template. It reads at most 100; beyond that the rest
  is not shown. Filtering by `travelStyle` or destination is supported by the repository and can be added
  once there are more than about a dozen.
- `GET /api/travel/templates` still returns the full template (ids, snapshot, version). A projection for
  it is a separate task; this page does not use it.
- Needs the owner's real templates; the list looks sparse until then.
