# ADR 0001 — Travel Content System: entities, persistence and admin surface

🇻🇳 Bản tiếng Việt: [0001-travel-content-system.vi.md](0001-travel-content-system.vi.md)

- **Status**: Accepted
- **Date**: 2026-11-08
- **Deciders**: owner (persistence + validation choices), system-architect (contract)
- **Supersedes**: nothing
- **Affects**: `src/server/content/**`, `src/app/api/**`, `src/content/travel/**`

## Context

The brief asked for a Travel Content System with five modules — Travel Stories,
Travel Places, Destination Collections, Travel Reviews and reusable Travel
Templates — and said to *"reuse existing CMS, places and destination tables"* and
*"add migrations only when necessary"*.

That premise does not hold in this repository. As of this ADR there is:

- **no database** — no Prisma, Drizzle, Postgres, SQLite, Supabase, Mongo or Kysely,
  and no migration tooling of any kind;
- **no CMS** — content is typed TypeScript seed modules in `src/content/**`,
  imported directly by server components;
- **no API routes**, **no server actions**, **no auth**;
- **no `Place` entity at all**. `Destination` is a province/region-scale editorial
  entity (8 records: Hà Giang, Sa Pa, Ninh Bình, Huế, Hội An, Đà Lạt, Phú Quốc,
  Mộc Châu) with a single centroid coordinate. It is *not* a GPS-level place.

So there are no tables to reuse. What *can* be reused — and is — are the existing
**entities and their slugs**: `Destination`, `Story`, `Itinerary` and `VideoReview`.

Constraint from `CLAUDE.md` rule 6: the Planner backend is a later phase and
Planner tables/endpoints must not be scaffolded early. The brief likewise says not
to build the AI Planner in this phase.

## Decision

### 1. Persistence: repository layer, no database yet

Entities are defined as typed models behind a persistence-agnostic store
interface (`ContentStore`: `read()` / `write()`), with two implementations:

| Implementation | Used by | Notes |
|---|---|---|
| `createMemoryStore` | tests, previews | seeded per-instance, no I/O |
| `createJsonFileStore` | dev / self-hosted | atomic write (temp file + `rename`), in-process write queue |

`TravelContentRepository` holds all domain logic and invariants and talks only to
`ContentStore`. Moving to SQL later is a **single new adapter** plus a migration
that replays the seed — no change to route handlers, validation or tests.

**No migrations are added in this phase**, per *"migrations only when necessary"*.

**Known limits, accepted deliberately:** the JSON store is safe for a single
Node process only. It serialises writes with an in-process queue, so two
concurrent instances (or a serverless deployment with >1 lambda) can lose a
write through read-modify-write interleaving. It is a development and
single-instance store. Multi-instance deployment is the trigger to pick SQL and
write the first real migration.

### 2. Validation: `zod`

One dependency added (`zod@3.25.76`, the 3.x line — 4.x requires a newer Node
than the 20.14 floor this repo builds on). Every admin mutation is parsed at the
route boundary; domain types are **inferred from the schemas**, so a validator and
its model cannot drift. Unknown keys are stripped, not trusted.

### 3. Entity boundaries — what is reused, what is new

| Module | Entity | Relationship to existing content |
|---|---|---|
| Travel Places | `Place` (new) | **References** `Destination.slug`. Fills the GPS-level gap destinations do not cover. |
| Travel Stories | `TravelStory` (new) | A **richer, publishable successor** to `Story`. See note below. |
| Destination Collections | `DestinationCollection` (new) | Pure curation — holds only slug references to destinations, stories and places. Owns no content of its own. |
| Travel Reviews | `TravelReview` (new) | **Distinct from `VideoReview`**. See note below. |
| Travel Templates | `TravelTemplate` (new) | **References** `Itinerary.slug` as a related tour service and `TravelStory.slug` as its source. Does not replace `Itinerary`. |

**`TravelStory` vs `Story`.** These are not duplicates: `Story` is a flat
marketing-blog record (title, excerpt, `body: string[]`, no status, no SEO, no
cost, no places) rendered by the live `/chuyen-di-choi` routes. `TravelStory`
adds block-based rich content, a gallery, travel dates, integer-VND trip costs,
place/review/itinerary links, a publish lifecycle and SEO metadata. Migrating the
six existing `Story` records into `TravelStory` and repointing the public routes
is a **separate, frontend-owned change** and needs its own ADR — the public
routes are untouched here.

**`TravelReview` vs `VideoReview`.** `VideoReview` is a deliberately link-free
video clip (platform, duration, cover) with no rating and no prose — see the
"keeps video reviews link-free" test. `TravelReview` is a written, rated,
publishable review of a place, destination or itinerary. Different shape,
different purpose; neither replaces the other.

### 4. Blog, templates and user trips stay separate

Three distinct concerns, three distinct entities, no shared mutable state:

- **blog** = `TravelStory` — editorial, published, immutable once public;
- **template** = `TravelTemplate` — reusable, versioned, derived *from* a story
  via an immutable `sourceSnapshot` and never writing back to it;
- **user trips** = **not in this phase.** No user-trip model, table or endpoint
  is created. That is Planner territory (`CLAUDE.md` rule 6).

A template carries `sourceSnapshot`, frozen at creation: the source story's
title, destination, travel dates, actual cost and place slugs *as they were*.
Editing or deleting the source story afterwards never mutates a published
template. `version` increments on every structural mutation.

### 5. Money is integer VND, everywhere

Every monetary field is named `*Vnd`, typed `z.number().int()`, non-negative, and
capped at 10^12 to catch unit errors (e.g. cents passed as đồng). No floats touch
cost accounting. Totals are recomputed from activity costs on write, never
trusted from the client.

### 6. Authorization fails closed

Admin mutations require `Authorization: Bearer <ADMIN_API_TOKEN>`, compared with
`timingSafeEqual`. If `ADMIN_API_TOKEN` is unset or shorter than 32 chars, every
admin route returns `503 admin_auth_unconfigured` — it never falls open to an
unauthenticated default. Public read endpoints serve published/public records only.

## Consequences

**Good.** Ships today with zero infrastructure; `typecheck`, `lint` and `test` all
run offline. Route handlers, validation, invariants and tests are all written
against the interface, so the SQL swap is additive. Existing public pages and the
tour redirects are untouched.

**Bad.** Single-process persistence only (see limits above). No relational
integrity enforcement — referential invariants live in the repository, so a direct
edit of the JSON file can produce dangling slugs; `validateIntegrity()` and the
content tests exist to catch that.

**Follow-ups, each needing its own ADR.** Pick a SQL engine and write the first
migration before multi-instance deploy; migrate `Story` → `TravelStory` and
repoint public routes; expose places on the map; admin UI (frontend-owned).

## Data the owner still has to supply

Per `CLAUDE.md` rule 8, these are left **empty** in seed rather than filled with
convincing fakes:

- `affiliateLinks` on every place — no partner programme is in place yet.
- `TravelReview.author` uses the brand name "Nhà Hưng", not a real staff identity.
- Place `images` and story galleries reuse existing committed cover SVGs; real
  photography is not in the repo.
