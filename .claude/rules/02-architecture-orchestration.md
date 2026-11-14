---
paths:
  - "src/**"
  - "tests/**"
  - ".claude/contracts/**"
---

# Architecture orchestration (AIEOS)

Architect-first, **Single-Agent First**. For any code-changing request, triage the
architecture **before** implementing. The main session plays the architect role: it
owns scope, contracts, risk, routing and final acceptance, then implements the task
itself, role by role.

## 0. Roles are not agents
`system-architect`, `backend-engineer` and `frontend-engineer` are **roles** — an owned
file set plus the rules in `.claude/agents/<name>.md`. The main session wears them in
sequence; it does not need a subagent to do so. A **subagent** is a spawned process,
and spawning one is the exception:

- **No class spawns a subagent on its own** — not S, M, L or XL.
- **Every subagent needs the project owner's approval first.** Propose it in chat with:
  the agent, its model, the files it may touch, why the work cannot be done inline, and
  its budget (stop condition, max invocations). Wait for a clear yes. One approval
  covers that one delegation, not later ones.
- **At most 3 agents active at once, the main session included** (so at most two
  subagents in parallel), and only with disjoint file sets.
- Delegation is worth proposing when the work is read-heavy and only a short conclusion
  is needed, or when the main context is already high and the piece is self-contained.
  It is not worth it for a few files a `grep` can find.

## 1. Triage every request
Classify it, and assess data migration, backward compatibility, authorization,
secrets and user impact. The class decides **how much is written down and where the
owner must approve** — not how many agents run:

| Class | Meaning | Handling |
|---|---|---|
| **S** | Tiny, single-file, no contract change | Inline triage, implement. |
| **M** | Single module | Short Task Contract in chat, then implement. |
| **L** | Cross-layer | Task Contract file, then implement role by role in dependency order; *recommend* `security` if a trust boundary moves |
| **XL** | Security-sensitive or large | Task Contract file + human approval at risky boundaries before the irreversible step; *recommend* `qc` and `security` |

No class spawns `qc` or `security` automatically — see §4.

Over-classifying is as wrong as under-classifying — it burns the user's credits.

## 2. Task Contract
For M and above, the architect role produces one: goal · scope IN/OUT · evidence
(real paths) · existing contracts · touched files/modules · dependencies · acceptance
tests · risks · owner role per area · rollback · budget (subagents: **0 unless
approved**; stop condition) · state.

For **L/XL** write it to `.claude/contracts/<task-id>.md` from
`.claude/contracts/TEMPLATE.md`, so a later session can resume from the repository
rather than from a lost transcript. Write it **before** code: with one agent wearing
every hat, the written contract is what keeps the implementation from bending the
design. (Task Contracts live under `.claude/`, not `docs/`, because `docs/` is a
bilingual product surface — see `.claude/rules/07-documentation.md`.)

Record an ADR when a material design decision is made: start from
`docs/adr/_template.md`, write both language twins, and register it in
`docs/adr/README.md` and `README.vi.md`.

The contract must also name **which role writes the feature document**
(CLAUDE.md rules 11–12).

## 3. Implement in dependency order
Shared contracts and types first; backend next **where one is required**; frontend
once the contract is stable. The main session does these in sequence, keeping to each
role's file set and rules while it wears that role — a frontend step that needs an API
change goes back to the contract first, not straight into the handler.

When the owner has approved delegation, independent agents run **only when file
ownership is disjoint** — never let two agents edit the same file. Sequence instead of
parallelizing when scopes overlap.

> **Rule 6 still bounds dependency order, but the boundary has moved.** The Planner
> backend phase is **open** and shipped (`src/app/api/planner/**`,
> `docs/adr/0002-planner-core.md`), so "the phase is not open" is no longer the answer
> to a Planner request. What "backend first" still never justifies is scaffolding the
> parts that remain deliberately absent — the Planner UI's server dependencies beyond
> the existing API, a real identity provider, or SQL. Each needs its own ADR. For
> Planner *UI* work the dependency order is already satisfied: the contract exists,
> so the frontend role can start against it.

## 4. Reviews run on demand only
`qc` validates changed behaviour and regressions; `security` reviews auth, data,
secret and external-input changes. **Neither is a step of the flow.** No skill, agent
or main session spawns them on its own initiative, whatever the S/M/L/XL class.

They run only when the user asks:

| Trigger | Runs |
|---|---|
| `/qc-check [scope]` | `qc` on the current diff or the named feature |
| `/sec-check [scope]` | `security` on the current diff or the named feature |
| The user asks in words ("chạy qc", "check security cho feature X") | the named reviewer |

Until the user calls them, report each as **NOT RUN** — never as PASS. When the
triage finds a reason for a review (an XL task, a moved trust boundary, a new
dependency, a migration), say so in the final report as a **recommendation** with the
command to run, and stop there.

Once called, both are independent and read-only, and **both can return BLOCKED —
which stops the work, it is not advisory**. Maximum **two** review/fix cycles, then
escalate to the user instead of looping. The deterministic checks
(`typecheck`, `lint`, `test`) are not reviews: they always run.

## 5. Verify, then report
Run the project's real scripts (`.claude/rules/01-global-engineering.md` §6) — note
that `npm run test` includes `tests/docs.test.ts`, so a missing Vietnamese twin or an
unregistered document fails the suite. Then return a concise release summary: changed
files · each check PASS/FAIL/NOT RUN · `qc` and `security` verdicts (NOT RUN unless the
user called them, plus any recommendation to run them) · subagents used (normally
none) · remaining issues · rollback guidance · next action.

## 6. Git last, and never unilaterally
The main session assesses the diff itself (`git status`, `git diff --stat`);
`git-controller` runs only when the user asks (`/git-review`). Never commit, merge,
push, deploy, force-push, `reset --hard`, `clean -fd` or run a destructive DB
operation without explicit user authorization. Do not assume a PR is approved.
See `.claude/rules/05-git-governance.md`.
