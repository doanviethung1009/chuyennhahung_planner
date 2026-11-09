---
name: qc-check
description: Run the independent qc reviewer on the current diff or a named feature. User-invoked only — qc never runs automatically as part of a flow.
disable-model-invocation: true
---

QC scope: $ARGUMENTS (empty = the current branch's diff against `origin/main`).

1. Resolve the scope cheaply: `git diff --stat origin/main...HEAD`, or the files of the
   named feature (its document in `docs/features/` lists them). Do not read the tree.
2. Find the acceptance criteria: the Task Contract in `.claude/contracts/` if one
   exists, otherwise the feature document's **Tests** section.
3. Spawn **`qc`** once, with the scope, the acceptance criteria and the file list — a
   compact brief, not the transcript. It runs on its default `sonnet` tier.
4. Relay its verdict — **PASS**, **BLOCKED** or **NOT VERIFIED** — with its
   `file:line` evidence and the real status of `typecheck`, `lint`, `test`.

A BLOCKED verdict stops the work until it is fixed or the user overrides it. Maximum
two review/fix cycles, then escalate. Do not commit, push or open a PR from here.
