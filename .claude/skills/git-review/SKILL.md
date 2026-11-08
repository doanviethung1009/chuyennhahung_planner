---
name: git-review
description: Review git diff, branch hygiene, secret risks and PR readiness without mutating Git state. Use before asking for a commit or opening a PR.
---

Run the **`git-controller`** agent, read-only.

Compare the current changes against the Task Contract. Detect unrelated code,
secrets, generated files (`.next/`, `tsconfig.tsbuildinfo`, `screenshots/`,
`.claude/backups/`) and the local content store `.data/`, lockfile churn, missing
tests and rollback risk.
Flag any commit that landed on `main`.

Return **READY** or **BLOCKED** with evidence, plus:
- a proposed branch name in this project's convention — `<type>/<short-kebab-summary>`,
  e.g. `feat/planner-cta` (**not** `feature/<id>-<slug>`);
- a proposed Conventional Commit message, imperative subject ≤72 chars, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`;
- a proposed PR body covering What, Why, Verification (real command output),
  Screenshots for visible UI change, linked ADR, and deliberate omissions, ending
  with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Never stage, commit, push, merge, reset or force-push. Merging is the user's call.
