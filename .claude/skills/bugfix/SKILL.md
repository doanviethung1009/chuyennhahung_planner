---
name: bugfix
description: Triage and fix a bug with a minimal reproducer, root cause, targeted fix and regression test. Use when something is broken rather than missing.
---

Bug: $ARGUMENTS

Inspect the affected code and whatever log or error evidence exists — do not dump
whole logs or files. Establish, in this order:

1. **Expected vs actual**, and the exact reproduction.
2. **Root cause**, quoted as `file:line`. Not a symptom, not a guess.
3. **Risk tier** (S/M/L/XL) and the owning role. If the cause is cross-module or
   high risk, switch to the architect role and write the Task Contract first
   (`.claude/rules/02-architecture-orchestration.md`). You fix it yourself — spawn
   no subagent unless the project owner approves it.

Then make the **smallest fix that addresses the root cause** and add a regression
test that fails before it and passes after — `tests/` holds the suite. Run
`npm run typecheck`, `npm run lint` and `npm run test`, and state the real output.

If the bug was that a document had gone stale or wrong, fixing the document **is** the
fix — `docs/` is enforced by `tests/docs.test.ts`, in both languages.

Do not spawn `qc` or `security`: they run only when the user calls `/qc-check` or
`/sec-check`. Recommend them in the report when the fix is M or above, or touches a
security boundary.
Do not refactor unrelated files while you are in there.

**Git:** a bug on `main` gets its own `fix/<summary>` branch and its own PR — never
a direct push to `main`, never an amend of the merged commit. The fix PR links the
PR that introduced the bug and states how the bug was reproduced. If the cause is a
recent merge and the fix is urgent, prefer `git revert` of that merge in a PR over a
rushed forward fix. `git-controller` review stays read-only; Git mutations need the
user's approval.
