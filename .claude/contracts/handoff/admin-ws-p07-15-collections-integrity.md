# Handoff — P07-15 Collections and Integrity (CORE-4)
- Branch: `claude/admin-collections-integrity-d86ddd` (contract named `feat/admin-collections-integrity`; rename before the PR if the owner wants). PR: none yet. Nothing committed or pushed (owner has not authorised it).
- Done (backend): collections (4 handlers) and travel integrity moved to `adminContentRoute({ content:write, session:true })`; planner integrity passes `{ user:provision, session:true }`; `updateCollection` takes optional `expectedUpdatedAt` and PATCH passes `ifMatchStamp` (Amendment 2, owner "Chọn A"). Templates untouched.
- Done (frontend): pages `/admin/content/collections`, `/collections/[slug]`, `/integrity` (VI `/quan-tri/noi-dung/bo-suu-tap`, `/toan-ven`); search/sort helper in `content-list.tsx` (stories, places, collections); sidebar, routing, return-to, VI/EN messages; planner report shown only when `canUsers`.
- Docs: feature doc + VI twin, README rows, `architecture.*`, `travel-content-api.*`; contract Amendment 2.
- Outside plan: updated 3 stale tests (admin-layout page count 14→17, admin-portal editor sidebar, planner-admin-session integrity now 200 for admin). `place_in_use` left OUT.
- Checks: typecheck PASS; lint PASS (no output); test PASS (99 files, 1245 passed, 89 skipped); build PASS. Smoke UI 375/768/1280: NOT RUN (no admin login; passwords not entered). /qc-check, /sec-check: NOT RUN.
- Risks: collections writable by every editor session (same as stories/places); a trust boundary moved token→session, so `/sec-check` is recommended before merge. If-Match stays optional for token callers.
- Not offered in UI: collection create/delete (API supports; needs confirm pattern).
- Open: commit per role (backend, then frontend/docs) and PR need owner authorisation.
