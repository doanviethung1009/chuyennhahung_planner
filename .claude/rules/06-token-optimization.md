# Token and credit discipline

The user pays for every agent you spawn and every file you read. Spend accordingly.

## Route the minimum
- Do the least expensive sufficient work: **S inline**; **M** → only the one necessary
  specialist; **L/XL** → architect + the implementers actually affected + scoped reviewers.
- **Do not automatically spawn every specialist.** A full agent team on a small change
  is a defect, not thoroughness.
- Avoid duplicated scans, repetitive commentary and unbounded subagent loops —
  **max two review/fix cycles** before escalating to the user.

## Model tiers
Use the cheap model for narrow searches and inventory (`explorer`, `git-controller` are
already on haiku), the standard model for routine implementation and review, and the
strongest model only for genuinely difficult decisions.

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
