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

## Why the detail lives in `.claude/rules/`
`CLAUDE.md` is loaded into context on every single turn; these rule files are read on
demand. Keeping `CLAUDE.md` short is itself a token optimization — so when you add a
rule, put the binding one-liner in `CLAUDE.md` and the detail here.
