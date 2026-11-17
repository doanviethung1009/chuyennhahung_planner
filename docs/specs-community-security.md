# Community Platform spec — security

🇻🇳 Bản tiếng Việt: [specs-community-security.vi.md](specs-community-security.vi.md)

Status: **Proposed**. Labels **[C] [P] [A]**: see
[specs-community-overview.md](specs-community-overview.md). This is a design-time threat
model, not a review. A `security` review of the **existing** community surface ran on 2026-11-16 (PASS_WITH_WARNINGS; findings are backlog items P10-11 to P10-16); it did not cover this design. For the new phases the reviewer has **NOT RUN**; it is recommended before Phases 13 and 14 and runs only when the owner asks (`/sec-check`).

Finding status (batch 10.6a): P10-15 closed (server gate `contribution_closed`), P10-16 closed (reserved-name filter), P10-12 closed in code/tests with the real VM proxy check left to the owner (D10); the global hourly cap was evaluated and not added. P10-11 (HMAC `guestKey`) stays open, blocked on D4 (batch 10.6b).

## Goals and scope

Say who may do what, who owns what, what is private, and how abuse is limited, for every
Community Platform feature. Out of scope: changes to sign-in, MFA, or the admin token model.

## Requirements

- **S1** RBAC through the pure `can(identity, action, resource)`; new actions are added to
  `ROLE_ACTIONS` in `src/server/identity/permissions.ts`, never checked ad hoc. [C]
- **S2** Ownership is enforced in the repository, filtered by `ownerId`/`authorId`, as for
  trips today; a non-owner gets `404`. [C]
- **S3** Public projections are allow-lists with enumerating tests. [C]
- **S4** User text is rendered as text; rich text is a block document rendered by React,
  never `dangerouslySetInnerHTML` of user input. [P]
- **S5** Anonymous means anonymous: no field, URL, notification or log line exposed to
  other users carries the author's id, email or handle. [C] (ADR 0014)
- **S6** Preferences, saved items and notifications are private to their owner. [P]
- **S7** Write endpoints are rate-limited by a **shared** store and by user, not only by a
  spoofable client key. [P]
- **S8** Every moderation or restriction action is logged with its actor. [P]
- **S9** Secrets stay server-side: storage credentials never reach a Client Component
  (`tests/client-boundary.test.ts` precedent). [C]

## Design

### Roles and ownership

| Resource | Owner | Others |
|---|---|---|
| Draft trip, draft journal, unpublished asset | Author | Staff may read in the queue; nobody else |
| Published item | Author | Everyone reads; only staff take down |
| Copy of a trip | The copier | The source's author has no access to it |
| Profile | The user | Public only if the user chose a public slug |
| Saved list, preferences, notifications | The user | Nobody, including staff |
| `AuditEvent` (`audit_events`) | Staff | The author sees events on their own items |

`service` principal (`ADMIN_API_TOKEN`) may moderate but never authors, and never reads
private drafts. `trip:support-read` stays denied (ADR 0006).

### Threat model (summary)

| Threat | Vector | Control |
|---|---|---|
| Stored XSS | Journal body, comment, title, bio | Block document, text rendering, strict validation, CSP; no HTML input path |
| Malicious file | Upload of a polyglot or oversize image | Magic-byte check, full re-encode, pixel and byte caps, quarantine key |
| Location leak | GPS in EXIF | Metadata stripped by re-encode; proven by a fixture test |
| Deanonymisation | Anonymous author exposed through a clone `origin`, a notification, a sitemap or an API field | `origin` and payloads built from the allow-list; test enumerates all public bodies |
| Enumeration | Probing ids of private drafts | `404` for non-owners; random ids |
| IDOR on media | Guessing a storage key | Keys are unguessable, unpublished served only by signed URL |
| SSRF | Server fetching a user-supplied URL (video) | Never fetched; only parsed to provider and id |
| Clickjacking, mixed embeds | Third-party iframes | `frame-src` allow-list, click-to-load, privacy-enhanced hosts |
| Spam and brigading | Mass comments, mass reports | Shared limiter, per-user caps, restriction (ADR 0015), report dedupe, threshold only holds comments |
| Copy farming, scraping | Bulk clone or crawl | Daily copy cap, public read limiter, `robots` for non-published |
| CSRF | Cross-site mutation | `requireSameOrigin` on every cookie-authenticated write |
| Account takeover amplification | A stolen session publishing | Publishing is still curated; password change forces re-auth (existing) |
| Insider abuse | Staff removes or reads too much | Action log, `community:restrict` stays admin-only |
| Personal data in public text | Phone numbers or addresses in notes | Report reason, staff review, contribution terms (owner task) |
| Defamation, copyright | Third-party claims | Takedown contact is a go-live gate (`contributionOpen`) |

### Privacy

Personal data added: profile bio and avatar (public only if chosen), preferences, saved
items, follows, notifications. Rules: opt-in, deletable, never in logs, covered by the
owner's privacy statement; hard-deleting an account removes or anonymises everything.
No analytics, no tracking pixels, no third-party fonts or embeds loaded before consent.

## Flows and failure states

| Situation | Behaviour |
|---|---|
| Restricted user writes | Refused with the existing restriction message; reads still work |
| Report abuse (one user reporting everything) | Reports from that user rate-limited, then ignored by the threshold, still logged |
| Storage credential leak | Rotate; assets are re-signed; no credential is in the repository or logs |
| Account deleted | Public items hidden at once; purge after the retention window |

## Dependencies and security

Depends on the shared rate-limit store, the CSP update for video hosts, and the
contribution gate. New runtime dependencies (editor, image library) are supply-chain
decisions needing ADRs and an `allowScripts` review.

## Test scenarios

Route × role matrix; `can` matrix extended for new actions; ownership `404`s; XSS corpus in
every user-text field renders inert; GPS fixture; anonymity enumeration test on every
public and notification body; CSRF on each write; limiter holds across two simulated
instances; secrets absent from client bundles.

## Open questions

| # | Question | Recommended |
|---|---|---|
| 1 | Should publishing require a verified email once an email sender exists? | Revisit then |
| 2 | Must staff accounts with `community:moderate` have MFA? | Decide before Phase 14 (PR #107 Q6 defers MFA and records the risk); MFA is not built |
| 3 | Public profile slug: independent of `handle`? | Yes |
| 4 | Terms Article 3 already covers copying when the creator turns it on. Which default for the per-trip copy switch, and may a copy be republished or only used personally? | Switch off by default; owner decides the republish scope before Use this trip ships; counsel reads Article 3 against the feature (risk RK16) |
