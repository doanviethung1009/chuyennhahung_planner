---
name: sec-check
description: Run the independent security reviewer on the current diff or a named feature. User-invoked only — security never runs automatically, even for XL or trust-boundary changes.
disable-model-invocation: true
---

Security scope: $ARGUMENTS (empty = the current branch's diff against `origin/main`).

1. Resolve the scope cheaply: `git diff --stat origin/main...HEAD`, or the files of the
   named feature. Note which trust boundaries the change touches — auth, the admin or
   Planner API, external input, secrets/env, dependencies, migrations.
2. Spawn **`security`** once, with the scope, the touched boundaries and the Task
   Contract path if one exists — a compact brief, not the transcript. It runs on its
   default `sonnet` tier.
3. Relay its verdict — **PASS**, **PASS_WITH_WARNINGS** or **BLOCKED** — with
   `file:line` evidence. Never print a secret's value; `.env*` stays unread.

A BLOCKED verdict stops the work until it is fixed or the user overrides it. Maximum
two review/fix cycles, then escalate. Do not commit, push or open a PR from here.
