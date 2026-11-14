---
name: feature
description: Route a new feature through architecture triage, scoped implementation, checks, documentation and git readiness. The recommended entry point for any non-trivial change.
---

Given request: $ARGUMENTS

**Single-Agent First.** You, the main session, do every step below yourself, wearing
the architect, backend and frontend roles in sequence. Spawn no subagent unless the
project owner approves it (see step 4).

1. Apply `CLAUDE.md`; open the relevant file in `.claude/rules/` only if it has not
   loaded. Read `.claude/context/project-context.md`, then locate the code with a few
   scoped `grep`s and read only the files the change touches. Do not scan the
   repository and do not spawn `explorer` to find a few files.
2. **Architect role.** Classify **S / M / L / XL** once. S: brief inline triage.
   M: short Task Contract in chat. L/XL: step 3. Stop here instead if the request needs
   something deliberately absent (phase guard below).
3. For L/XL write `.claude/contracts/<task-id>.md` from `.claude/contracts/TEMPLATE.md`
   before any code. Settle the API / type / content-schema contract and which role owns
   which file. XL: stop for the owner's approval at each risky boundary.
4. **Implement role by role**, in dependency order: shared contracts/types, then the
   **backend** role (`src/app/api/**`, `src/server/**`, server actions, persistence),
   then the **frontend** role (`src/app/**` markup, `src/components/**`, `globals.css`
   tokens, `messages/*.json`). Keep each role's rules from `.claude/agents/<name>.md`.
   Delegation is the exception: if a piece is genuinely worth a subagent (read-heavy,
   self-contained, or the main context is already high), **propose it** — agent, model,
   files, why not inline, budget — and wait for the owner's yes. At most 3 agents
   active at once, main included, never two on the same file.
5. Run the real checks: `npm run typecheck`, `npm run lint`, `npm run test`. Do
   **not** spawn `qc` or `security` — they run only when the user calls
   `/qc-check` or `/sec-check`. If the change warrants one (M and above for `qc`;
   a trust-boundary change or any XL task for `security`), recommend it in step 8.
6. Assess the diff yourself with `git status` and `git diff --stat`. `git-controller`
   runs only when the user asks (`/git-review`). Do **not** commit, push, merge or
   deploy without explicit user approval.
7. **Ship the documentation with the code** (CLAUDE.md rules 10–12): the feature
   document from `docs/features/_template.md` in **both** languages with the same
   heading structure, the row in `docs/features/README.md` and `README.vi.md`, and —
   if the route map, data contracts, module boundaries, a phase boundary or how the
   app is run changed — the matching edit to `docs/architecture.*` or `docs/usage.*`.
   `tests/docs.test.ts` fails on a missing twin or an unregistered document, so this
   is part of step 5, not an afterthought. See `.claude/rules/07-documentation.md`.
8. Summarize: changed files, each check as PASS / FAIL / NOT RUN with its real
   output, `qc` / `security` as NOT RUN with any recommendation to run them,
   subagents used (normally none), remaining issues, rollback note, next action. If
   work is left, write the short handoff (`.claude/rules/06-token-optimization.md`).
   If the context has passed ~150k tokens, propose `/compact` or a fresh session.

**Phase guard:** see CLAUDE.md rule 6 — a Planner request is ordinary work against the
existing contract; something still deliberately absent needs its own ADR first.
