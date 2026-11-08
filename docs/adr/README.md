# Architecture Decision Records

🇻🇳 Bản tiếng Việt: [README.vi.md](README.vi.md)

One file per decision, `NNNN-slug.md`, numbered in the order they were taken and
never renumbered. Owned by `system-architect`. Each ADR exists in both languages;
new ones start from [`_template.md`](_template.md) / [`_template.vi.md`](_template.vi.md).

An ADR is required — not optional — for:

- removing or repointing the permanent tour redirects in `next.config.ts`
- changing the route topology or the localized pathname map
- opening the Planner backend phase (data model and submission contract first)
- adding a framework, state library, ORM or CSS system
- turning on Accept-Language locale detection
- replacing the typed seed content with a CMS or database

Write the decision first, then diagram it with the **archify** skill if a picture
helps. Archify visualizes a decision; it does not make one. Artifacts go in
`.archify/`.

The decisions the site already rests on — and did not need a record of their own — are
described in [../architecture.md](../architecture.md); anything that *changes* one needs an
ADR here.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-travel-content-system.md) | Travel Content System: typed entities behind a store interface, no database yet, `zod` validation, fail-closed admin auth | Accepted |
