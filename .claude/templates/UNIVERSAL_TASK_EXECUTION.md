# Universal Task Execution prompt

Paste this at the start of a **new** Claude session, replacing `<CONTRACT>` with the
path of one Task Contract (`.claude/contracts/<task-id>.md`, shape in
`.claude/contracts/TEMPLATE.md`). It restates and sequences rules that already bind the
project — it adds none: `CLAUDE.md`, `.claude/rules/02`, `05`, `06`.

---

Execute Task Contract `<CONTRACT>`.

## Session
- **One Task Contract = one Claude session.** Do not pick up a second contract here;
  start a fresh session for the next one.
- **Single agent.** You play architect → backend → frontend in sequence. **Do not spawn
  sub-agents.** If you think one is warranted, propose it (agent, model, files, why not
  inline, budget) and wait for the owner's yes.
- Do not switch model or raise effort mid-session. Propose `/compact` past ~150k context.

## 1. Read narrowly
Read, in this order, and stop when you have enough:
1. `CLAUDE.md` (already loaded) and the contract.
2. `.claude/context/project-context.md` — only the sections the contract touches.
3. The files the contract lists, found with `grep`/`rg` and line ranges.

Never scan the repository or re-read what is settled. Short command output only.

## 2. Check dependencies before any code
- Every contract/PR/ADR named under Constraints or dependencies exists and is **merged
  to `main`** (`git log`, `gh pr view`). Cite the evidence.
- Referenced files, APIs, scripts and tests exist as the contract says.
- If a dependency is missing or the contract contradicts the code: **stop and report**
  (BLOCKED). Do not improvise around it.

## 3. Implement only the contract
- Stay inside Scope IN and its file ownership. Anything outside → note it, do not do it.
- Obey CLAUDE.md rules 1–12 (VI/EN parity, tokens, a11y, no dead links, docs + VI twin,
  feature document).
- No invented APIs, schema, tests, credentials or success status.

## 4. Self QC and Security (same session, no extra agent)
Run `npm run typecheck`, `npm run lint`, `npm run test` (and `npm run build` if routes
or config changed). State the real output; a check you did not run is **NOT RUN**.
Then self-review the diff against the contract's acceptance criteria and, for
auth/input/secrets/privacy-relevant changes, a short security pass (authz on every
path, validation, no secrets/PII logged, no new oracle). Fix findings; max two cycles.
The independent `qc` / `security` agents stay **on demand only** — recommend them where
warranted, report them NOT RUN otherwise.

## 5. Git: one task = one branch = one PR
- Branch `<type>/<short-kebab-summary>` from up-to-date `main`; Conventional Commits
  ≤72 chars. Never commit to `main`.
- Commit, push and open the PR only with the owner's authorization.
- **Never merge, and never deploy to production.** Stop at an open PR.

## 6. Handoff
Write `.claude/contracts/handoff/<task-id>.md`, **at most 25 lines**, facts only:
branch + PR link · done · outside-the-plan changes · each check PASS/FAIL/NOT RUN ·
risks · open decisions · next. No conversation recap.

## Final report (≤ 10 lines)
Contract id, branch, PR, checks with real status, what is left, what needs the owner.
