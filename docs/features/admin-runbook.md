# Feature — Admin runbook tab

🇻🇳 Bản tiếng Việt: [admin-runbook.vi.md](admin-runbook.vi.md)

## Summary

A **Runbook** tab in the admin area where an administrator reads the API list and
the operations guides in the browser, without repository access. It is for the
`admin` role only: an editor or any other signed-in user gets a `404`, an
anonymous visitor is sent to sign-in and back. The content is the repository's own
documents, so it cannot drift from what is deployed. Research result that led to
it: before this change there was no API list at all (only the Travel Content
contract in [../travel-content-api.md](../travel-content-api.md)), so
[../runbook.md](../runbook.md) was added.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/runbook` | `/quan-tri/runbook` | `/en/admin/runbook` |

`?doc=<id>` picks a document; an unknown id falls back to the overview. Covered by
the existing `/quan-tri/:path*` and `/en/admin/:path*` no-index headers and the
`robots.txt` disallow.

## Data

- Reads Markdown from `docs/`, never from the request: the closed allow-list `RUNBOOK_DOCS` in `src/server/runbook/docs.ts` (`runbook`, `deploy-runbook`, `deploy-operations`, `deploy-database`, `deploy-runner`, `runbook-api`, `runbook-google-sign-in`, `architecture`, `usage`, `travel-content-api`). Vietnamese locale reads the `.vi.md` twin.
- No credential or secret is read or shown; the documents describe secrets by name only.
- Messages: the `adminRunbook` namespace and `adminContent.nav.runbook` in `messages/vi.json` and `messages/en.json`.

## How it works

1. `src/app/[locale]/admin/runbook/page.tsx` calls `requireStaff(..., 'users')`: anonymous redirects to sign-in with `returnTo`, a temporary password redirects to change-password, any role without `user:provision` gets `notFound()`. The page is `force-dynamic` and `noindex`.
2. `readRunbookDoc` reads `docs/<id>[.vi].md` from `process.cwd()`. The Docker runner stage copies `docs/` to `/app/docs` for this.
3. `src/components/runbook/markdown.tsx` parses the Markdown into React elements (no HTML strings, no `dangerouslySetInnerHTML`). A link is kept only if it is `http(s)` or another allow-listed runbook; anything else is plain text. A document's `#` renders as `h2` because the page owns the one `<h1>`.
4. `AdminNav` shows the tab only when the viewer can manage users. Hiding is not authorization: the page gate checks again.
5. [../runbook.md](../runbook.md) lists every route handler; `tests/runbook.test.ts` fails if the table and `src/app/api/**/route.ts` disagree.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/admin/runbook/page.tsx` | Gate, document tabs, article |
| `src/server/runbook/docs.ts` | Allow-list and file read |
| `src/components/runbook/markdown.tsx` | Safe Markdown renderer |
| `src/components/admin/admin-nav.tsx` | Runbook link for admins |
| `src/i18n/routing.ts`, `messages/*.json` | Route and strings |
| `docs/runbook.md`, `docs/runbook.vi.md` | Overview and API list |
| `Dockerfile` | Copies `docs/` into the runner image |
| `tests/runbook.test.ts` | Tests below |

## Tests

`tests/runbook.test.ts` asserts that every route file and method appears in the API
table (and nothing extra), that the allow-listed documents exist in both languages,
the route entry, the admin-only nav link, and the renderer (tables, code, link
filtering, no raw HTML). Not tested: the page gate in a browser; it reuses
`requireStaff`, covered by the admin session tests.

## Limits and open questions

- Documents refresh with a deploy (the image carries a copy), not live.
- In-page `#anchor` links render as text; there is no table of contents.
- The API table's "Who may call" column is maintained by hand; only paths and methods are checked.
- The Mermaid diagrams in some documents show as code blocks.
