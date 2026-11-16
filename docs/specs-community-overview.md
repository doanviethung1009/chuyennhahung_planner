# Community Platform spec — overview

🇻🇳 Bản tiếng Việt: [specs-community-overview.vi.md](specs-community-overview.vi.md)

Part of the Community Platform spec set. Status: **Proposed** — nothing here is built.
Date: 2026-11-16. Siblings: [architecture](specs-community-architecture.md) ·
[database](specs-community-database.md) · [API](specs-community-api.md) ·
[frontend](specs-community-fe.md) · [media](specs-community-media.md) ·
[moderation](specs-community-moderation.md) · [security](specs-community-security.md) ·
[QC](specs-community-qc.md) · [roadmap](specs-community-roadmap.md). The earlier,
narrower direction note is [specs-planner-personalization.md](specs-planner-personalization.md);
this set supersedes its community half and keeps its personalization half.

**Labels used in every spec:** **[C]** confirmed by the owner or an accepted ADR ·
**[P]** proposed here, needs a decision · **[A]** assumption, not verified in the repository.

## Goals and scope

### Vision

Grow Chuyện Nhà Hưng from a travel blog plus Planner into a curated community where a
traveller can plan privately, publish journals and vlogs, discover other people's
trips, copy one into their own account, and follow the authors they trust. The brand
stays the centre: curated, warm, Vietnamese first.

### In scope

Public/private trips, draft/published content, personal clone with attribution, journal
/ blog / vlog posts, media, profiles, follow, like, save, comment, report, search and
discovery, notifications, curated moderation, and the phases to deliver them.

### Out of scope

Paid or promoted placement, direct messages, live streaming, a marketplace, collaborative
filtering on behavioural data, Planner map and AI suggestions (both still closed, see
[roadmap](specs-roadmap.md#not-open-yet)), and any change to Phases 00–09.

## Requirements

### Confirmed decisions

| Item | Decision | Label |
|---|---|---|
| Moderation | Curated: long-form public content is reviewed before it goes live | [C] |
| Review scope | Curated for trips, journals, blogs, vlogs. Short place reviews keep ADR [0014](adr/0014-community-trips-and-reviews.md)/[0015](adr/0015-community-review-author-controls.md): live at once, staff remove | [C] 2026-11-16 |
| Media | Hybrid: own storage for images, an external platform for video | [C] |
| Clone | Personal: an independent copy owned by the cloner | [C] |
| Delivery | By phase, never all at once | [C] |
| Agents | Single agent by default, at most two at once, narrow context | [C] |
| Roadmap identity | Phases 00–09 in `.claude/roadmap/PHASES.md` are unchanged (05 Story to Planner, 06 AI Planner, 07 Admin, 08 Media, 09 Production); community work is **Phase 10–15** (PR #107); C1–C7 are spec groups only, see [roadmap](specs-community-roadmap.md) | [C] |

### Functional requirements

| ID | Requirement | Label |
|---|---|---|
| F1 | A trip is private by default; the owner can share a link and separately ask to publish it to the community | [C] (ADR 0005, 0014) |
| F2 | Published content has an author, a state machine and a takedown path | [P] |
| F3 | "Use this trip" copies a published trip into the cloner's private draft; nothing syncs back | [C] |
| F4 | Journal, blog and vlog posts with rich text and media | [P] |
| F5 | Profile, follow/unfollow, like, save, comment, report | [P] |
| F6 | Search, filter and discovery over published content | [P] |
| F7 | In-app notifications (from Phase 15) | [P] |
| F8 | Staff can approve, reject, request changes, unpublish and remove | [P], extends ADR 0014 |

### Non-functional requirements

| ID | Requirement | Label |
|---|---|---|
| N1 | Vietnamese first; every string in VI and EN; Vietnamese diacritics searchable | [C] |
| N2 | Runs on the current single-VM Docker stack with a separate PostgreSQL VM; 16 GB RAM budget | [A] |
| N3 | No new tracking, no third-party analytics | [P] |
| N4 | Server components by default; no new runtime dependency without an ADR | [C] (CLAUDE.md) |
| N5 | Every public projection is an allow-list with a test | [C] (ADR 0005, 0014) |
| N6 | Each phase is reversible: stored data stays inert when a route is removed | [C] (ADR 0014) |

## Repository assessment

Read on 2026-11-16 from `main` (e362aea); paths are real.

| Area | Finding | Evidence |
|---|---|---|
| Stack | Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, next-intl 4, zod 4, `pg`. Runtime dependencies are only `next next-intl pg react react-dom zod` | `package.json` |
| Rich text, upload, image processing | **None.** No editor, no storage SDK, no image library. Remote images allow only `images.unsplash.com` | `package.json`, `next.config.ts:53` |
| Stores | Planner store (users, sessions, trips, reviews) and Travel Content store; each on PostgreSQL or a JSON file; no foreign keys | ADR 0009, 0013; `db/migrations/0001`–`0009` |
| Identity | Session cookie; password, Google, handle sign-in; roles `member/editor/admin/super_admin`; pure `can()` | `src/server/identity/permissions.ts`, ADR 0006/0007/0017/0018 |
| Moderation | `community:moderate` for editor and up; `community:restrict` for admin and up; no `moderator` role | `permissions.ts:12-50` |
| Community today | Trip listing (`none/pending/approved/rejected`), place reviews, review restrictions, staff queue | ADR 0014/0015, migrations `0005`–`0008` |
| Sharing | `visibility`, share token, `SharedTripView` allow-list, `duplicateTrip` (owner's own trip only) | ADR 0005, `repository.ts:1329` |
| Rate limiting | In-memory, per process; the client key is a forwarded header, spoofable unless the proxy overwrites it (nginx overwrite is configured and tested in `tests/deploy-config.test.ts`, real VM config still to confirm, P10-12) | `src/server/rate-limit.ts`, ADR 0005 |
| Notifications, follow, like, comment, report, search | **None** | grep over `src`, `db/migrations` |
| Email sender | **None** (blocks reset-by-email and email notifications) | [specs-roadmap.md](specs-roadmap.md#not-open-yet) |
| Contribution gate | **Open**: terms and a takedown contact are filled; PR #107 Q8 asks the owner to confirm the contact is a monitored mailbox | `contributionOpen`, `src/content/site.ts:102` |
| Deploy | Docker, nginx, app VM and a separate PostgreSQL VM; auto deploy ran end to end on the dev VM (report 2026-11-15, before PR #93–#105) | [deploy-runbook.md](deploy-runbook.md), ADR 0016 |
| Cloudflare Tunnel, Proxmox | Not mentioned in the repository; taken from the owner's brief | [A] |

## Gap analysis

| Need | Have | Gap |
|---|---|---|
| Publish a trip | Listing, staff approval, re-queue on edit | Draft/published distinction, `changes_requested`, unpublish by author |
| Use another's trip | Clone from story/template; duplicate own trip | Clone from a published community trip, with attribution |
| Journal, blog, vlog | Staff-edited stories only | New user-owned entity, editor, renderer, moderation |
| Media | Generated SVG covers, Unsplash | Upload pipeline, object storage, thumbnails, quotas, scanning |
| Profile, follow, like, save, comment | `displayName`, `handle` | All of it, plus reports and notifications |
| `moderator` role | Editors hold `community:moderate` | Separate role needs an ADR (ADR 0006 deferred it) |
| Shared rate limiting | Per process | Shared store before several instances or abuse-prone writes |
| Audit trail | None | `audit_events` (Phase 10, P10-1); also closes the audit-log gap |
| Search | None | Postgres full-text with Vietnamese unaccented matching |

## Dependencies and security

Depends on: the trip editor (Phase 04), sharing and cloning (Phase 05), PostgreSQL persistence (all new tables), Phase
07 roles and the admin portal (moderation queue), the contribution gate (it must stay open). Security
detail is in [security](specs-community-security.md); the headline risks are user-written
HTML (answer: structured blocks, never raw HTML), image metadata leaking GPS (answer: strip
EXIF on re-encode), and a per-process rate limiter (answer: shared write limiter in Phase 10).

## Test scenarios

Owned by [QC](specs-community-qc.md). Overview-level acceptance: with no new community data, every existing page behaves as on `main`.

## Open questions

| # | Question | Recommended |
|---|---|---|
| 1 | Is Cloudflare Tunnel in front of the app today, and is Proxmox the only host? | Confirm; media design assumes both |
| 2 | Which existing handle policy applies to public profiles (ADR 0018)? | Separate opt-in public slug |
| 3 | Does the owner want a `moderator` role now or editors for the first phases? | Editors until Phase 15 |
