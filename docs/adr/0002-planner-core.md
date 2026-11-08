# ADR 0002 — Planner core: trips, days, activities, expenses

🇻🇳 Bản tiếng Việt: [0002-planner-core.vi.md](0002-planner-core.vi.md)

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: owner (opened the phase), system-architect (contract)
- **Supersedes**: nothing. Opens the phase [ADR 0001](0001-travel-content-system.md) §4 deferred.
- **Affects**: `src/server/planner/**`, `src/server/persistence/**`, `src/app/api/planner/**`, `src/app/api/admin/planner/**`

## Context

The owner opened the Planner backend phase and asked for the core of a trip
planner: CRUD on trips, days generated from the trip length, activities drawn
from the place catalog or invented, reordering and moving activities between
days, a target budget against estimated and actual cost, save and restore, and
cloning an approved template. The worked example is **Đà Lạt, 3 ngày 2 đêm, 2
người, ngân sách 5.000.000 VND, phong cách lãng mạn**.

The brief specified the implementation in terms this repository does not have.
It asked to keep "the existing ORM", to store money as Postgres `BIGINT`, and to
follow "the existing migrations". As of this ADR there is still no database, no
ORM and no migration tooling — exactly as [ADR 0001](0001-travel-content-system.md)
§1 recorded. Persistence is a repository over a JSON document store.

Two other gaps mattered more than the storage question.

**There is no user.** [ADR 0001](0001-travel-content-system.md) §6 gave the
content system one principal: the `ADMIN_API_TOKEN`. That is enough for
editorial records, which all belong to the brand. It is not enough here, because
the central requirement of a trip planner is that one traveller cannot reach
another traveller's trip — and "object-level authorization" needs an object owner
to check against.

**`CLAUDE.md` rule 6 forbade exactly this work** until the owner opened the
phase. They have now opened it, so the rule is satisfied rather than overridden.
Rule 2 and the ADR index both require a record before route topology and data
contracts change, which is this document.

## Decision

### 1. Persistence: four normalised collections behind the existing store interface

The Planner is built on the architecture that is here, not on the one the brief
assumed. `PlannerRepository` holds every invariant and talks only to a
`DocumentStore`, so the SQL swap stays a single new adapter.

Two things changed to make that honest rather than a copy-paste:

- The atomic-write-plus-queue logic was extracted from `content/store.ts` into
  [`src/server/persistence/json-store.ts`](../../src/server/persistence/json-store.ts)
  and is now generic. The content store is a thin typed wrapper over it, with
  its exported signatures unchanged. Subtle persistence code now exists once.
- The Planner keeps a **separate document** (`.data/planner.json`, override with
  `PLANNER_STORE`). Traveller data and editorial content have different privacy,
  retention and backup profiles; one file would mean one lock and one blast
  radius for both.

Inside that document the four collections are **normalised** — flat arrays with
foreign keys, not days nested inside trips, which is how the content system
models template days. They are the four tables this becomes, and the two
operations the brief asks for most loudly — moving an activity between days, and
attaching an expense to an activity — are cheap on a flat shape and awkward on a
nested one.

Day numbers and activity orders are **never stored state the client supplies**.
Days are always 1..n with no gaps; activities are 0..m with no gaps; both are
re-derived from position on every mutation.

### 2. User-generated text is not localized content

`CLAUDE.md` rule 1 — nothing ships in one locale only — governs **product copy**:
strings the app renders. A trip title is something a traveller typed, in their
own language. Demanding a Vietnamese *and* an English version of it would be
nonsense, so trip, day, activity and expense text are plain strings, not
`localizedText`.

Every Planner string the *app* renders still lives in both message catalogues.
Cloning a template collapses its `localizedText` to the Vietnamese side, because
the clone is now the traveller's own text and no longer editorial content.

### 3. Identity: a real trip owner, because authorization needs one

A `plannerUsers` collection holds a traveller and a SHA-256 digest of a 48-byte
access token. The token is returned **once**, when an admin provisions or rotates
it, and is never stored or returned again. Comparison is `timingSafeEqual` over
the fixed-width digest, with no early exit from the candidate loop.

Division of authority is deliberate:

| Principal | Can | Cannot |
|---|---|---|
| `ADMIN_API_TOKEN` | create, list, rotate, delete travellers | read or edit **any** trip |
| A traveller's token | everything on their own trips | see that another trip exists |

Cross-owner access answers **404, not 403** — the same stance
`getPublishedStory` takes on an unpublished story. A 403 would confirm the id
exists to someone who may not see it.

This is an interim identity model, chosen to keep the existing bearer-token
convention rather than to anticipate a session system. What it buys is the part
that is expensive to retrofit: every trip carries an `ownerId` and every read and
write is filtered by it. Replacing the token with a real session changes how
`PlannerIdentity` is obtained and touches nothing below it.

### 4. Cloning a template produces an independent snapshot

Cloning reads an **approved** template — `visibility: 'public'`, the content
system's existing notion of approved — and writes entirely new rows owned by the
new trip. No id is shared. Editing, moving, repricing or deleting anything in the
clone cannot reach the template; editing the template later cannot reach the
clone.

That is enforced structurally, not by discipline: the Planner's only window onto
editorial content is
[`PlannerCatalog`](../../src/server/planner/catalog.ts), a read-only interface
with three lookups and no writer. `trip.sourceTemplate` records provenance —
slug, title, and the template's `version` at clone time, so staleness stays
visible — and is never read back to re-derive the trip.

Cloned activities are recorded as whole-party costs, because a template's figures
describe the party the template was written for as one bill, not a rate per head.

### 5. Money: integer đồng, with a BigInt boundary for the SQL that comes later

`vndSchema` from the content system is reused unchanged: integer đồng, never a
float, never a minor unit, capped at 10^12. The brief's `BIGINT` requirement is
honoured by making the mapping explicit and safe rather than by pretending
Postgres is present. The cap sits far below `Number.MAX_SAFE_INTEGER`
(≈9.007×10^15), so every legal amount survives a `BIGINT` round trip exactly.

[`money.ts`](../../src/server/planner/money.ts) is the boundary a SQL adapter will
need and the one the brief asked for:

- `normalizeVnd` accepts `number | bigint | string` — the three shapes a `BIGINT`
  driver actually delivers — and refuses anything a double cannot represent
  exactly. A `bigint` is range-checked **as a BigInt**, before conversion, because
  `Number(huge)` rounds first.
- `jsonSafe` deep-converts `bigint` on the response path, so introducing such a
  driver cannot turn a 200 into a 500 (`JSON.stringify` throws on a raw `bigint`)
  or silently start emitting `"5000000"` where a number was promised.
- `sumVnd` and `scaleVnd` check the running total, not just the inputs.

Three totals are tracked and **two of them are never added together**:
`targetTotalVnd` (what we meant to spend), `estimatedTotalVnd` (activities only)
and `actualTotalVnd` (expenses only). An activity estimate and an expense are two
descriptions of the same money at different times, so summing them would report
560.000₫ for one 310.000₫ coffee that was planned at 250.000₫.

`projectedTotalVnd` is the single figure that mixes them, and it does so without
double counting: an activity whose id appears on an expense is **settled** and
contributes nothing further, so the projection is every payment made plus the
estimate of every activity not yet paid for. That is why `TripExpense.activityId`
exists. Every money row carries a `costScope` of `group` or `per_person`, and a
per-person amount is multiplied by the party size exactly once, on its way into a
total.

### 6. Concurrency: one version per trip aggregate, enforced with If-Match

`trip.version` advances on every mutation anywhere in the aggregate — the trip
row, a day, an activity, an expense. A trip response carries it as an `ETag`;
mutations send it back as `If-Match`.

- Missing on a mutation of existing state → **428**. Two tabs editing one trip
  would otherwise both write, and the slower would win silently.
- Stale → **412**, and the write is refused whole, never partially applied.
- Appends (adding an activity or an expense) treat it as optional, because an
  append cannot overwrite anyone's edit — but verify it when it is sent.

One counter for the whole aggregate, rather than one per row, is what makes an
edit based on a stale reading of *any* part of the trip detectable.

### 7. Scope held: no map, no AI

The brief said to add neither in this round, and neither is here. `DELETE` on a
trip **archives** it; `POST /restore` brings it back; permanent deletion needs a
second, explicit `?purge=true` request against an already-archived trip. Nothing
a traveller can reach in one request destroys a plan.

## Consequences

**Good.** Ships on the infrastructure that exists; `typecheck`, `lint` and `test`
all run offline. Ownership, validation, concurrency and the budget rules are
expressed in the repository and covered by 65 tests, so the SQL swap is additive
rather than a rewrite. The demo scenario and the template clone are tested
against the real seeded content, not fixtures.

**Bad.** Single-process persistence, inherited from
[ADR 0001](0001-travel-content-system.md) §1 — the in-process queue serialises
writes within one Node process and cannot across two, so multi-instance
deployment remains the trigger for SQL. Optimistic concurrency therefore protects
against two *users* racing, not against two *instances* racing. The identity
model is interim and has no self-service signup, password reset or session
expiry; an operator provisions every traveller by hand. There is no referential
integrity below the repository, so a hand-edited JSON file can still produce a
dangling reference — the Planner has no `validateIntegrity()` sweep of its own
yet, which is the most obvious gap left.

**Follow-ups, each needing its own ADR or its own phase.** A real session or
identity provider; the SQL engine and the first migration; a Planner integrity
sweep; the Planner UI, which is frontend-owned and not started; map and AI
suggestions, explicitly deferred by the brief.

## The SQL shape this becomes

Recorded now, while the reasoning is fresh, so the first migration is a
transcription rather than an archaeology exercise.

| Collection | Table | Money columns | Indexes the migration must create |
|---|---|---|---|
| `users` | `planner_users` | — | `unique(handle)`, `unique(token_hash)` |
| `trips` | `trips` | `budget_target_vnd BIGINT` | `(owner_id, status)`, `(owner_id, start_date)` |
| `tripDays` | `trip_days` | — | `unique(trip_id, day_number)` |
| `tripActivities` | `trip_activities` | `estimated_cost_vnd BIGINT` | `unique(trip_id, day_id, "order")`, `(place_slug)` |
| `tripExpenses` | `trip_expenses` | `amount_vnd BIGINT` | `(trip_id)`, `(activity_id)`, `(trip_id, paid_on)` |

Every `ownerId`, `tripId`, `dayId` and `activityId` becomes a foreign key.
`trips.version` becomes the optimistic-lock column, and the `If-Match` check
becomes `UPDATE … WHERE id = $1 AND version = $2`, with a zero row count raising
the same 412. `costScope` and `category` become enums or check constraints.

## Data the owner still has to supply

Per `CLAUDE.md` rule 8, these are deliberately absent rather than filled with
convincing defaults:

- **Traveller accounts.** None are seeded. A seeded demo trip would be a trip
  owned by nobody, and the one invariant that matters here is that every trip has
  an owner. The Đà Lạt demo lives in
  [`tests/planner-acceptance.test.ts`](../../tests/planner-acceptance.test.ts).
- **`ADMIN_API_TOKEN`** must be set to a real secret of at least 32 characters
  before any traveller can be provisioned. Unset, the admin routes answer 503.
- **Retention policy.** Archived trips are kept indefinitely; nobody has said for
  how long traveller data should be held, so nothing expires it.
