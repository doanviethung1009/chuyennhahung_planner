# Handoff — batch 10.6a Security hardening (P10-15, P10-16, P10-12)
Branch `fix/community-hardening` (worktree branch name may differ; nothing committed/pushed). Contract: `phase10-10-6-security-hardening.md`.

## Done
- **P10-15 closed:** `src/server/community/contribution-gate.ts` `requireContributionOpen(open = contributionOpen)`; first call in `PUT planner/[id]/listing`, `PUT planner/reviews/[placeSlug]`, `POST community/reviews` → `403 forbidden`, reason `contribution_closed`, before limiter/body. DELETE/withdraw, reads and `POST community/reports` stay open.
- **P10-16 closed:** `src/server/community/reserved-names.ts` (one list, NFD + đ folding, whole-word match; long phrases also matched run together); `guestReviewInputSchema.authorName` refine → path `authorName`. NOTE: this API maps `validation_failed` to **422**, not 400 — kept the existing mapping. "Hưng" alone allowed. Planner `authorDisplay` not filtered.
- **P10-12:** pinned in `tests/community-hardening.test.ts` (nginx conf overwrites XFF → forged value cannot choose key; rotating forged header behind proxy still hits 429; without proxy first hop is client's claim). Global hourly cap evaluated, **not added** (DoS on honest visitors; decision in feature doc Limits). OPEN: real VM / Cloudflare Tunnel check (owner, D10).
- Docs: community-reviews/-reports Limits, specs-community-security status, architecture, project-context, backlog (EN+VI twins).

## Changes to existing tests/fixtures
None. Shared files touched: `src/server/planner/schemas.ts` (import + one refine). No migration, no new route, no new env.

## Not done / for 10.6b
- P10-11 HMAC `guestKey`: blocked on D4; `guestKeyOf` in repository.ts unchanged.
- qc / security: NOT RUN (recommend `/sec-check` after 10.6b).
