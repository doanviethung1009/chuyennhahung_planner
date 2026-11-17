# Handoff — PLACES-UI-S2
- Branch: worktree branch `claude/place-reviews-ui-3e42bf` (contract names `feat/place-reviews-ui`; rename before PR). PR: none — not committed or pushed (owner has not authorized).
- Done: `PlaceReviewSection` on `/dia-diem/[slug]` (guest form with fixed place; member form with terms, own review status/held/restriction, edit, delete); session read from `GET /api/planner/session`; page lists 20 newest reviews; `router.refresh()` after send.
- Decisions: 20 newest, no pagination, no API change; success message + refresh.
- Outside the plan: `ReviewForm` guest got optional `fixedPlace`/`onSubmitted`; it now shows the closed notice for reason `contribution_closed` (was the generic "paused" text) — also affects the home form.
- Files: src/components/places/place-review-section.tsx, review-form.tsx, places page, messages vi/en (`communityReviews.placePage`), tests/place-review-section.test.ts, docs places/community-reviews/usage (+vi), backlog, contract state.
- Checks: typecheck PASS · lint PASS · test PASS (86 files passed, 3 skipped; 1130 tests) · build PASS · qc NOT RUN · sec NOT RUN.
- Manual (guest, dev server): 375/768/1280 no horizontal overflow, one h1, no place dropdown, controls ≥44px; GET session answers 401. Signed-in flow NOT checked by hand (no test account); send/edit/delete/401/429 paths not automated (no DOM test env).
- Risks: terms text makes the form long on mobile (existing component behaviour); member flow untested in a browser.
- Next: owner decides commit/PR; recommend `/qc-check` and `/sec-check` (public input + member writes).
