# Architecture Decision Records

🇻🇳 Bản tiếng Việt: [README.vi.md](README.vi.md)

One file per decision, `NNNN-slug.md`, numbered in the order they were taken and
never renumbered. Owned by `system-architect`. Each ADR exists in both languages;
new ones start from [`_template.md`](_template.md) / [`_template.vi.md`](_template.vi.md).

An ADR is required — not optional — for:

- removing or repointing the permanent tour redirects in `next.config.ts`
- changing the route topology or the localized pathname map
- opening the Planner backend phase (data model and submission contract first) — done in [0002](0002-planner-core.md); a *further* phase, such as the Planner UI or AI suggestions, needs its own
- adding a framework, state library, ORM or CSS system, or a major upgrade of one that validates external input — see [0003](0003-zod-4.md)
- turning on Accept-Language locale detection
- replacing the typed seed content with a CMS or database

Write the decision first, then draw it if a picture helps — as a Mermaid block
inside the ADR itself, in both language twins. A diagram visualizes a decision;
it does not make one.

The decisions the site already rests on — and did not need a record of their own — are
described in [../architecture.md](../architecture.md); anything that *changes* one needs an
ADR here.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-travel-content-system.md) | Travel Content System: typed entities behind a store interface, no database yet, `zod` validation, fail-closed admin auth | Accepted |
| [0002](0002-planner-core.md) | Planner core: four normalised trip collections, a real trip owner with object-level authorization, independent template clones, integer-VND budgeting with a BigInt boundary, `If-Match` concurrency | Accepted |
| [0003](0003-zod-4.md) | Upgrade `zod` to 4.x to remove GHSA-mrhx-c7xc-m3w5 rather than fence it behind the request body cap; two deprecated call sites migrated, behaviour verified unchanged | Accepted |
| [0004](0004-planner-identity.md) | Planner identity: an `HttpOnly` session cookie exchanged for the existing access token, behind one `resolveIdentity` seam, with CSRF as the explicit cost | Accepted |
