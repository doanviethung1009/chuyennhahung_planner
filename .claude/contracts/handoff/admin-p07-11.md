# Handoff — P07-11 Admin dashboard
- Task: P07-11 · Branch `feat/admin-dashboard` · PR #121 (not merged; contract stays READY until merge)
- Done: `src/server/admin/overview.ts` (`buildOverview`, injectable sources, `loadOverview`); `GET /api/admin/overview` (`adminContentRoute`, `content:write`, session or service, `no-store`); `OverviewCards` server component; `/admin` shows cards; VI/EN keys; docs (`features/admin-dashboard.*`, README rows, runbook route row, architecture paragraph).
- Cards (fixed enum): listingsPending, reviewsPending (`community:moderate`) · contentDrafts (`content:write`) · usersActive, usersDisabled (`user:provision`) · runtime (`runbook:read`, super admin only).
- Owner decisions applied (review of 2026-11-17):
  1. `state` ∈ {`ok`,`unavailable`}; `detail` ∈ {`postgres`,`file`,`mixed`} (runtime card only); thrown messages never reach the payload; documented in the feature doc; tested per role.
  2. Integrity card removed (no card, id, source or message); integrity routes and authorization untouched; waits for P07-15.
  3. Drafts label "Drafts (stories and reviews)" / "Bản nháp (chuyến đi và đánh giá)"; places not counted.
  4. `listReviewQueue` caps at 200 and has no total method: a count ≥ 200 carries `atLeast: true` and shows "200+" with a note; no repository change.
- Activity card omitted: `/api/admin/community/events` needs a `targetId`; waits for P07-13.
- Migration: none. API/DB/RBAC: one new read-only route; `permissions.ts` untouched.
- Tests: typecheck PASS · lint PASS · `npm run test` PASS (73 files, 978 passed, 48 skipped) · `npm run build` PASS (before the last edit; not re-run). PostgreSQL store: NOT RUN (repository methods only).
- Role matrix (tests): anonymous 401, member 403, editor 3 cards, admin 5, service 5 (no runtime). Real check on the dev server as super admin: 6 cards, `no-store` route, payload ids/counts/links only.
- Responsive (dev server, super admin, local test accounts on a scratch store, since removed): 375px one column, 768px, 1280px three columns; no horizontal overflow; one `<h1>`; link targets 44px.
- Checklist (self-run inline, **not** the independent agents): QC — acceptance items, VI/EN parity, docs twins, one `<h1>`, empty and degraded states PASS; Security — same helpers as other admin routes, `no-store`, no secret/email/handle/exception text in payload, same-origin cookie check inherited from `resolveAdminPrincipal`, no new write path PASS. `qc` and `security` agents: NOT RUN.
- Risk: user counts read the whole user list (as the user console already does).
- Next: P07-12 (users & roles); P07-15 may add the integrity card back.
