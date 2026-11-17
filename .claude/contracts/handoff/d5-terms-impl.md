# Handoff — D5 Creator Terms v2 (impl)
Branch: docs/creator-terms-v2 · Class M · single agent · no migration.
Done:
- `src/content/site.ts`: `contribution.terms` VI+EN replaced with approved 8-article text (draft §2/§3, spliced verbatim); `takedownContact` kept; stale image/video comment removed; `termsVersion` 2026-11-16 → 2026-11-18.
- `tests/terms-version.test.ts`: PINNED = 2026-11-18 / d552c7cf…bb7f2.
- `docs/features/creator-terms.{md,vi.md}`: Summary (open item removed), changelog table (old row 3b8eed26…), Limits.
- Not touched: messages/*, repository, schema, migrations, ADRs.
Render check: share-panel.tsx:201 and review-form.tsx:113 use `whitespace-pre-line`, no max-height/overflow, so the longer text just grows the block (VI and EN same path). Not visually checked in a browser (NOT RUN). Possible follow-up: collapsible/scrollable terms box.
Checks: typecheck PASS · lint PASS · test PASS (84 files passed, 3 skipped; 1097 passed, 78 skipped).
qc / security: NOT RUN (not requested).
OWNER GATES (open): (a) git tag `terms-2026-11-16` on old text — not created by me; confirm it exists. (b) lawyer read of Art. 3 last sentence, 4.4, 4.6, 5.3 — unconfirmed; DO NOT MERGE until confirmed.
Deploy: merge to main auto-deploys dev VM; every member must re-accept (403 terms_not_accepted) before listing request / Planner review.
If merge slips past 2026-11-18, consider re-dating termsVersion + PINNED (hash unchanged).
