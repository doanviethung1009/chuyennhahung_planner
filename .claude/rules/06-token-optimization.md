---
paths:
  - ".claude/agents/**"
  - ".claude/skills/**"
  - "CLAUDE.md"
---

# Token and credit discipline

The user pays for every agent you spawn and every file you read. Spend accordingly.

## Single-Agent First
- **One agent by default.** The main session does the task at every class, wearing the
  architect, backend and frontend roles in sequence
  (`.claude/rules/02-architecture-orchestration.md` §0).
- **No subagent without the owner's approval**, proposed with agent, model, files, why
  not inline and a budget. `.claude/settings.json` puts the `Agent` tool on `ask`, so
  each spawn also shows an approval prompt.
- **At most 3 agents active at once, the main session included.**
- **`qc` and `security` are on demand.** They cost a full review pass, so they run only
  when the user calls them (`/qc-check`, `/sec-check`) — see rule 02 §4.
- Avoid duplicated scans, repetitive commentary and unbounded loops — **max two
  review/fix cycles** before escalating to the user. Triage once: do not re-analyse,
  re-read docs or re-review what is already settled in this session.

## Model tiers
Each agent's default model is pinned in its frontmatter (`.claude/agents/<name>.md`):

| Tier | Use for | Agents if spawned |
|---|---|---|
| `haiku` | Narrow search, inventory, diff reading, mechanical edits | `explorer`, `git-controller` |
| `sonnet` | Routine implementation, architecture analysis, verification | `system-architect`, `frontend-engineer`, `backend-engineer`, `qc`, `security` |
| `opus` | **Never by default** | Only when the owner asks for it or approves it |

**Opus.** Only when the owner explicitly asks or approves it for a genuinely hard
problem — an XL design, an ADR with a real trade-off, or a bug a `sonnet` attempt has
already failed to root-cause. For a subagent pass `model: opus` on that one call, never
edit the frontmatter. Say in the report that you escalated and why.

**Haiku.** A mechanical, fully specified change (rename a key, add a message string to
both catalogues, move a file) may go to an approved subagent with `model: haiku`.

**Do not churn.** Do not switch the session's model or raise thinking effort mid-session
without need — each switch invalidates the prompt cache, and higher effort is paid on
every turn. The main session's model is the owner's choice in the app; for routine
work recommend `sonnet`.

**Do not claim guaranteed credit savings or a savings percentage** without measured
usage. `/usage` and the transcript `usage` fields are the only real evidence.

## Read narrowly
- Read the files the change touches, scoped with `grep`/`rg` and line ranges. Never
  scan or dump the whole repository.
- Locate files yourself. **Do not spawn `explorer` to find a few files** — if three
  `grep`s would find it, `grep` it. `explorer` is for a genuinely broad search, and it
  still needs approval.
- Short outputs. Summarize command results; do not paste long logs or whole files.

## Carry context in the repository, not the transcript
Keep `.claude/context/project-context.md` current, and pass compact Task Contracts —
never whole transcripts — to any approved subagent.

**Handoff.** When a session ends with work left, write a handoff of at most 15 lines
in `.claude/contracts/<task-id>.md` (or the PR description): branch, what is done,
each check with its real status (PASS/FAIL/NOT RUN), what is left, open decisions. Facts
only — no recap of the conversation. A full Task Contract run
(`.claude/templates/UNIVERSAL_TASK_EXECUTION.md`) writes its handoff to
`.claude/contracts/handoff/<task-id>.md`, at most 25 lines.

## Keep the main session short — this is where the credits go
Measured on this project's own transcripts (2026-11-09, 12 sessions): the **main
session accounted for ~98% of all tokens** and every subagent together for ~2%. One
session alone ran 731 model calls, grew to a 567k-token context, never compacted, and
consumed about half of everything. Every call re-reads the whole context, so cost
grows roughly with the *square* of session length. Single-Agent First keeps more
reading in the main session, so these limits matter more, not less:

- **One session per task or branch/PR.** Start a fresh session for the next unit of
  work instead of continuing in a long one; the branch, the PR and the handoff carry
  the state.
- **Propose `/compact` once the context passes ~150k tokens** — say so, do not wait to
  be asked — and `/clear` between unrelated tasks.
- Do not paste long logs or whole files into the conversation; summarise them.

## How these rule files are loaded
`CLAUDE.md` is loaded on every turn **and into every subagent**. Every `.md` in
`.claude/rules/` would be too, unless it is scoped — so each rule file here carries a
`paths:` frontmatter list and is loaded only when the session works on matching files
(code, docs, agents, hooks). It can always be opened explicitly.

When you add a rule: put the binding one-liner in `CLAUDE.md`, the detail in the rule
file whose `paths:` cover the files it governs, and **never** add a rule file without
`paths:` — an unscoped rule file is paid for on every turn of every session.
