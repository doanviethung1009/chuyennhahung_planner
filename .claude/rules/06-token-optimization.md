---
paths:
  - ".claude/agents/**"
  - ".claude/skills/**"
  - "CLAUDE.md"
---

# Token and credit discipline

The user pays for every agent you spawn and every file you read. Spend accordingly.

## Route the minimum
- Do the least expensive sufficient work: **S inline**; **M** → only the one necessary
  specialist; **L/XL** → architect + the implementers actually affected.
- **`qc` and `security` are on demand.** They cost a full review pass, so they run only
  when the user calls them (`/qc-check`, `/sec-check`) — see
  `.claude/rules/02-architecture-orchestration.md` §4.
- **Do not automatically spawn every specialist.** A full agent team on a small change
  is a defect, not thoroughness.
- Avoid duplicated scans, repetitive commentary and unbounded subagent loops —
  **max two review/fix cycles** before escalating to the user.

## Model tiers
Each agent's default model is pinned in its frontmatter (`.claude/agents/<name>.md`):

| Tier | Agents | Why |
|---|---|---|
| `haiku` | `explorer`, `git-controller` | Narrow search, inventory, diff reading — no judgement calls |
| `sonnet` | `system-architect`, `frontend-engineer`, `backend-engineer`, `qc`, `security` | Routine design, implementation and review against a written contract |
| `opus` | none by default | Only by explicit per-call override, see below |

**When to escalate to `opus`.** Pass `model: opus` on that one Agent call — never edit
the frontmatter to do it — only for a genuinely hard decision: an XL design, an ADR
with a real trade-off, or a bug that a `sonnet` attempt has already failed to root-cause.
Say in the report that you escalated and why.

**When to drop to `haiku`.** A mechanical, fully specified change (rename a key, add a
message string to both catalogues, move a file) may be sent to an implementer with
`model: haiku`.

The main session's own model is the user's choice in the app; these tiers apply to the
agents it spawns.

**Do not claim guaranteed credit savings or a savings percentage** without measured
usage. `/usage` is the only real evidence.

## Read narrowly
- `grep`/`rg` and targeted file reads, never repository-wide dumps.
- Short outputs. Summarize command results; do not paste long logs.
- Use the `explorer` agent to locate files rather than reading broadly yourself.

## Carry context in the repository, not the transcript
Preserve a concise handoff in `.claude/contracts/<task-id>.md` for cross-session
continuity, and keep `.claude/context/project-context.md` current. Pass compact Task
Contracts to agents instead of whole transcripts.

## Keep the main session short — this is where the credits go
Measured on this project's own transcripts (2026-11-09, 12 sessions): the **main
session accounted for ~98% of all tokens** and every subagent together for ~2%. One
session alone ran 731 model calls, grew to a 567k-token context, never compacted, and
consumed about half of everything. Every call re-reads the whole context, so cost
grows roughly with the *square* of session length.

- **One session per branch/PR.** Start a fresh session for the next unit of work
  instead of continuing in a long one; the branch, the PR and
  `.claude/contracts/<task-id>.md` carry the handoff.
- **`/compact` once the context passes ~150k tokens**, and `/clear` between unrelated
  tasks.
- **Use the strongest model only for the hard part.** A main session on `opus` that
  runs hundreds of routine `Bash` calls is the most expensive way to do that work —
  switch the session to `sonnet` in the app for routine work, or hand the
  implementation to a `sonnet` agent, which returns a compact report instead of its
  whole working context.
- Do not paste long logs or whole files into the conversation; summarise them.

## How these rule files are loaded
`CLAUDE.md` is loaded on every turn **and into every subagent**. Every `.md` in
`.claude/rules/` would be too, unless it is scoped — so each rule file here carries a
`paths:` frontmatter list and is loaded only when the session works on matching files
(code, docs, agents, hooks). It can always be opened explicitly.

When you add a rule: put the binding one-liner in `CLAUDE.md`, the detail in the rule
file whose `paths:` cover the files it governs, and **never** add a rule file without
`paths:` — an unscoped rule file is paid for on every turn of every session.
