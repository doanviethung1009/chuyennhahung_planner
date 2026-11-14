---
paths:
  - "docs/**"
  - "tests/docs.test.ts"
---

# Documentation contract

`docs/` is a maintained product surface, enforced by `tests/docs.test.ts` the way the
message catalogues are enforced by `tests/i18n.test.ts`. It is not optional polish and
it is not review-dependent — the test fails the build.

Bound by CLAUDE.md rules 10, 11 and 12.

## Layout
```
docs/
  README.md / README.vi.md          index — every document is registered here
  architecture.md / .vi.md          runtime shape, routes, data, boundaries, phases
  usage.md / .vi.md                 install, run, test, verify, deploy, common tasks
  features/README.md / .vi.md       the feature register
  features/_template.md / .vi.md    start every feature document from this
  features/<slug>.md / .vi.md       one per feature
  adr/README.md / .vi.md            ADR index + what requires an ADR
  adr/_template.md / .vi.md         Context · Decision · Options · Consequences
```

## What `tests/docs.test.ts` enforces
It walks **every** `.md` under `docs/`, recursively, and requires:

1. a Vietnamese twin — `<name>.md` ↔ `<name>.vi.md`;
2. an identical heading skeleton between the two languages (depths, in order,
   ignoring fenced code blocks);
3. exactly one `h1`, and it comes first;
4. a markdown link from each document to its translation, by basename;
5. the seven required sections in every feature document and in
   `features/_template.md`: **Summary · Routes · Data · How it works · Files ·
   Tests · Limits and open questions** — exactly these, in this order;
6. registration: feature documents listed in `docs/features/README.md` *and*
   `README.vi.md`; core documents in `docs/README.md`; ADRs in `docs/adr/README.md`;
7. every relative link resolving to a file that exists.

**Adding any `.md` under `docs/` without its twin, its translation link and its index
row breaks the test.** That is why AIEOS working files live under `.claude/` instead:
`.claude/context/project-context.md` for repository facts, and
`.claude/contracts/<task-id>.md` for Task Contracts. Neither is product documentation,
and neither should be dragged into the bilingual contract.

## Who writes what
Documentation is **not a fourth agent** — whoever ships the change writes its document.

| Document | Owner |
|---|---|
| `docs/features/<slug>.*` | the agent that owns the code being shipped |
| `docs/architecture.*`, `docs/adr/**`, `docs/README.*` | `system-architect` |
| `docs/usage.*` | whoever changed how the app is run, operated or deployed |

When the architect role splits a task between the engineer roles, the Task Contract
must say **which of them writes the feature document**. A change to
`docs/architecture.*` is made in the architect role — by the main session wearing it,
or requested from an approved `system-architect` agent — not slipped in by an engineer.

## Shipping a feature
The code · the feature document in both languages · the row in
`docs/features/README.*` · and, if the change touched the route map, the data
contracts, the module boundaries, a phase boundary or how the app is run, the
corresponding edit to `docs/architecture.*` or `docs/usage.*`.

Write the ADR **first** when the change rests on a decision with a real trade-off.

## Diagrams
A diagram is a reading aid for a decision that is already written down — write the ADR
or the architecture section first, then draw it. Keep diagrams in the document itself
as a Mermaid block, in **both** language twins, so they stay reviewable in the diff and
need no extra tooling to open. (The vendored `archify` skill was removed from `main` in
PR #5; do not reintroduce a dependency on it.)
