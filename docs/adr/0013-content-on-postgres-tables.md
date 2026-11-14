# ADR 0013 — Travel Content moves to normalised PostgreSQL tables

🇻🇳 Bản tiếng Việt: [0013-content-on-postgres-tables.vi.md](0013-content-on-postgres-tables.vi.md)

- **Status:** Accepted — the owner chose option B (normalised tables) on 2026-11-14
- **Date:** 2026-11-14
- **Owner:** system-architect
- **Affects:** `src/server/persistence/**`, `src/server/content/instance.ts`, `db/migrations/0004_content.sql` (new), `scripts/**`, `deploy/compose.app*.yml`, `tests/**`, `docs/architecture.*`, `docs/usage.*`

## Context

[ADR 0008](0008-postgres-document-store.md) decided that both systems leave the JSON
file for PostgreSQL. [ADR 0009](0009-postgres-persistence.md) did it for the Planner,
as normalised tables behind the unchanged repository. The Travel Content store is
the one that is left: `src/server/content/instance.ts` still builds a JSON file store
under `.data/travel-content.json`.

That has become a blocker rather than a debt. [ADR 0012](0012-public-travel-from-content-repository.md)
made every public Travel page read the content repository on each request, and
[ADR 0011](0011-admin-content-cms.md) lets editors write it from the browser. With two
app instances an edit on one is invisible to the other and two writers can overwrite
each other. `deploy/compose.app.yml` says so in a comment: never scale the app until
both stores are on Postgres. The content file also sits on the same volume as the app,
so there is no point-in-time backup of the site's editorial work.

What we know: the content set is five collections (`places`, `stories`, `collections`,
`reviews`, `templates`), about 30 KB in the seed and growing with every story; only
editors write, readers read; every invariant lives in `ContentRepository`
(`src/server/content/repository.ts`, ~30 methods) which works on the whole `ContentData`
through `DocumentStore.transact`. What we do not know: how large the set gets in two
years, and whether editors will need audit history or SQL search.

The application is meant to run for a long time. The owner asked for the two shapes to
be compared on that basis and chose **B**.

## Decision

1. **Normalised tables, one per collection, behind the unchanged `ContentStore`.**
   `content_places`, `content_stories`, `content_collections`, `content_reviews`,
   `content_templates`, plus `content_revision` (the counter behind the cache). The
   repository and the 26 handlers do not change; the store loads the five tables into
   `ContentData`, runs the repository's mutation on a clone and writes only the rows
   that differ. This is the technique of ADR 0009, not a rewrite of the repository.
2. **One generic table engine for both stores.** The row mapping, the diff and the
   Postgres transaction/cache protocol are parameterised by a table list, a key column,
   a lock key and a revision table. The Planner passes its own parameters; its
   behaviour and tests are unchanged. No second copy of the diff exists to drift.
3. **Typed columns where the value is a scalar, JSONB where it is structure.** Slug,
   status, dates, timestamps, rating, cost, counts, destination and category are
   columns with `CHECK` constraints for the enums. Localised `{vi, en}` text, story
   blocks, gallery, SEO, affiliate links, template days and the source snapshot are
   `jsonb`: they are read and written as a unit and have no query need today. Slug
   lists are `text[]`, indexable later. `slug` is the primary key (`id` for reviews),
   so uniqueness is enforced by the database as well as by the repository.
4. **`CONTENT_DATABASE_URL` selects the store, the same way `PLANNER_DATABASE_URL`
   does.** Set means PostgreSQL and **never** a fallback to the file; unset keeps the
   JSON file (development, tests). It may point at the Planner's database or at its
   own (ADR 0008 §1 preferred two databases for blast radius). Migrations are one
   numbered set in `db/migrations`; each store runs the whole set on the database it
   points at, so tables of the other store may exist there empty. They are cheap and it
   keeps one runner, one `schema_migrations`, one rollback story.
5. **No foreign keys between content entities yet.** `ContentRepository` has no
   "still referenced" rule: deleting a place a story lists is allowed today, and a
   template deliberately outlives the story it was cut from (ADR 0001 §4). A database
   FK would change that behaviour in the same change that moves the storage — the
   mistake ADR 0008 refused. Referential rules are a later, separate decision; the
   `text[]` columns and `validateIntegrity` stay the interim guard.
6. **Seeding stays, under a lock.** `TRAVEL_CONTENT_AUTOSEED` keeps its meaning. With
   Postgres the seed runs while holding a session advisory lock, so replicas starting
   together seed once. A production deployment imports its real content and sets
   `TRAVEL_CONTENT_AUTOSEED=false`.
7. **Moving data is a pair of scripts.** `npm run content:import -- <file>` validates a
   `travel-content.json` with the repository's schemas and inserts it into empty
   tables in one transaction; `npm run content:export -- <file>` writes a file the JSON
   store can open. Export is the rollback path. `npm run db:migrate` migrates every
   database that has a URL set.
8. **Reads and failure.** Per-instance cache validated by `content_revision`, exactly as
   ADR 0009 §2. An unreachable database answers `503 service_unavailable` with no
   driver detail; the public pages, being dynamic, show the error page until it is
   back. There is no silent fallback to stale or file content.

## Options considered

| Option | For | Against |
|---|---|---|
| A: one JSONB `documents` row, as ADR 0008 step 1 | Smallest change, fastest to ship, cheap rollback | Every write rewrites the whole set and holds one lock for it; no constraints or SQL over the content; a bad write can damage everything; the normalised move is still owed |
| **B (chosen): normalised tables behind the unchanged repository** | Row-level writes; keys, enums and indexes in the database; a path to search, audit and targeted reads; the same proven engine as the Planner; one place to grow for years | More work now; a mapping to maintain; still loads all rows on a revision change |
| B′: normalised tables and a rewritten repository doing SQL per method | Targeted queries, smallest reads | Changes every invariant and the storage at once, so a defect has two suspects; weeks of work for a load we do not have |
| C: keep JSON on a shared volume | No code | Does not give multi-instance safety or backups |

The runner-up is **A**. B won on the owner's premise — a long-lived application — and
because the engine already exists: the cost that made B lose in ADR 0008 (rewriting every
repository method) is avoided by keeping the repository and mapping rows instead.

## Consequences

**Easier.** Several app instances behind nginx share content with no lost update.
`pg_dump` backs it up. Slug uniqueness and enum values are enforced by the database.
Search, filtering by status and audit have a place to be built without another storage
migration. The Planner and content stores now share one tested engine.

**Harder.**

- **A revision change reloads all five tables.** One editor's save makes every replica
  reload on its next read. Fine for hundreds of stories; the trigger to move hot reads
  (`getPublicContent`, list endpoints) onto targeted queries is a p95 read above about
  200 ms or a total content size above about 5 MB.
- **One global write lock for the content store.** Two editors saving at once wait for
  each other. Acceptable for staff-only writes.
- **The mapping must follow the schemas.** A new field in `schemas.ts` needs a column or
  it is silently dropped at write — so a round-trip test over every schema field,
  including seed data, fails the build when one is missed.
- **A second secret.** `CONTENT_DATABASE_URL` follows the same rules as
  `PLANNER_DATABASE_URL` (server only, never logged, never in an error).
- **Both stores' tables can exist in one database.** Documented, harmless, and the price
  of one migration set.
- **Reversing.** Cheap until editors start using the database as the only copy: export
  to a file, unset the URL. After that, keep exporting on a schedule.

## Follow-up

1. Engine generalisation and the content mapping, with the Planner suites green first.
2. Migration `0004_content.sql` and its rollback; the store, instance, seeding lock.
3. `content:import`, `content:export`, `db:migrate` for both URLs.
4. Tests: offline mapping and diff, fake-driver protocol, integration (needs
   `TEST_DATABASE_URL`), and the CI Postgres service already present.
5. Docs: feature document, `architecture`, `usage`, the deploy comment about scaling.
6. Later, separate decisions: foreign keys and a "still referenced" rule; targeted reads
   when the trigger above is hit; edit history for editors. `/sec-check` is recommended
   before the first production deploy.
