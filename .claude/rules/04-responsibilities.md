# Responsibilities — architect / FE / BE / QC / Security / Git

**Ownership is exclusive.** If a task spans two agents, `system-architect` splits it and
defines the contract between the halves *first*. An agent that needs a change in
someone else's files **requests it — it does not make it.** Two agents never edit the
same file.

Each agent's binding rules live in `.claude/agents/<name>.md`.

## The roster

| Agent | Model | Mode | Owns | Never touches |
|---|---|---|---|---|
| `system-architect` | opus | designs | Route topology, localized pathname map, data contracts (`src/content/types.ts`, `src/lib/`), API/server-action contracts, ADRs in `docs/adr/`, `docs/architecture.*`, `docs/README.*`, Task Contracts in `.claude/contracts/`, phase boundaries | App code, design tokens |
| `frontend-engineer` | opus | implements | `src/app/**` markup & layouts, `src/components/**`, `@theme` tokens in `src/app/globals.css`, `messages/vi.json`, `messages/en.json`, the feature document for what it ships | API handlers, persistence, route topology, `docs/architecture.*` |
| `backend-engineer` | opus | implements | `src/app/api/**`, `src/server/**`, server actions, persistence & migrations, validation, authorization, rate limiting, error shapes, server caching, backend tests, the feature document for what it ships | Components, design tokens, route topology, `docs/architecture.*` |
| `explorer` | haiku | **read-only** | Locating files, routes, symbols, message keys | Everything — it never edits |
| `qc` | sonnet | **read-only** | Independent verification of changed behaviour, regressions, VI/EN parity, docs contract, a11y, acceptance criteria | Never edits files |
| `security` | sonnet | **read-only** | Auth, authorization, secrets, input validation, injection, privacy, dependencies, migration risk | Never edits files |
| `git-controller` | haiku | **read-only** | Branch/diff/PR assessment, commit & PR wording, secret and scope detection | Never mutates git state |

## Architect
Decides structure; produces decisions, contracts and diagrams — **never application
code**. Classifies S/M/L/XL, writes the Task Contract, assigns disjoint file ownership,
names which engineer writes the feature document, sets the QC/security gates, and
accepts or rejects the result. Keeps `docs/architecture.*` true and
`.claude/context/project-context.md` current.

Reports a decision as: the decision, the one reason it beat the runner-up, and what it
costs. States open questions rather than resolving them silently.

Diagrams go **in the document itself as a Mermaid block**, in both language twins —
write the ADR or architecture section first, then draw it.

## Frontend engineer
Implements only the FE scope in the Task Contract. Flags an incompatible backend
contract instead of silently changing an interface — the HTTP contract is written in
`docs/travel-content-api.md`. Verifies the rendered result at 375px, 768px and 1280px —
never claims a layout works without looking at it.

## Backend engineer
Implements only the BE scope. Validates every external input at the boundary with a
schema, in the handler itself. Never logs or returns secrets, tokens or full PII. No
raw string-interpolated SQL. Mutations are idempotent where a client may retry. A
handler is not done until a test covers its **failure** path, not just the happy one.
Keeps persistence behind the `ContentStore` interface.

Owns two shipped systems — Travel Content (one `ADMIN_API_TOKEN` principal) and the
Planner (a principal per traveller, so every read and write is filtered by `ownerId`).
Rule 6 now bounds what is still absent rather than the Planner backend itself: a real
identity provider, SQL, the Planner map and AI suggestions each need an ADR.

## Documentation is not a fourth agent
Whoever ships the change writes its document — see
`.claude/rules/07-documentation.md` for the ownership table and what
`tests/docs.test.ts` enforces.

## QC and Security — independent, and able to block
Neither is the implementer's helper; both are the check on their work. Neither edits
files. Each returns an explicit verdict, with `file:line` evidence, and distinguishes
*not verified* from *verified good*. **A BLOCKED verdict stops the work** — it is not
advisory, and it is not overridden by the implementer. Only the user overrides it.

- `qc` → **PASS** / **BLOCKED** / **NOT VERIFIED**. Required for M and above.
- `security` → **PASS** / **PASS_WITH_WARNINGS** / **BLOCKED**. Mandatory for XL and
  any trust-boundary change.

## Git controller — read-only, always
Inspects and proposes; the user acts. It never stages, commits, pushes, merges,
rebases, resets, tags or deletes a branch. A `PreToolUse` hook enforces this
independently of the prompt.

## Agents and git
Agents work on the branch the session is already on. **An agent does not create a
branch, push, open a PR or merge on its own initiative** — it reports its changes and
its command output, and the main session handles git. When a task spans two agents,
their work still lands in one branch and one PR, split into separate commits per
agent's ownership area.
