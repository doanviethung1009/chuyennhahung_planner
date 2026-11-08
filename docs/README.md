# Documentation — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

This folder is the written record of the app: what it is made of, how to run it,
and one document per feature. It is maintained, not archived — a change that is
not reflected here is not finished.

**Every document in `docs/` exists twice:** English at `<name>.md` and Vietnamese
at `<name>.vi.md`. English is the canonical file (it matches the code comments
and the README); the Vietnamese twin is a full translation, not a summary, and
carries the same heading structure. `tests/docs.test.ts` fails if a twin is
missing, if the two skeletons drift apart, or if a document is not listed in an
index below.

🇻🇳 Bản tiếng Việt: [README.vi.md](README.vi.md)

## Core documents

| Document | What it covers |
|---|---|
| [architecture.md](architecture.md) | Runtime shape, routing, data flow, module boundaries, phases |
| [usage.md](usage.md) | Install, run, test, verify, deploy, and the day-to-day workflows |
| [travel-content-api.md](travel-content-api.md) | Travel Content System API contract — endpoints, conventions, error codes, invariants |

## Features

One document per feature, registered in [features/README.md](features/README.md).

New features start from [features/_template.md](features/_template.md).

## Architecture decisions

ADRs live in [adr/](adr/README.md), numbered `NNNN-slug.md`, written from
[adr/_template.md](adr/_template.md).

## Adding a feature document

1. Copy `features/_template.md` to `features/<feature-slug>.md` and fill every
   section. Keep the seven headings — `tests/docs.test.ts` checks them.
2. Copy it again to `features/<feature-slug>.vi.md` and translate it in full.
   Same heading structure, Vietnamese prose.
3. Add one row for the feature to the table in `features/README.md` **and** in
   `features/README.vi.md`.
4. If the feature changed the route map, the data contracts, the module
   boundaries or a phase boundary, update `architecture.md` and
   `architecture.vi.md` too. If it changed how someone runs or operates the app,
   update `usage.md` and `usage.vi.md`.
5. If the feature rests on a non-obvious decision with a real trade-off, write
   the ADR first and link it from the feature document.
6. Run `npm run test` and state the output.

## Style

- Lead with what the thing is for, not with how it is built.
- Link to real files with repo-relative paths, so the document stays navigable.
- State the cost and the limits. A document that only lists benefits is marketing.
- Flag anything that needs the owner's real data (handles, emails, phone
  numbers) instead of leaving a convincing placeholder unmarked.
