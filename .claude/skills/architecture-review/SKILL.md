---
name: architecture-review
description: Request a read-only architecture impact assessment and task breakdown before implementation. Use when a change spans layers, touches route topology or data contracts, or needs an ADR.
---

Review: $ARGUMENTS

Use the **`system-architect`** agent. It inspects relevant files only and reports:
current state with real paths, affected modules and data contracts, risk class
(S/M/L/XL), migration and rollback, FE/BE dependency order, which agents are
affected, acceptance tests, and a token-conscious execution plan.

No implementation in this skill — design only.

Write an ADR only if a material design decision needs recording. Start from
`docs/adr/_template.md`, write `NNNN-slug.md` **and** `NNNN-slug.vi.md` with the same
heading structure, and register both in `docs/adr/README.md` and `README.vi.md`.

An ADR is **required** before changing route topology or the tour redirects
(CLAUDE.md rule 2), changing a data contract in `src/content/types.ts`, introducing a
framework/state library/ORM/CSS system, or opening the Planner backend phase (rule 6).

If the change alters the runtime shape, route map, module boundaries or phases, say in
the report that `docs/architecture.md` and `docs/architecture.vi.md` must be updated in
the same change — that is the architect's own file.
