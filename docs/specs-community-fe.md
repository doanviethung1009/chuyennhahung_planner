# Community Platform spec — frontend

🇻🇳 Bản tiếng Việt: [specs-community-fe.vi.md](specs-community-fe.vi.md)

Status: **Proposed**. Labels **[C] [P] [A]**: see
[specs-community-overview.md](specs-community-overview.md). Today's relevant routes
(`src/i18n/routing.ts`): `/community-trips` (`/chuyen-di-cong-dong`), `/my-trips`
(`/chuyen-di-cua-toi`), `/shared/[token]` (`/chia-se/[token]`), `/reviews`
(`/goc-review`), `/admin/community` (`/quan-tri/cong-dong`).

## Goals and scope

Pages, flows, components and states for the Community Platform, mobile first (375 px, then
`md` and `lg`), Vietnamese first, in the warm, minimal magazine voice of the brand. No
code is written by this document.

## Requirements

- **FE1** Server components by default; `'use client'` only for the editor, upload,
  reactions and the notification bell, each with a stated reason. [C]
- **FE2** Every string in `messages/vi.json` and `messages/en.json`, key for key; every
  new route in `pathnames` in both locales. [C]
- **FE3** Tokens only from `@theme` in `src/app/globals.css`; a new token is added there
  and documented in [features/design-system.md](features/design-system.md). [C]
- **FE4** One `<h1>` per page, ordered headings, visible focus, real buttons and links,
  targets ≥44 px, meaningful `alt` (the author supplies it for photos). [C]
- **FE5** No dead control: a control whose backend is not built or whose gate is closed is
  absent or disabled with a neutral explanation and a real link. [C]
- **FE6** A section with no approved content is hidden, not shown empty, and there is no
  fake seed content. [C] (ADR 0014)
- **FE7** User-written text is shown as written, in its own `lang`, as text. [C]

## Design

### Page map

| Page | Internal route | Vietnamese | Phase |
|---|---|---|---|
| Explore (trips, journals, vlogs) | `/community` | `/cong-dong` | Phase 10, 12 |
| Community trips (existing) | `/community-trips` | `/chuyen-di-cong-dong` | exists, filters in Phase 10 |
| Journal detail | `/journals/[slug]` | `/nhat-ky/[slug]` | Phase 12 |
| Public profile | `/travellers/[slug]` | `/nguoi-di/[slug]` | Phase 11 |
| Search | `/search` | `/tim-kiem` | Phase 15 |
| My journals | `/my-journals` | `/nhat-ky-cua-toi` | Phase 12 |
| Journal editor | `/my-journals/[id]` | `/nhat-ky-cua-toi/[id]` | Phase 12 |
| Saved | `/saved` | `/da-luu` | Phase 14 |
| Notifications | `/notifications` | `/thong-bao` | Phase 15 |
| Account preferences | `/account/preferences` | `/tai-khoan/so-thich` | Phase 15 |
| Staff queue (existing, extended) | `/admin/community` | `/quan-tri/cong-dong` | Phase 10+ |

The English paths are internal canonical names; the Vietnamese ones follow today's
convention and are proposals. Routes are added to the sitemap only if public.

### Key flows

**Publish a trip.** On `/my-trips/[id]` two switches: "Share by link" (existing) and
"Publish to community" (opens a short sheet: display name or anonymous, a switch "Allow others to copy this trip" (default per the owner's decision, off recommended), terms link, submit). Status chip: Draft, In review, Needs changes (with the note), Published, Not
accepted (with the reason), Taken down. Editing a published trip warns, before saving, that
it will go back to review. [C]

**Use this trip.** On a community trip card and its detail page a primary button "Use this
trip". Signed out → sign-in, then returns. Result lands on the copy's editor with a banner
"Copied from <title> by <author or nothing>"; the copy is private. [C]

**Write a journal.** Block editor: heading, paragraph, quote, place link; image and video embed blocks arrive in Phase 13. Autosave draft with `If-Match`; image upload with progress and per-image retry;
status panel listing what blocks submission (asset still processing, missing title, no
`lang`). Submit → In review.

**Explore and filter.** Cards with cover, title, author or "Traveller", style and duration.
Filters collapse into a sheet on mobile. "Matches you" sort appears only when preferences
exist and always has "Show all". Empty result explains which filter to relax.

**Moderation queue (staff).** Table on desktop, cards on mobile; preview exactly as readers
will see it, the diff against the last approved revision, actions Approve, Request changes
(note required), Reject (reason required), Take down.

**Report.** A small "Report" control on every public card and comment; a dialog with the
fixed reasons; a confirmation that explains what happens next.

### Components (new, in `src/components/community/`)

`CommunityTripCard`, `JournalCard`, `AuthorLine`, `StatusChip`, `PublishSheet`,
`UseTripButton`, `ReportDialog`, `BlockEditor` (client), `MediaUploader` (client),
`VideoEmbed` (click to load), `FollowButton`, `LikeSaveBar`, `CommentThread`,
`NotificationBell`, `FilterSheet`, `ModerationDiff`. Reuse `src/components/story/story-blocks.tsx`
for reading journals if its block set fits. [A]

### States every page defines

Loading (skeletons, no layout shift), empty, error with retry, offline draft kept,
forbidden (renders as not found for private items), gate closed (neutral notice),
processing (media), conflict (reload prompt on `412`).

### Responsive and accessibility notes

Single column at 375 px; two columns of cards at `md`; three at `lg`. Editor toolbar is
reachable by keyboard and does not hide content under the on-screen keyboard. Dialogs trap
focus and restore it. Status is conveyed by text, not colour alone. Reaction counts are
announced politely. Contrast follows the existing token tests.

## Flows and failure states

| Situation | UI |
|---|---|
| Upload fails | Inline error on the image with retry; the draft keeps working |
| Two tabs edit one journal | `412` → prompt to reload, keep local text copy |
| Source of a copy withdrawn | Banner text stays, link removed, no error |
| Banned user | Write controls replaced by the restriction notice |
| Notification target gone | Shows "No longer available", marks read |

## Dependencies and security

Needs the API in [API](specs-community-api.md) and the media pipeline in
[media](specs-community-media.md). The editor is a new dependency candidate and needs an ADR;
a hand-rolled block editor on contenteditable is a known risk and is not recommended. [P]
Render user content through the block renderer only, per [security](specs-community-security.md).

## Test scenarios

Component tests for each state; keyboard-only path through publish and write; screenshot
checks at 375 / 768 / 1280 via `npm run verify:ui`; `tests/i18n.test.ts` for parity;
`tests/client-boundary.test.ts` for server-only imports; contrast tokens.

## Open questions

| # | Question | Recommended |
|---|---|---|
| 1 | A single `/community` hub or keep `/community-trips` as the front door? | Hub in Phase 12; keep existing route working |
| 2 | Which editor library, given the ADR requirement? | Decide in the Phase 12 ADR |
| 3 | Do authors see who liked or followed? | Counts only in Phase 14 |
