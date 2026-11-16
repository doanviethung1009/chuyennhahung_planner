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
| [specs-roadmap.md](specs-roadmap.md) | Spec: project phases at a glance — status table, decision timeline, what is not open yet, what still needs the owner |
| [specs-product.md](specs-product.md) | Spec: product and capabilities — purpose, audiences and roles, capability and API-surface tables, the rules every change keeps |
| [usage.md](usage.md) | Install, run, test, verify, deploy, and the day-to-day workflows |
| [travel-content-api.md](travel-content-api.md) | Travel Content System API contract — endpoints, conventions, error codes, invariants |
| [runbook.md](runbook.md) | Runbook: where to start — which guide answers which question, quick checks, and the list of every API endpoint; shown to admins at `/quan-tri/runbook` |
| [deploy-operations.md](deploy-operations.md) | Runbook: running the deployed app — checks, logs, restart, backup and restore, secret rotation, disk, upgrades, incidents |
| [deploy-runbook.md](deploy-runbook.md) | Runbook: one linear guide from a blank VM to the app running and auto-deployed — layout choice, host, `.env`, database, runner, first deploy, troubleshooting |
| [deploy-database.md](deploy-database.md) | Runbook: move the JSON data to PostgreSQL on a separate VM — role, TLS, migrate, import, verify, backup, rollback |
| [deploy-runner.md](deploy-runner.md) | Runbook: install the self-hosted deploy runner on the dev VM as a hardened systemd service — user, ACLs, registration, unit hardening, checks |
| [runbook-google-sign-in.md](runbook-google-sign-in.md) | Runbook: turn on and operate Google sign-in on the dev VM — redirect URI, `.env`, rollout through deploy, checks, errors, rollback |
| [runbook-api.md](runbook-api.md) | Runbook: operate the APIs on the dev VM — families and credentials, smoke test after deploy, failure table, operator calls, rollback |

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
