# Feature — Admin content CMS

🇻🇳 Bản tiếng Việt: [admin-content-cms.vi.md](admin-content-cms.vi.md)

## Summary

Editors and admins edit stories, places and reviews in the browser, with the Vietnamese and English text side by side, and publish, unpublish or archive stories and moderate reviews, without `curl` or a token. Design: [ADR 0011](../adr/0011-admin-content-cms.md). It builds on the shell in [admin-portal.md](admin-portal.md). Published edits reach the public pages on the next request ([public-travel-cms.md](public-travel-cms.md), ADR 0012); drafts and archived records stay off the public site.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/stories` | `/quan-tri/noi-dung/chuyen-di` | `/en/admin/content/stories` |
| `/admin/content/stories/[slug]` | `/quan-tri/noi-dung/chuyen-di/[slug]` | `/en/admin/content/stories/[slug]` |
| `/admin/content/places` | `/quan-tri/noi-dung/dia-diem` | `/en/admin/content/places` |
| `/admin/content/places/[slug]` | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `/admin/content/reviews` | `/quan-tri/noi-dung/danh-gia` | `/en/admin/content/reviews` |

Reviews are edited inline in the moderation queue, so there is no per-review page. All routes sit under the existing admin prefixes, so `robots.ts` and the `X-Robots-Tag` rule already cover them; each page also sets `noindex` and none is in the sitemap.

## Data

Reads and writes `/api/admin/travel/{stories,places,reviews}` (lists return `{ stories|places|reviews, count }`, drafts and archived included, `?status=` filter) and the per-record `GET`/`PATCH`. Every record carries `updatedAt`. Status changes use `POST .../stories/[slug]/status` and `.../reviews/[id]/status` with `{ action }`. Error envelope: `{ error: { code, message, issues: [{ path, message }] } }`. Message namespaces: `adminContent` and `admin`.

Editable fields follow `storyUpdateSchema`, `placeUpdateSchema` and `reviewUpdateSchema`. Every `{ vi, en }` field is a fieldset with a legend and two labelled inputs. Not editable here: story cost breakdown, linked places and reviews, place affiliate links, adding or reordering story blocks, creating or deleting records.

## How it works

Each page is a server component: `requireStaff` (`src/lib/admin-gate.ts`, built on `readStaffPageAccess`) sends anonymous visitors to sign-in with `returnTo`, a temporary password to change-password, and a role with nothing to do here to `notFound()`. The shell nav is one flat row of links: Users only if the role can `user:provision`, Stories, Places, Reviews and Community only if it can `content:write` (there is no separate "Content" label); the API remains the authority. The page then renders one client island that fetches with same-origin `fetch`, so there is one mutation path.

Saving sends only the editable keys with `If-Match: "<updatedAt>"`. A stale stamp returns **412** `version_conflict`: the screen says someone else saved first and offers a reload. A 422 marks each field whose dotted `path` appears in `issues`. 401 offers sign-in again, 429 shows the wait. Buttons are disabled while a request is pending, and results are announced in a polite live region.

## Files

| Path | Role |
|---|---|
| `src/app/(admin)/[locale]/admin/page.tsx` | Shell: gate, Users for admins, overview for editors |
| `src/app/(admin)/[locale]/admin/content/**/page.tsx` | Five content pages |
| `src/lib/admin-gate.ts` | Shared gate and `noindex` helper |
| `src/components/admin/admin-nav.tsx`, `content-notice.tsx` | Role-aware nav; public-site limitation notice |
| `src/components/admin/content/form-kit.tsx` | Path-addressed fields, localized pairs |
| `src/components/admin/content/use-record.ts` | Load, draft, `If-Match` save, status action, error mapping |
| `src/components/admin/content/record-shell.tsx`, `story-editor.tsx`, `place-editor.tsx` | Edit pages |
| `src/components/admin/content/content-list.tsx`, `review-queue.tsx`, `notices.tsx` | Lists, moderation, shared UI |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Routes and `returnTo` allow-list |
| `messages/vi.json`, `messages/en.json` | `adminContent`, `admin` |

## Tests

`tests/routing.test.ts` pins the new localized paths; `tests/return-to.test.ts` the allow-list; `tests/i18n.test.ts` key parity; `tests/client-boundary.test.ts` that no client file imports server code. The API guard, roles and `If-Match` are covered by `tests/admin-content-session.test.ts` (backend). Not tested: the editors' interactions in a browser (no DOM test runner).

## Limits and open questions

- Public pages still read `src/content/**`; edits are not visible publicly, and no refresh interval is promised.
- No create, delete, template, collection or integrity screens; no audit log, so edits are unattributed.
- Story blocks can be edited but not added, removed or reordered.
- `If-Match` is optional for token callers, so `curl` can still overwrite.
- Editors have no sign-out button on the overview page yet.
