# Handoff — PLACES-UI-S1 (Public Places UI)
- Branch: `claude/public-places-ui-8348b9` (contract says `feat/public-places-ui`; rename before PR). PR: none (not authorised). Nothing committed.
## Done
- Route `/places/[slug]` (VI `/dia-diem/[slug]`, EN `/en/places/[slug]`) with metadata, canonical, JSON-LD, read-only `ReviewList`; "Địa điểm" section on `/destinations/[slug]`; sitemap entries.
- `src/server/content/public-places.ts` (allow-list read), `place-card.tsx`, `lib/place-format.ts`, `places` messages VI+EN.
- ADR 0026 (+vi, README), `docs/features/places(.vi).md` (+README), architecture, usage, backlog row `PLACES-UI-S1`, `tests/places-page.test.ts` (7 tests).
## Outside the plan
- Copied both S1/S2 contract files into `.claude/contracts/` (they were missing in this worktree).
- `src/lib/place-format.ts`: VI cost under 1M đ is written in full (`formatVnd` would give "0,1 triệu đ").
## Checks
- typecheck PASS · lint PASS · test PASS (85 files passed, 3 skipped; 1124 passed, 84 skipped) · build PASS.
- Manual: 375 and 768 checked (no overflow, one h1, ordered headings, canonical right), 1280 destination section seen; unknown slug → 404.
- /qc-check, /sec-check: NOT RUN (recommended: sec-check not needed beyond read-only public data; qc-check optional).
## Risks / open
- Image alt is generic (schema has no per-image alt). Seed places are public as they are; owner to confirm content.
- Hover/focus and ≥44px: card CTA and back link use min-h-11; not measured by script.
## Next
- Owner: authorise commit, rename branch to `feat/public-places-ui`, open PR. Then S2.
