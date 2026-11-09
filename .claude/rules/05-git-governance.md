# Git governance

Progress has to be visible in the repository, not only in a chat transcript. Every
piece of work — a new feature, a bug fix, a content change — lives on its own branch
and lands on `main` through a pull request.

Binding on every agent and on the main session.

## Branches
- `main` is protected by convention: **never commit or push directly to it.** It only
  moves through a merged PR. The `PreToolUse` hook
  (`.claude/hooks/git_guard.py`) **denies** `commit`, `push` and `merge` while HEAD is
  on `main`. If that is genuinely what you want, run the command yourself.
- One branch per unit of work, named `<type>/<short-kebab-summary>`:
  `feat/planner-cta`, `fix/itinerary-redirect`, `chore/upgrade-next`,
  `docs/adr-planner-persistence`.
  *(This is the project convention and it overrides the AIEOS kit's
  `feature/<id>-<slug>` suggestion.)*
- Branch off an up-to-date `main`: `git fetch origin && git switch -c <branch> origin/main`.
- A branch is one coherent change. If scope grows into a second concern, cut a second
  branch and PR instead of widening the first.

## Commits
- Conventional Commits, imperative subject, ≤72 chars:
  `feat: add Planner contact page`, `fix: keep /tours/:slug redirect on EN locale`,
  `test: cover itinerary slug resolution`.
- Types in use: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.
- Commit in small, self-contained steps as the work progresses — one logical change
  per commit, so a bad change can be reverted on its own. Do not batch a whole feature
  into a single end-of-session commit.
- The body (when the subject is not enough) says *why*, and names the commands run
  with their result.
- End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Never rewrite history that has been pushed and shared (`main`, or a branch under
  review). Fix forward with a new commit.

## Push early, push often
- Push the branch as soon as the first commit exists (`git push -u origin <branch>`),
  then push after each commit. An unpushed branch is invisible progress.
- Pushing is the checkpoint: if a session ends mid-feature, the branch on `origin`
  plus the open PR must be enough for the next session to continue.

## Pull requests
- Open the PR as a **draft** right after the first push, not at the end. The PR is
  where progress is tracked.
- Title: same Conventional Commit style as the subject line.
- Description covers:
  1. **What** changed, in one short paragraph.
  2. **Why** — the request or defect behind it.
  3. **Verification** — the actual output of `npm run typecheck`, `npm run lint` and
     `npm run test`. Pasting the commands without their result is not verification.
  4. **Screenshots** for any visible UI change, VI and EN where the locales differ.
  5. Linked ADR when the change touches route topology or data contracts.
  6. Anything deliberately left out, and why.
- End every PR description with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Mark the PR ready for review only when the Definition of done is satisfied:
  `typecheck`, `lint` and `test` green, output stated.
- Keep the PR updated as work continues — new commits pushed to the same branch, and
  the description edited when scope or verification changes.
- **Merging is the user's call.** Do not merge, squash-merge or enable auto-merge
  unless the user asks for it. Never assume a PR is approved.

## Bugs found after merge
- A bug on `main` gets its own `fix/<summary>` branch and its own PR; it never goes in
  as a direct push to `main` and never as an amend of the merged commit.
- The fix PR links the PR that introduced the bug, states how the bug was reproduced,
  and adds a regression test where a test can express it.
- If the fix is urgent and the cause is a recent merge, prefer `git revert` of that
  merge in a PR over a rushed forward fix.

## Agents
- Agents work on the branch the session is already on. An agent does not create a
  branch, push, open a PR or merge on its own initiative — it reports its changes and
  its command output, and the main session handles git.
- When a task spans two agents, their work still lands in one branch and one PR, split
  into separate commits per agent's ownership area.
- `git-controller` is **read-only by design**. Use `/git-review` for an assessment,
  then run the approved git commands yourself.

## Prohibited without explicit user authorization
`git push`, `git merge`, `git rebase`, `git commit`, `git tag`, branch deletion,
deploys, and any destructive database operation. **Always** prohibited:
`--dangerously-skip-permissions`, `git push --force`, `git reset --hard`,
`git clean -f`, `rm -rf`. The hook blocks these; it is a backstop, not a substitute
for judgement — it catches common patterns only and is not a complete shell filter.

## Hook prerequisite
The guard is a Python script, so **Python 3 must be on PATH** for it to run
(verified here: Python 3.13.7). If `python3` is missing the hook silently does not
fire and git protection falls back to the prompt rules alone — check this after
changing machines. Test it with:

```bash
echo '{"tool_input":{"command":"git push --force"}}' | python3 .claude/hooks/git_guard.py
```
It should print a JSON `permissionDecision` of `deny`.

## Three layers, and what each one actually covers
Nothing here is remote branch protection. Be precise about which layer catches what,
because a guard that looks like enforcement but is not is worse than none.

| Layer | Covers | Does not cover |
|---|---|---|
| `.claude/hooks/git_guard.py` (`PreToolUse`) | Claude Code's own tool calls | your terminal, any other client |
| `.githooks/pre-commit`, `pre-push` | **your terminal**, once enabled per clone | a fresh clone that has not enabled it; `--no-verify`; the remote |
| `.github/workflows/ci.yml` | every PR into `main`, and `main` after merge | nothing is *blocked* — see below |

### Enabling the git hooks
They live in a tracked directory, so they are reviewed like code, but git does not use
them until each clone opts in:

```bash
git config core.hooksPath .githooks   # once per clone
git config --get core.hooksPath       # confirm
```

`pre-commit` refuses a commit while HEAD is on `main`. `pre-push` refuses a push that
would move `refs/heads/main`, including a deletion, and including when `main` is one ref
among several in the same push. Both print the branch-and-PR route instead, and both can
be overridden deliberately with `--no-verify` — that is a choice, not an accident.

Worktrees matter here: `core.hooksPath` is shared across the whole repository, and the
hooks read **the branch of the worktree the command runs in**. The `PreToolUse` guard got
exactly this wrong once (PR #9) and silently stopped enforcing rule 9.

### Why CI cannot be made required
Required status checks need provider branch-protection rules or rulesets, and both are
unavailable while this repository is **private on GitHub Free**:

```
403 Upgrade to GitHub Pro or make this repository public to enable this feature.
```

So CI results are **advisory**: a red run does not block a merge, and a human still has
to look. Real enforcement needs GitHub Pro or a public repository, and then
branch-protection on `main` requiring the `verify` job.

Still not wired up, and worth adding when CI can be made required: secret scanning and a
dependency scan. `npm audit --omit=dev` is clean; the full audit still reports 17
dev-only advisories (8 moderate, 9 high, no critical), which nothing in the pipeline
fails on yet. Do **not** run `npm audit fix --force`: it would downgrade
`eslint-config-next` to 15.x, out of step with Next 16.
