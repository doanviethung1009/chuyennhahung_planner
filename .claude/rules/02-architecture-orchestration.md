# Architecture orchestration (AIEOS)

Architect-first. For any code-changing request, triage the architecture **before**
implementing. The architect owns scope, contracts, risk, routing and final acceptance.

## 1. Triage every request
Classify it, and assess data migration, backward compatibility, authorization,
secrets and user impact:

| Class | Meaning | Handling |
|---|---|---|
| **S** | Tiny, single-file, no contract change | Inline triage. **Spawn nothing.** |
| **M** | Single module | `system-architect` writes a short Task Contract → one implementer → `qc` |
| **L** | Cross-layer | Architect + the implementers actually affected → `qc`; `security` if a trust boundary moves |
| **XL** | Security-sensitive or large | Architect deep review + implementers + `qc` + **`security` (mandatory)** + human approval at risky boundaries |

Over-classifying is as wrong as under-classifying — it burns the user's credits.

## 2. Task Contract
For M and above, `system-architect` produces one: goal · scope IN/OUT · evidence
(real paths) · existing contracts · touched files/modules · dependencies · acceptance
tests · risks · owner per area · rollback · budget (max agent invocations, stop
condition) · state.

For **L/XL** write it to `.claude/contracts/<task-id>.md` from
`.claude/contracts/TEMPLATE.md`, so a later session can resume from the repository
rather than from a lost transcript. (Task Contracts live under `.claude/`, not `docs/`,
because `docs/` is a bilingual product surface — see
`.claude/rules/07-documentation.md`.)

Record an ADR when a material design decision is made: start from
`docs/adr/_template.md`, write both language twins, and register it in
`docs/adr/README.md` and `README.vi.md`.

The contract must also name **which engineer writes the feature document**
(CLAUDE.md rules 11–12).

## 3. Implement in dependency order
Shared contracts and types first; backend next **where one is required**; frontend
once the contract is stable. Use independent agents **only when file ownership is
disjoint** — never let two agents edit the same file. Sequence instead of
parallelizing when scopes overlap.

> **Rule 6 still bounds dependency order, but the boundary has moved.** The Planner
> backend phase is **open** and shipped (`src/app/api/planner/**`,
> `docs/adr/0002-planner-core.md`), so "the phase is not open" is no longer the answer
> to a Planner request. What "backend first" still never justifies is scaffolding the
> parts that remain deliberately absent — the Planner UI's server dependencies beyond
> the existing API, a real identity provider, or SQL. Each needs its own ADR. For
> Planner *UI* work the dependency order is already satisfied: the contract exists,
> so `frontend-engineer` can start against it.

## 4. Review gates
`qc` validates changed behaviour and regressions. `security` reviews auth, data,
secret and external-input changes, and **every XL task**. Both are independent and
read-only, and **both can return BLOCKED — which stops the work, it is not advisory**.

Maximum **two** review/fix cycles. Then escalate to the user instead of looping.

## 5. Verify, then report
Run the project's real scripts (`.claude/rules/01-global-engineering.md` §6) — note
that `npm run test` includes `tests/docs.test.ts`, so a missing Vietnamese twin or an
unregistered document fails the suite. Then return a concise release summary: changed
files · each check PASS/FAIL/NOT RUN · security verdict · remaining issues · rollback
guidance · next action.

## 6. Git last, and never unilaterally
`git-controller` assesses the diff and PR readiness, read-only. Never commit, merge,
push, deploy, force-push, `reset --hard`, `clean -fd` or run a destructive DB
operation without explicit user authorization. Do not assume a PR is approved.
See `.claude/rules/05-git-governance.md`.
