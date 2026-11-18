# Handoff — P07-12 Users & roles (CORE-2)
- Branch `feat/admin-users-roles` (renamed from the worktree branch) · PR: none, nothing committed (awaiting owner).
- Done: `/admin/users/roles` read-only matrix (props from `ROLE_ACTIONS`/`canManageRole`, passed by the server page); *Rotate token* and *Unlink Google* in the user table with existing confirm + `SecretPanel`; `limit`/`cursor`/`sort` on `GET /users` (keyset, `total`+`nextCursor`; unchanged with no query); UI loads 50 + *Load more*.
- `repository.ts` NOT touched: paging slices `listUsers()` in `src/server/planner/user-page.ts`; role check in `src/server/planner/manage-user.ts`.
- Outside the plan: the two credential routes now accept the session cookie (`user:provision`) and pass the actor, so existing audit rows name the admin; new helper files above; `tests/planner-admin-session.test.ts` (pinned them token-only) and `tests/admin-layout.test.ts` (page count 13→14) updated; sidebar not changed (link from users page).
- Checks: typecheck PASS · lint PASS · test PASS (92 files, 1176 tests; 3 PG integration skipped) · build PASS · browser smoke 375/768/1280 NOT RUN · /qc-check NOT RUN · /sec-check NOT RUN (recommended: credential surface).
- Risks: role check is in the route, not the repository (narrow race); filters cover loaded rows only; paging bounds the response, not the repo read.
- Open: owner decides commit/PR; whether to move the `canManageRole` check into the repository later (Phase 10 shared file).
- Next: CORE-3 per `core-completion-index.md`.
