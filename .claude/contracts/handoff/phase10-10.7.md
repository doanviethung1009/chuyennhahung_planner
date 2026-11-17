# Handoff — batch 10.7 DEV smoke + phase close (P10-4)
Branch `docs/phase10-close` (worktree `claude/phase10-close-6c517b`; nothing committed/pushed). Docs only, 0 subagents. Host `http://192.168.100.140` (HTTP, LAN), 2026-11-17, main = `b98f75c`.

## Preflight
- PASS CI on main for #132 (success). PASS "Deploy dev" for #132 (run 44019228529, success).
- PASS `GUEST_KEY_SECRET` present on VM: PG limiter answered 422/429, not 503 (the limiter hashes with the secret). Value never read.

## Smoke (no personal data, no accounts created)
- PASS `/chuyen-di-cong-dong` (`/community-trips`) and `/goc-review` (`/reviews`): 200, one `<h1>`; VI paths 307-redirect from EN slugs as routed.
- PASS `GET /api/community/trips` 200 with items; `/api/community/reviews` 200 (empty list).
- PASS admin gated: `/quan-tri/cong-dong` → 307 to sign-in; `/api/admin/community/reports` 401; `/api/planner/terms` 401.
- PASS `POST /api/community/reports` `{}` → 422 `validation_failed` (honest schema errors, nothing written).
- PASS limiter 429: 10th request in the day → 429, `Retry-After` 69142 s, same from the 11th.
- NOT RUN limiter survives app restart: no VM access from here (counter is PG-backed per code + `postgres-rate-limiter` tests).
- PASS Report button 375/768/1280: 90×44 px, dialog fits, no horizontal overflow, focus moves into the dialog, honeypot `aria-hidden`/tabindex -1.
- NOT RUN Terms accept control at 375/768/1280 and the Terms gate block→allow: needs signed-in session.
- NOT RUN admin community tabs/queues (listing queue, reviews, restrictions, events, reports) and UI at 3 widths: needs admin sign-in.
- NOT RUN request → approve → remove audit events; a report filed then resolved: needs member + admin sessions (covered by tests only).
- NOT RUN guest review 429 (3/h): not probed, the shared limiter is proved through `report`.
- Side effect: my LAN IP is now rate-limited for reports on dev for ~19 h (dev only).

## Owner items (status only)
- P10-7 OPEN: backup, `metadataBase` not checkable here; HSTS header present on the HTTP response (HTTPS not verified). D10 OPEN (nginx real logs/tunnel). D5 OPEN (Terms text). `deploy/.env.example` still needs `GUEST_KEY_SECRET=`.
- Open tasks: Privacy Policy page, staff removal of a guest review, publication states + gallery filters.

## Reviews: `/qc-check` NOT RUN (recommend whole phase) · `/sec-check` NOT RUN (recommend anonymous write path: reports, limiter, guest key).

## Checks: see final report (typecheck / lint / test).
