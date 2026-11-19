# Core Completion — Task Contract Index
- Created: 2026-11-18, on `main` @ `bb3a026`. Role: system-architect (main session, Single-Agent First, sub-agents 0). Nothing here changes code, a Phase ID or a task ID; no new Phase.
- Owner decision (2026-11-18): finish the core first (UI, API, database, CMS, data, end-to-end flows). DEFERRED: AI Planner, Affiliate, Analytics (Phase 06, P08-4), Social Engagement (Phase 14), Vlog (Phase 13). P10-7 backup and D5 Terms stay in Phase 09.
- Owner approved the proposed order and the six decisions below on 2026-11-18, and five more (7–11) later the same day.
- Revised 2026-11-18 on `main` @ `d942aee` (CORE-0 merged as PR #163; PR #162 is the only open PR).
- `CORE-n` and `WEB-n` are session labels for this index only, not backlog IDs. Each maps to a task ID: an existing one, or one the owner approved (PLACES-UI-S6) or that is proposed below (P04-4, owner confirms the ID).

## Order (one contract = one session = one branch = one PR; start each with `.claude/templates/UNIVERSAL_TASK_EXECUTION.md`)
| Session | Maps to | Contract | State | Gate |
|---|---|---|---|---|
| CORE-0 | roadmap sync (docs only) | this file, section CORE-0 | **DONE** (PR #163 merged) | — |
| CORE-1 | P07-17 System status | [admin-ws-p07-17-system-status.md](admin-ws-p07-17-system-status.md) | **DONE** (PR #162) | owner merges #162 |
| CORE-2 | P07-12 Users & roles | [admin-ws-p07-12-users-roles.md](admin-ws-p07-12-users-roles.md) | **DONE** (PR #165) | repository cursor method needs architect stop-and-ask |
| CORE-3 | P07-14 Moderation workspace | [admin-ws-p07-14-moderation-workspace.md](admin-ws-p07-14-moderation-workspace.md) | **DONE** (PR #166) | none |
| CORE-4 | P07-15 Collections + Integrity | [admin-ws-p07-15-collections-integrity.md](admin-ws-p07-15-collections-integrity.md) | **DONE** (PR #168; collection DELETE token-only by owner decision) | amend the contract first: handlers move to `adminContentRoute`, class becomes L (`/sec-check` recommended); **plus the `place_in_use` amendment below (decision 11) — owner approves the amended contract before any code** |
| CORE-5 | P07-6 Template CMS | [admin-ws-p07-6-template-cms.md](admin-ws-p07-6-template-cms.md) | **DONE** (PR #169, #170) | W11 and W4 decided; CORE-4 merged (PR #168); template DELETE and POST stay token-only |
| CORE-6 | UI tests for community components | this file, section CORE-6 | **DONE** (PR #167; ADR 0027, jsdom + Testing Library) | decision 9: jsdom + Testing Library as dev dependencies; ADR/doc note; the section's "open question" is answered |
| CORE-7 | P04-2 `/plan-your-trip` | [plan-your-trip-planner.md](plan-your-trip-planner.md) | DONE (PR #172, 2026-11-19) | decided 2026-11-18: link into the Planner, keep the contact routes; targets are `/stories` (story pages lead to `/trip-setup/[template]`; itinerary pages do not) and `/my-trips/new` |
| WEB-1 | **PLACES-UI-S6** `/places` list + search + filter | none yet — contract to write | owner approved 2026-11-18 (decision 7) | after CORE-5 (shared `routing.ts`, `messages`, `sitemap.ts`); needs the `q` API change (decision 8) |
| WEB-2 | **P04-4** user-facing template list | none yet — contract to write | owner approved the session and the ID P04-4 (decision 10, 2026-11-18) | after WEB-1 (`routing.ts`, `messages`, `sitemap.ts`); not CORE-5 (admin CMS) |
| WEB-3 | Playwright E2E (smoke of the core flows) — maps to the E2E part of CORE-8 | none yet — contract to write | owner approved Playwright (decision 9) | after WEB-1, WEB-2 and CORE-7; own PR, separate from CORE-6 |
| CORE-8 | end-to-end smoke + `/qc-check` + `/sec-check` | none yet | after the above (WEB-3 provides the automated part) | user calls the reviews |

Dependency order (no two sessions edit shared files at once): CORE-0 ✔ → CORE-1 (#162) → CORE-2 → CORE-3 → CORE-6 → CORE-4 (with `place_in_use`) → CORE-5 → WEB-1 → WEB-2 → CORE-7 → WEB-3 → CORE-8. CORE-7 follows WEB-2 because both touch `messages/*.json` and the planner entry pages.
Avoid conflicts: CORE-3 edits `src/components/admin/community/**`, CORE-6 adds tests for the same components — run CORE-6 after CORE-3. CORE-2, CORE-3, CORE-4 each touch `src/i18n/routing.ts` and `messages/*.json` — merge one at a time. Before each session starts, re-check `gh pr list --state open` and `git branch -a`; a session whose files overlap an open PR waits. Do not edit the contract of a session that is DONE.

## Owner decisions (2026-11-18)
1. **W11 approved:** collections, integrity and templates handlers move to session access via `adminContentRoute` (done inside CORE-4; amend its contract first).
2. **W4:** no template version history; `If-Match` against overwrite only.
3. **P04-2:** `/plan-your-trip` links into `/trip-setup` and keeps the contact routes.
4. **PLACES-UI-S4 = the audit log UI**, i.e. P07-13 (merged, PR #157). It is not a missing row: CORE-0 fixes S5's dependency wording to point at P07-13.
5. **Phase 11 kept; Phase 12 and 15 DEFERRED** (as proposed). Phase 06, 13, 14 and P08-4 DEFERRED.
6. **Phase 08:** P08-1..3 and P07-18 DEFERRED until the owner supplies real photos (P09-3); P08-4 DEFERRED. Phase IDs and scope stay unchanged; only status and reason are recorded, with date.

7. **PLACES-UI-S6 approved** (2026-11-18): own session for the `/places` list. No new Phase. Contract S1 (DONE) is not edited.
8. **Server-side search approved:** add an optional `q` to the places list API, backward-compatible (omitted `q` = today's behaviour). Search runs before pagination (`limit`/`offset`); `q` is trimmed, length-bounded, and treated as data (no wildcard injection into the store). The exact bound and the matched fields (name vi/en, location, category) are fixed in the S6 contract, not here.
9. **Test infrastructure approved:** CORE-6 = jsdom + Testing Library (dev dependencies, component tests only, vitest keeps `node` as the default environment). WEB-3 = Playwright, a **separate PR**. E2E never uses the production database: a throwaway local/CI Postgres or the JSON store, seeded by the test run itself.
10. **User-facing template list approved** as its own session (WEB-2). Cross-check done: Phase 02 (content system) is Done and only exposes templates through `api/travel/templates`; Phase 05 (Done 2026-11-16) built `/trip-setup/[template]` and the story CTA, with no list page; P07-6/CORE-5 is the admin CMS; P04-2/CORE-7 is `/plan-your-trip`. **No existing ID covers a list page**, so **P04-4** is proposed (Phase 04 is still open; Phase 05 stays closed). Owner confirmed the ID P04-4 on 2026-11-18. Only public, non-withdrawn templates are listed.
11. **Referenced places cannot be deleted** (amendment to CORE-4, below).

## Amendment to CORE-4 — `place_in_use` (decision 11; **owner approved the design 2026-11-18**; the CORE-4 session writes it into that contract and shows it to the owner before any code)
Evidence (read from `main` @ `d942aee`): `deletePlace` (`src/server/content/repository.ts:222-245`) already refuses while a story, collection, template or editorial review references the place, but answers **`invalid_state`** (HTTP 409, `errors.ts:35`) with a free-text message. It cannot see Planner data: dependency direction is admin → planner → content, and Planner may be a different database. So `trip_activities.place_slug` and `community_reviews.place_slug` are not checked today.
Approved change (nothing coded yet):
- New error code **`place_in_use`** → HTTP **409**, body lists usage counts per kind (`stories`, `collections`, `templates`, `contentReviews`, `tripActivities`, `communityReviews`), no user identifiers, no trip ids.
- Content-side references keep being checked in the repository transaction (code changes from `invalid_state` to `place_in_use`).
- Planner-side counts come from a new read-only method on the Planner repository, called by the admin `DELETE` handler **before** `deletePlace` (the admin layer may depend on both). Counts all rows, any `community_reviews.status` (a removed or pending review still names the place) and archived trips.
- **No cascade, no rewrite** of user data. The way out is: archive/replace the references, or leave the place.
- Known limit: the two checks are not one atomic transaction when the stores are separate; a trip adding the place between check and delete is possible. Accepted; the integrity report (`/api/admin/planner/integrity`, "unknown place") is the backstop. Stated in the contract.
- Tests: each referrer kind blocks with `place_in_use` and the right count; unreferenced place still deletes (204); Planner store error → fails closed (no delete); no user ids in the body. Update docs/runbook error table and the admin places UI message (VI+EN).
- Class stays L; `/sec-check` recommended (authorisation of the count, information disclosure).
- Files added to CORE-4 ownership: `src/server/content/errors.ts`, `src/server/content/repository.ts` (delete only), `src/server/planner/repository.ts` (one read method), `src/app/api/admin/travel/places/[slug]/route.ts`, admin places UI delete error text, `messages/*.json`, tests. CORE-2 also edits `planner/repository.ts`, which is why CORE-4 stays after CORE-2.

Every code session ends with `/qc-check` and `/sec-check` **as the owner calls them** (rule: never part of the flow). Until then each is reported NOT RUN. No session merges itself.

---

# Task Contract: CORE-0 Roadmap sync
- Class: S
- Desired outcome / user impact: `CURRENT.md`, `PHASES.md`, `backlog.md` and contract `State:` lines match `main`, and record the owner's core-first decision.
- Scope IN / OUT: IN — mark P07-13 Done (merged #157); fix "ADR 0025 PR #141 not merged" (merged, ADR still Proposed); add Places UI S1/S2/S3/S5 as merged (#152, #153, #155, #159) and update their contract States; fix the stale "blocked until 10.5" line in P07-14; mark Phase 06, 13, 14 and P08-4 DEFERRED with date and reason; set the next-step list in `CURRENT.md` to the order above. OUT — new Phase IDs, renumbering, deleting content, touching P10-7 / D5 / P09-7 (stay Phase 09), any code.
- Evidence: `git log origin/main`, PRs #152–#160, contract `State:` lines, this index.
- Constraints / dependencies: after PR #160 merges; all wording follows the owner decisions above; status changes need evidence (PHASES rule 4).
- Architecture decision / ADR (if needed): none.
- Interface contract (API, types, DB): none.
- Tasks by owner: Architect only.
- File ownership (avoid parallel overlap): `.claude/roadmap/*`, `.claude/contracts/*` State lines only.
- Acceptance criteria / tests: every changed status cites a PR or file; `tests/docs.test.ts` still passes; `typecheck`, `lint`, `test` output stated.
- Security and migration risks: none.
- Rollback approach: revert PR.
- Budget: sub-agents 0.
- State: READY (after #160)
- Feature document owner: none.
- Architecture/usage doc updates needed: none.

---

# Task Contract: CORE-6 UI tests for community components
- Class: M
- Desired outcome / user impact: the report button, Terms acceptance and report queue are covered by tests, closing QC F3, plus a route-level test for the `guest_limit` event.
- Scope IN / OUT: IN — tests for `src/components/reports/*`, `src/components/planner/terms-accept.tsx`, `src/components/admin/community/report-queue.tsx` (pure helpers extracted only if needed), and a `guest_limit` route test. OUT — behaviour changes, new API, a UI-test framework other than the approved one (decision 9: `jsdom` + Testing Library, dev dependencies, owner approved 2026-11-18) (vitest currently runs `environment: 'node'`, `tests/**/*.test.ts` only).
- Evidence: `vitest.config.ts`; backlog Phase 10 "QC F2–F4"; `tests/community-reports-routes.test.ts`, `tests/review-limiter-routes.test.ts`.
- Constraints / dependencies: after CORE-3 (same component folder). Answered by decision 9: add the DOM test environment (`jsdom` + Testing Library) for component tests; pure-function extraction stays allowed where it is simpler. Playwright is NOT part of this PR (WEB-3).
- Architecture decision / ADR (if needed): a short note (ADR or testing doc) recording jsdom + Testing Library as the component-test stack.
- Interface contract (API, types, DB): none.
- Tasks by owner: FE (tests, helper extraction) / QC review on request.
- File ownership (avoid parallel overlap): `tests/**`, the listed component files only for helper extraction.
- Acceptance criteria / tests: new tests fail when the guarded behaviour is removed; existing `community-*` suites unchanged and green; also fix the "2 h" test name that is really 48 h (QC F4).
- Security and migration risks: none; no production code path changes.
- Rollback approach: revert PR.
- Budget: sub-agents 0.
- State: READY (after CORE-3)
- Feature document owner: none (tests only).
- Architecture/usage doc updates needed: none.
