# Handoff — batch 10.6b guest-key privacy (P10-11, ADR 0024)
Branch worktree `claude/guest-key-hmac-15a3bd` (target name `feat/guest-key-hmac`); nothing committed/pushed. Single agent, 0 subagents.

## Done
- `src/server/community/guest-key.ts`: `guestKeyOf(secret, client)` = HMAC-SHA256 hex[0..32]; `limiterKeyOf`; `readGuestKeySecret`. **Env `GUEST_KEY_SECRET`**, ≥32 chars; missing/short → `503 service_unavailable` (message names the variable only).
- Repository (`planner/repository.ts`): option `guestKeySecret`; guest review/report resolve the key first (fail closed, nothing written; member reports need no secret); old local `guestKeyOf` removed. `sweepGuestKeysIn` runs in createGuestReview/createReport/createRestriction/liftRestriction: clears review/report keys at ≥30 days (batch 500/collection), guest restriction key on end (expired → `liftedAt`=now, `liftedBy`=`key expired`; lift clears key at once).
- `postgres-rate-limiter.ts`: counter key = HMAC (secret option, default env). `counterKey(secret,name,key)` signature changed. Caveat: on PostgreSQL every limited write (incl. member planner review) is 503 without the secret.
- `GUEST_RESTRICTION_MAX_DAYS` 90→30; zod `reviewRestrictionSchema` refine (null key only when `liftedAt` set).
- Migration `0014_guest_key_privacy.sql` + rollback: clears all keys, lifts live guest restrictions (`privacy migration`; expired → `key expired`), replaces 0008 CHECK. **Key clearing is irreversible; rollback only restores the CHECK (placeholder `cleared`).**
- `deploy/compose.app.yml` passes `GUEST_KEY_SECRET` through (needed or the container never sees it). Docs EN+VI: usage, reviews/reports/limiter features, architecture, specs-security/-database, project-context, backlog.

## Tests / fixture changes
New: `guest-key.test.ts`, `guest-key-cases.ts` (memory + PG), `guest-key-routes.test.ts`, limiter case in `postgres-rate-limiter.test.ts`, PG migration cases (empty DB via beforeAll; data DB in a scratch schema). Changed: `counterKey` call in `postgres-rate-limiter.test.ts`; `vitest.config.ts` + `tests/setup-env.ts` set a test secret (no other existing test edited).

## Checks
typecheck PASS · lint PASS · test PASS 1140/1140 with local PostgreSQL 14 (`TEST_DATABASE_URL`); without it 1069 pass, 71 PG cases skipped (NOT RUN).

## QC: PASS (all listed criteria covered by tests above, incl. 30d−1ms vs 30d, 503 no-write, 30-day cap). Security: PASS_WITH_WARNINGS
Evidence: no `createHash` of an address left in `src/server` (only share-token, Google PKCE, migration checksum); secret never logged/returned (guest-key.ts message); SQL parameterised; migration idempotent-safe DO block. Warnings: forwarded-header spoofing unchanged (P10-12/D10); nginx logs keep raw IPs; 'unknown' key check no longer matches pre-rotation keys. NOT VERIFIED: real VM/nginx, `/sec-check` independent run, `deploy/.env.example` (denied to me — add `GUEST_KEY_SECRET=` there).

## Owner TODO
Provision `GUEST_KEY_SECRET` (`openssl rand -base64 36`) in the VM stack `.env` BEFORE deploy, else guest reviews/reports and PG limiters return 503. Privacy Policy page and staff removal of a guest review remain separate tasks.
