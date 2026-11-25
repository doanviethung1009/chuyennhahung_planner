# Task Contract — place-publish-status (class L)

- **Goal:** a place created in the CMS is a draft; only published places are public. Decision: ADR 0035.
- **Scope IN:** `Place.status`/`publishedAt`, repository lifecycle + guards, public read filters, Planner new-reference check, status endpoint, PostgreSQL migration 0017, admin editor/list controls, VI/EN messages, docs.
- **Scope OUT:** audit-log events for places, guards from collections/templates/content reviews, planner integrity changes.
- **Evidence:** `src/server/content/{schemas,repository,public-places,public}.ts`, `src/server/community/public.ts`, `src/server/planner/repository.ts`, `src/server/persistence/content-rows.ts`.
- **Acceptance:** typecheck, lint, test pass; admin POST returns draft; public 404 until published; story publish/unpublish guards.
- **Risks:** leaking a draft through a missed reader; migration not applied before deploy (reads would fail on the missing column).
- **Owners:** architect (ADR, contract), backend (schema, repository, routes, migration), frontend (editor, list, messages); docs by the shipper.
- **Rollback:** revert the PR; `db/rollback/0017_place_status.sql` after publishing or deleting drafts.
- **Budget:** subagents 0. **State:** implemented, awaiting review.
