---
name: feature
description: Route a new feature through architecture triage, scoped implementation, QC, security and git readiness. The recommended entry point for any non-trivial change.
---

Given request: $ARGUMENTS

1. Apply `CLAUDE.md` and the relevant files in `.claude/rules/`. Inspect
   `.claude/context/project-context.md` and only the code you actually need —
   use the `explorer` agent for locating files rather than broad reads.
2. Classify **S / M / L / XL**. For S do a brief inline triage and implement
   directly. For M/L/XL ask **`system-architect`** for a minimal plan and an
   explicit Task Contract.
3. For L/XL write `.claude/contracts/<task-id>.md` from `.claude/contracts/TEMPLATE.md`.
   Settle the API / type / content-schema contract and FE/BE file ownership
   **before** any code is written.
4. Route the smallest sufficient set of agents — **`frontend-engineer`** for
   `src/app/**` markup, `src/components/**`, `globals.css` tokens and
   `messages/*.json`; **`backend-engineer`** for `src/app/api/**`, server actions
   and persistence. Sequential if file sets overlap. No full agent team for a
   small change.
5. Run the real checks: `npm run typecheck`, `npm run lint`, `npm run test`. Use
   **`qc`** to review changed behaviour (M and above) and **`security`** for
   trust-boundary changes or any XL task. Maximum two fix/review loops, then
   escalate to the user.
6. Ask **`git-controller`** for a read-only diff assessment. Do **not** commit,
   push, merge or deploy without explicit user approval.
7. **Ship the documentation with the code** (CLAUDE.md rules 10–12): the feature
   document from `docs/features/_template.md` in **both** languages with the same
   heading structure, the row in `docs/features/README.md` and `README.vi.md`, and —
   if the route map, data contracts, module boundaries, a phase boundary or how the
   app is run changed — the matching edit to `docs/architecture.*` or `docs/usage.*`.
   `tests/docs.test.ts` fails on a missing twin or an unregistered document, so this
   is part of step 5, not an afterthought. See `.claude/rules/07-documentation.md`.
8. Summarize: changed files, each check as PASS / FAIL / NOT RUN with its real
   output, security verdict, remaining issues, rollback note, next action.

**Phase guard:** the Planner backend has shipped, so a Planner request is ordinary
work against an existing contract (`docs/adr/0002-planner-core.md`). Stop at step 2
only if the request needs something still deliberately absent — a real identity
provider, SQL, the Planner map or AI suggestions — and say it needs its own ADR
(CLAUDE.md rule 6) rather than scaffolding it.
