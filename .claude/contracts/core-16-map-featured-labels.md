# Task Contract: CORE-16 Map labels only for featured destinations
- Class: M (one optional data field, one component branch, tests, 2 doc twins; no API, route, schema or migration). Written to file because the owner asked for it.
- Desired outcome / user impact: at 375px the `full` map (`/map`) no longer shows overlapping name labels in dense clusters (Hà Nội / Ninh Bình / Hạ Long; Huế / Hội An / Đà Nẵng). Only "featured" destinations keep a permanent label; every other pin shows its name as a tooltip on hover/focus (same as `preview`), and the name stays in the `<a>` accessible name.
- Scope IN: `src/content/types.ts` (`featured?: boolean` on `Destination`, doc comment); `src/content/destinations.ts` (set the flag on the owner-approved list); `src/components/map/vietnam-map.tsx` (label logic); `tests/map.test.ts` (render tests); `docs/features/travel-map.md` + `.vi.md` (describe the label rule, same headings); handoff file.
  Scope OUT: 44px target and pin geometry from PR #191 (unchanged), `project()`/`pinRadius()`, `preview` variant (already tooltip-only), messages (no new strings), routes, API, persistence, ratings/"hotness" metric.
- Base: PRs #191 and #194 are MERGED; this branch is rebased onto `origin/main` (09ee8c3), nothing extra carried over. Build on #194: pin box sized via `MAP_TARGET_PX` (`style`), `labelSide(x)` in `src/lib/map.ts` picks the label side (do not re-add inline flip logic), `tests/map.test.ts` already uses `renderToStaticMarkup` for both variants — extend it.
- Evidence:
  - `Destination` (`src/content/types.ts:14`) has `visits?` and `firstVisited?` only; no rating/hotness. `Story`/other content already use a `featured: boolean`, so the name is consistent.
  - `VietnamMap` (`vietnam-map.tsx`): `showLabels = variant === 'full'` → every pin renders a permanent pill label; `preview` renders `sr-only` name + a CSS hover/focus tooltip.
  - Users of `VietnamMap`: `src/app/[locale]/map/page.tsx` (full) and `src/components/sections/map-preview.tsx` (preview).
  - Measured projected spacing at 375px (map ≈343px wide, scale 343/420), dx/dy px between pins: Đà Nẵng–Hội An 5/7, Đà Nẵng–Huế 24/17, Đà Lạt–Nha Trang 29/12, Hà Nội–Mộc Châu 47/8, Hà Nội–Quảng Ninh 51/5, Phú Quốc–Cần Thơ 69/8. A label is ≈60–80px wide × 20px tall, so these all collide today.
- Impact check — every place `Destination` is used:
  - Data is static TypeScript (`src/content/destinations.ts`), not stored in the Travel Content store. `src/server/content/repository.ts` only reads slugs (`destinations.map(d => d.slug)`) for reference checks; `src/server/content/schemas.ts` and `src/server/planner/schemas.ts` validate slugs, not Destination objects. API, admin editors (`place-editor`, `story-editor`, `content-create`), planner `catalog.ts`/`repository.ts`, JSON/PostgreSQL stores: no Destination object is persisted.
  - Conclusion: **no migration, no validator/schema change, no API change.** The field is optional, so existing entries and `tests/destinations-unvisited.test.ts` (asserts `firstVisited`/`visits` absent on unvisited ones) stay valid. `featured` is independent of visited status (an unvisited big city such as Hà Nội can be featured and stays a factual entry per CLAUDE.md rule 8).
- Interface contract: `Destination.featured?: boolean` (default false). `VietnamMap` props unchanged. Label rule: `variant === 'full'` and `destination.featured` → permanent pill label (as today). Everything else → `sr-only` name span + tooltip (hover/focus) so the accessible name is unchanged. Tooltip shown with `group-hover`/`group-focus-visible` (reuse the `preview` markup; extract one shared tooltip element, no duplication). A featured pin in `full` still flips its label side via `labelSide`.
- Proposed featured list — **NEEDS OWNER CONFIRMATION (rule 8, this is owner data; I do not decide it)**. Basis: city scale and `visits`, then avoiding label collisions at 375px:
  | slug | why | visits |
  |---|---|---|
  | `ha-noi` | capital, north anchor | — (unvisited) |
  | `da-nang` | central hub; chosen over Hội An (5px away) and Huế (24px) | — |
  | `tp-ho-chi-minh` | largest city, south anchor | — |
  | `sa-pa` | top northwest destination | 4 |
  | `ha-giang` | signature trip, far from the others | 3 |
  | `da-lat` | most-visited (6); Nha Trang (29px) falls back to tooltip | 6 |
  | `phu-quoc` | island, clear of other labels | 1 |
  Left to tooltip: Ninh Bình (5 visits, but 33px under Hà Nội), Huế, Hội An, Mộc Châu, Quảng Ninh, Quảng Bình, Quy Nhơn, Nha Trang, Cần Thơ. Alternatives the owner may prefer: swap Phú Quốc for Huế/Hội An (central coast then needs one of Đà Nẵng out), or add Ninh Bình (accept ~33px vertical gap to Hà Nội). 7 permanent labels is the proposed ceiling.
- Constraints / dependencies: Tailwind v4 tokens only; no new dependency; no new strings; keep `ul > li > a`, no JS; 44px anchor box untouched; no ADR (no route/contract change).
- Tasks by owner: Architect — this contract. FE — types, seed flag, component, docs twins, tests. BE — none. QC/Security/Git — on demand only (NOT RUN).
- File ownership: single agent (main session), files listed in Scope IN only.
- Acceptance criteria / tests:
  - New vitest (`renderToStaticMarkup`, already used in `tests/map.test.ts`): in `full`, only featured slugs have a visible (non-`sr-only`) label span; non-featured have `sr-only` name + tooltip span; every `<a>` still contains the destination name; `preview` unchanged (no permanent label); the exact set of featured slugs equals the confirmed list; every featured slug exists.
  - Browser (`preview_start chuyen-nha-hung-dev`, stop the server afterwards): at 375 and 768, no two permanent labels' `getBoundingClientRect` overlap on `/map`; keyboard Tab onto a non-featured pin shows its tooltip (`:focus-visible` opacity 1) and the focus ring; 44×44 anchors still hold.
  - `npm run typecheck`, `npm run lint`, `npm run test` PASS with output stated. Docs: `tests/docs.test.ts` passes (VI/EN twins same skeleton).
- Security and migration risks: none (static data flag + markup).
- Risks: (a) tooltip is not available on touch without hover; tap navigates to the destination page whose `<h1>` shows the name — accepted, flagged in the PR. (b) A tooltip near the map edge could be clipped; verify at 375. (c) Featured list is owner data; if not confirmed the work is blocked.
- Rollback approach: revert the single PR; flag is optional, nothing persisted.
- Budget: 0 subagents; stop condition = acceptance criteria met, or the owner changes the list/approach.
- State: REVIEW — owner approved; implemented, checks PASS; open question: 2 label overlaps at 375px (Hà Giang/Sa Pa, Phú Quốc/TP.HCM), see handoff.
- Feature document owner (`docs/features/<slug>.md` + `.vi.md`): update `docs/features/travel-map.md` / `.vi.md` (label rule) — no new feature doc, as this refines the existing travel map.
- Architecture/usage doc updates needed: none expected (`docs/architecture.*` lists destination counts only); re-check at implementation.
