# Chuyện Nhà Hưng — project rules

> Đi đâu cũng có chuyện.

Vietnamese-first travel storytelling site with a trip Planner. Next.js App Router,
TypeScript, Tailwind v4, next-intl.

## Stack
| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4 — CSS-first `@theme` tokens in `src/app/globals.css` |
| i18n | `next-intl` 4, VI default unprefixed, EN at `/en`, localized pathnames |
| Content | Typed seed data in `src/content/**` |
| Tests | Vitest 3 (Node 20.14 here is below Vite 7's 20.19 floor, so Vitest 4/5 cannot run) |

## Commands
```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
npm run build      # production build
```

## Agent roster
Three specialist agents. Route work to the one that owns the files.

| Agent | Owns | Never touches |
|---|---|---|
| `system-architect` | Route topology, data contracts, ADRs in `docs/adr/`, Archify diagrams | App code, design tokens |
| `backend-engineer` | `src/app/api/**`, server actions, persistence, validation, caching | Components, tokens, route topology |
| `frontend-engineer` | `src/app/**` markup, `src/components/**`, `globals.css` tokens, `messages/*.json` | API handlers, persistence, route topology |

Rules for each live in `.claude/agents/<name>.md` and are binding on that agent.

**Ownership is exclusive.** If a task spans two agents, the architect splits it and
defines the contract between the halves first. An agent that needs a change in
someone else's files requests it — it does not make it.

## Rules that bind everyone

1. **Vietnamese is the product, English is a translation.** VI is the default locale
   and ships without a prefix. Never ship a user-visible string that is not in both
   `messages/vi.json` and `messages/en.json`.
2. **Tour routes are permanent.** Tours are modelled as itineraries. `/tour`,
   `/tours`, `/tour/:slug` and `/tours/:slug` redirect into the itinerary routes via
   `next.config.ts`. Removing or repointing them requires an approved ADR.
3. **Design tokens are defined once**, in `@theme` in `src/app/globals.css`. No
   hard-coded colour, font, radius or shadow anywhere else.
4. **No placeholder links, no dead buttons.** `href="#"` is a defect. A control that
   does nothing must not exist.
5. **Accessibility is not optional**: semantic landmarks, one `<h1>`, ordered
   headings, visible focus, real `<button>`/`<a>` elements, ≥44px touch targets,
   meaningful `alt`.
6. **The Planner backend is a later phase.** Until the user opens it, the Planner CTA
   is a content page with real contact affordances and no server dependency. Do not
   scaffold Planner tables or endpoints early.
7. **Definition of done** is `typecheck`, `lint` and `test` passing *and the output
   stated*. Report what actually happened — if something fails or was skipped, say so.
8. Seed content must be realistic and plausible for this brand. Where a value needs
   the owner's real data (social handles, phone numbers, booking emails), flag it
   explicitly instead of leaving a convincing fake in place.
9. **Every feature ships through a branch and a PR.** No direct commits to `main`,
   no silent local-only work. See *Git workflow* below — it is binding on every
   agent and on the main session.

## Git workflow

Progress has to be visible in the repository, not only in a chat transcript. Every
piece of work — a new feature, a bug fix, a content change — lives on its own branch
and lands on `main` through a pull request.

### Branches
- `main` is protected by convention: **never commit or push directly to it.** It only
  moves through a merged PR.
- One branch per unit of work, named `<type>/<short-kebab-summary>`:
  `feat/planner-cta`, `fix/itinerary-redirect`, `chore/upgrade-next`,
  `docs/adr-planner-persistence`.
- Branch off an up-to-date `main` (`git fetch origin && git switch -c <branch> origin/main`).
- A branch is one coherent change. If scope grows into a second concern, cut a second
  branch and PR instead of widening the first.

### Commits
- Conventional Commits, imperative subject, ≤72 chars:
  `feat: add Planner contact page`, `fix: keep /tours/:slug redirect on EN locale`,
  `test: cover itinerary slug resolution`.
- Types in use: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.
- Commit in small, self-contained steps as the work progresses — one logical change
  per commit, so a bad change can be reverted on its own. Do not batch a whole
  feature into a single end-of-session commit.
- The body (when the subject is not enough) says *why*, and names the commands run
  with their result.
- End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Never rewrite history that has been pushed and shared (`main`, or a branch under
  review). Fix forward with a new commit.

### Push early, push often
- Push the branch as soon as the first commit exists (`git push -u origin <branch>`),
  then push after each commit. An unpushed branch is invisible progress.
- Pushing is the checkpoint: if a session ends mid-feature, the branch on `origin`
  plus the open PR must be enough for the next session to continue.

### Pull requests
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
- Mark the PR ready for review only when rule 7 (*Definition of done*) is satisfied:
  `typecheck`, `lint` and `test` green, output stated.
- Keep the PR updated as work continues — new commits pushed to the same branch, and
  the description edited when scope or verification changes.
- Merging is the user's call. Do not merge, squash-merge or enable auto-merge unless
  the user asks for it.

### Bugs found after merge
- A bug on `main` gets its own `fix/<summary>` branch and its own PR; it never goes
  in as a direct push to `main` and never as an amend of the merged commit.
- The fix PR links the PR that introduced the bug, states how the bug was reproduced,
  and adds a regression test where a test can express it.
- If the fix is urgent and the cause is a recent merge, prefer `git revert` of that
  merge in a PR over a rushed forward fix.

### Agents
- Agents work on the branch the session is already on. An agent does not create a
  branch, push, open a PR or merge on its own initiative — it reports its changes and
  its command output, and the main session handles git.
- When a task spans two agents, their work still lands in one branch and one PR,
  split into separate commits per agent's ownership area.

## Skills
- **archify** (`.claude/skills/archify/`, Apache-2.0, vendored from
  [tt-a1i/archify](https://github.com/tt-a1i/archify)) — generates validated,
  interactive standalone-HTML architecture/sequence/flow diagrams. It is a
  *diagramming* tool, not an architecture authority: write the ADR first, then
  visualize it. Owned by `system-architect`. Artifacts go in `.archify/`.
