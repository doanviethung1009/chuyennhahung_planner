# ADR 0024 — Guest identity and privacy (D4): keyed hash, 30-day retention, no raw IP in business tables

🇻🇳 Bản tiếng Việt: [0024-guest-identity-privacy.vi.md](0024-guest-identity-privacy.vi.md)

- **Status:** Accepted (owner confirmed points (a)–(e) on 2026-11-17)
- **Date:** 2026-11-17
- **Owner:** system-architect
- **Affects:** `src/server/planner/repository.ts` (`guestKeyOf`, restriction matching, a retention sweep), `src/server/persistence/postgres-rate-limiter.ts` (key hash), `src/server/planner/schemas.ts`, a migration `0014`, `docs/usage.*` (a secret), privacy documents. Refines, does not edit, [ADR 0015](0015-community-review-author-controls.md) (guest restrictions) and [ADR 0019](0019-community-foundation.md) §3 "Keys".
- **Part of:** Phase 10 batch 10.6b (backlog P10-11); the owner's privacy decision P11-D1 (Q9) in `.claude/roadmap/backlog.md`.

## Context

Anonymous community writes (guest reviews, reports) need an identifier for spam control. Today it is `guestKeyOf(clientKey)` in `src/server/planner/repository.ts`: the first 32 hex characters of an **unsalted SHA-256** of the address taken from a forwarded header. The IPv4 space is small enough to enumerate, so the stored value is in practice a reversible address (`/sec-check` finding #1, backlog P10-11). It is stored in `community_reviews.guest_key`, `review_restrictions.guest_key` and `reports.client_key`; the limiter stores its own unsalted SHA-256 of the same address in `rate_limit_counters` (kept 48 h). Nothing deletes these keys today.

The owner's D4 direction (2026-11-17): HMAC-SHA256 for the guest key; no raw IP in business tables; never expose the key or the secret; keep the anti-spam identifier 30 days; no tracking for advertising; a Privacy Policy and a way to delete data.

What we do not know: the real proxy and log setup on the VM (raw addresses sit in nginx access logs, outside the application), the legal basis and wording of the policy (owner-supplied), and how many guest restrictions are active. **Checked 2026-11-17 on the `cnh_planner` database (owner's query, dev):** 0 active restrictions, 0 `community_reviews.guest_key` and 0 `reports.client_key` values, so the clearing migration changes no data there. Not a statement about any other environment.

## Decision

1. **Keyed hash.** `guestKeyOf` becomes `HMAC-SHA256(secret, clientKey)`, hex, first 32 characters (same column shape). One helper, used by reviews, restrictions, reports **and** the limiter's key hash, so no unsalted hash of an address remains anywhere.
2. **Secret.** A server-only environment variable (name settled in the PR; ≥32 characters like `ADMIN_API_TOKEN`), never logged, returned or committed. If it is missing where guest writes are accepted, those writes fail closed (`503 service_unavailable`); there is no fallback to the unsalted hash. Rotating it resets bans and de-duplication at once; that is accepted, not versioned.
3. **No raw address in business tables.** True today (a hash is stored); this ADR keeps it true and adds no log or column with an address. Raw addresses in infrastructure logs (nginx) are out of the application's control and are stated as such in the policy.
4. **30-day retention.** A guest identifier is cleared 30 days after it was written: `community_reviews.guest_key` and `reports.client_key` set to `NULL` (the review text and the report stay; they follow their own rules). The sweep is opportunistic and batched inside the existing write transactions, like the audit-log sweep, so it needs no scheduler. The limiter counters keep their 48 h.
5. **Guest restrictions fit inside 30 days.** The guest restriction maximum drops from 90 to **30 days** (default stays 30), so the key a restriction holds never outlives the retention limit. When a guest restriction ends (expiry or lift) its key is cleared and the row stays as the record. The `0008` CHECK (`subject='guest' ⇒ guest_key IS NOT NULL`) is replaced in the migration by one that allows a null key once `lifted_at` is set, and the sweep sets `lifted_at` (`lifted_by` = `key expired`) when it clears a key.
6. **Existing keys.** They cannot be re-keyed (the address is not stored), so the migration clears every existing `guest_key` / `client_key` and lifts active guest restrictions with `lifted_by` = `privacy migration`. Not recoverable.
7. **No advertising tracking.** A stated policy principle; no analytics or ad identifier is added by this work. (Not verified against the whole site here; verify before it is published.)
8. **Privacy Policy and deletion are split from the code change.** The policy text and its public page are the owner's (P11-D1); nothing is invented. Members already delete their account (their reviews and terms rows go with it). Guests cannot be found by design after the keyed hash, so their route is the takedown mailbox (`contribution.takedownContact`) naming the place and time, with a staff action that removes the review text; that staff action does not exist yet and is a separate task.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) HMAC + 30-day clear + restriction max 30 days | Meets the owner's wording exactly; one retention number; small change | Staff cannot ban a guest longer than 30 days; rotating the secret resets bans |
| B Keep restriction keys until expiry (up to 90 days) as a stated exception | Keeps ADR 0015's 90-day cap | Two retention numbers; contradicts "30 days" |
| C No key at all for guests (rely on the limiter only) | Nothing personal stored | No per-place de-duplication, no way to restrict a guest |
| D Keep SHA-256, shorten retention only | No secret to manage | Still reversible while it exists |

Runner-up: B. It lost because the owner asked for one 30-day limit, and a guest who returns after 30 days is indistinguishable from a new visitor either way.

## Consequences

Easier: one helper for every anonymous key; a defensible answer to "what do you store about visitors"; a bounded, swept set of identifiers.

Harder, and not free:

- **A secret to provision** on every environment, and a deploy that lacks it blocks guest reviews and reports (by design).
- **Clearing is irreversible**, and the migration ends every active guest restriction once.
- **The 30-day cap** is shorter than ADR 0015's 90 days; ADR 0015 is not edited, this ADR refines it.
- **Anonymous spoofing is not fixed**: the key still derives from a forwarded header (P10-12, owner D10).
- **Real raw-address exposure remains in nginx logs** until the owner decides their retention.
- **Guest deletion on request** needs a staff action that does not exist yet.
- **Reverting** the code leaves cleared keys cleared.

## Follow-up

- Batch 10.6b (`.claude/contracts/phase10-10-6-security-hardening.md`): helper and secret, limiter key, migration `0014` (clear keys, lift active guest restrictions, replace the CHECK), sweep, schema (`guestKey` nullable on a lifted guest restriction), cap 30 days, tests (same client → same key, different secret → different key, old keys not re-derivable, sweep clears at 30 days and not before, restriction matches within its term), `docs/usage.*` for the secret, feature-document Limits.
- Owner (P11-D1): the Privacy Policy text and where it is published; the real nginx log retention; the wording that no advertising tracking is used (after a check).
- Separate task: staff removal of a guest review's text on request. **Done 2026-11-17** (branch `feat/guest-review-erasure`): `community:erase` action, `POST /api/admin/community/reviews/[id]/erase`, in-place anonymisation; see [features/community-reviews.md](../features/community-reviews.md).
- Erasure completion (2026-11-18): the same action also blanks what may quote the text — `reports.note`/`handlerReason`, the `reason` of earlier audit events on the review and on its guest restriction (the single exception to the append-only log, reason text only; see [ADR 0019](0019-community-foundation.md)), and the restriction's reason; `rating` is overwritten with the placeholder 1. Kept on purpose: the `erase` event, event metadata, the restriction's hashed key until it ends (≤30 days), and the reporter's own `clientKey`/`reporterId` (a different data subject). Known limits: a restriction is matched through the review's `guestKey`, so for a review erased before this cleanup its reason stays until the restriction ends; guests who share one key (or one guest with several reviews at a place) share the redaction of that key's restriction reasons — enforcement and expiry are unaffected.
- **Confirmed by the owner on 2026-11-17** (all five, as recommended): (a) guest restriction max 30 days (option A) rather than 90; (b) the migration clears all existing keys and ends active guest restrictions; (c) the limiter key hash moves to the same HMAC; (d) the privacy policy page and the guest-deletion staff action are separate tasks, not part of P10-11; (e) rotating the secret resets bans, unversioned.
