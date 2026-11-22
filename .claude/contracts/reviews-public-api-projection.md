# Task Contract: REVIEWS-API-PROJ — `GET /api/travel/reviews` returns an allow-list
- Class: M (one route, one JSON shape change, owner decision needed first) · Proposed branch `fix/reviews-public-api-projection`, cut from the latest `main`. Origin: D3 of STORY-API-PROJ (#221), /sec-check W3. Same leak class as places (ADR 0026), story pages (#187, #218) and the stories API (#221).
- Outcome: the public reviews endpoint serves the same `PublicReview` allow-list as the story page (`toPublicReview`, `src/server/content/public.ts:37`), so one projection feeds both.

## Evidence (read, not yet run)
- `src/app/api/travel/reviews/route.ts:11-12`: `repository.listReviews({ ...query, status: 'published' })` returned as is. Status is forced after the spread, so a caller cannot ask for drafts.
- The stored `TravelReview` (`schemas.ts:370-405`) adds, beyond the 7 allowed fields: `status`, `publishedAt`, `createdAt`, `updatedAt`, `subject` (kind + slug), `costVnd`, `author` (brand voice, ADR 0001).
- No repo consumer of the endpoint: grep of `src`, `e2e`, `tests` finds none; documented in `docs/travel-content-api.md` (public table) and `docs/runbook.md:56` ("List published reviews"). An external client may exist.
- Only the list route exists (no `/[id]`); `listReviews` sorts by `visitedOn` and has no subject filter, so the API gives a client no way to tell what a review is about except `subject`.

## Owner decisions needed before code
- E1 Shape: **(a) exactly `PublicReview`** (default): `id`, `title`, `rating`, `visitedOn`, `body`, `pros`, `cons`. One projection, one test pattern; but a client cannot tell which place or destination a review is for. **(b)** `PublicReview` plus `subject` (kind and slug only, already public) and `publishedAt` — widens the shared type, so the story page payload also gains them.
- E2 `author` and `costVnd` stay out in both options (owner decision on #218; `costVnd` follows the same rule). Confirm.
- E3 Also audit in this PR, or separately? **Separate** (default). Read-only evidence for that follow-up: `GET /api/travel/collections*` returns the stored collection (`status`, `createdAt`); `GET /api/travel/templates*` returns the stored `TravelTemplate` including `sourceSnapshot` (carries `actualCostTotalVnd`, which #221 removed from the stories API), `version`, `createdAt`, `updatedAt`, `sourceStorySlug`. Public template pages use `public-templates.ts`; not checked whether it projects.

## Plan (if E1a)
- `src/app/api/travel/reviews/route.ts`: map the list through `toPublicReview`. If E1b, extend `PublicReview`/`toPublicReview` first and its test on the story page.
- Tests (`tests/travel-content-api.test.ts`): publish a review with `costVnd` and `author`; list returns exactly the allowed keys; JSON matches none of `status|publishedAt|createdAt|updatedAt|subject|costVnd|author` and the cost value; a draft review is absent; `?status=draft` cannot widen the list.
- Docs EN + VI: `docs/travel-content-api.md` and `.vi.md` (public shape paragraph; replace the "still returns the stored review" sentence added by #221), `docs/runbook.md` and `.vi.md` only if the row text changes.
- Scope OUT: admin review routes (full record stays), schemas, story page markup, collections and templates (E3), `personalNote` (W2).
- Risks: external client of the old JSON breaks — state it in the PR. Rollback: revert.
- Done when `typecheck`, `lint`, `test`, `build` pass with output stated; `/sec-check` recommended, `/qc-check` NOT RUN unless requested. Handoff ≤25 lines in `.claude/contracts/handoff/`.
- Budget: single agent, subagents 0. State: IMPLEMENTED on branch, not committed. Owner decisions: E1a (exactly PublicReview), E2 (author and costVnd stay out), E3 (collections and templates separate). No backlog ID assigned
