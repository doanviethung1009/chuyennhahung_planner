# Task Contract: CORE-14 Map pin touch targets ≥44px
- Class: M (one component + one constant; no data, API or route change). Written to file because the owner asked for a contract file.
- Desired outcome / user impact: every pin on the journey map (`/` preview and `/map`) is a real `<a>` whose own box is ≥44×44 CSS px at 375/768/1280, closing CORE-8 S-5 for the map (CLAUDE.md rule 5). Header/footer/language/editor were done in CORE-12 (PR #190).
- Scope IN: `src/components/map/vietnam-map.tsx` (anchor box and pin placement); `src/lib/map.ts` (export one `MAP_TARGET_PX = 44` constant); `tests/map.test.ts` (new assertions); handoff file.
  Scope OUT: SVG outline, `project()`/`pinRadius()` maths, routes, messages (no new strings), tokens, `/map` page and `map-preview.tsx` markup, docs content unless a doc states the old hit-area (checked at implementation; then VI+EN twins together).
- Evidence:
  - Premise correction: the pins are NOT `<a>` inside the SVG. The SVG (`vietnam-map.tsx:40-57`) is `aria-hidden` and decorative; pins are HTML `<Link>`s in a `<ul>` over it (`:59-118`), already no-JS and keyboard-navigable. The brief's "SVG <a>" does not exist; no SVG change is needed.
  - Root cause of the 10–22px measurement: the `<Link>` box is sized by its content (dot `r*2` = 10–22px, or dot + `text-xs` label ≈ 20px tall). The 44px `size-11` span (`:84-87`) is an absolutely positioned child, so it extends the hit-test area but not the anchor's box, and it is centred on the *anchor* (dot + label), not on the dot.
  - Side defect found: `-translate-x-1/2` centres the whole anchor (dot + gap + label) on the projected point, so in the `full` variant the dot sits left of its true coordinate by about half the label width. Fixing the anchor geometry fixes this too; flag as a visible (small) position change.
  - Report: `.claude/reports/core-8-smoke-2026-11-19.md:105` (S-5).
- Constraints / dependencies: Tailwind v4 tokens only (no hard-coded colours); `size-11` = 44px already used; no new dependency; no ADR needed (no contract/route change).
- Architecture decision / ADR: none.
- Interface contract: props of `VietnamMap` unchanged; DOM stays `ul > li > a`; link accessible name unchanged (destination name).
- Design:
  1. Anchor becomes a fixed `size-11` (44×44) box, `flex items-center justify-center`, positioned `-translate-x-1/2 -translate-y-1/2` so the **dot is centred exactly on the projected point**.
  2. Dot stays centred inside it (visual size unchanged, `r*2`, hover/focus scale kept).
  3. `full` variant: the label is an absolutely positioned child to the right of the 44px box (`left-full`, vertically centred) — still inside the `<a>`, so it stays clickable, but it no longer widens the anchor box. Preview variant: `sr-only` label and tooltip as today.
  4. Remove the now-redundant inner 44px helper span.
  5. Focus ring stays on the `<a>` (visible, now 44px square); verify it is not clipped.
- Tasks by owner: Architect — this contract. FE — items 1–5, constant, tests. BE — none. QC/Security/Git — on demand only (NOT RUN).
- File ownership: single agent, files above only.
- Acceptance criteria / tests:
  - Browser measurement (`preview_start chuyen-nha-hung-dev`, server stopped afterwards): every `ul[aria-label] a` on `/` and `/map` has `getBoundingClientRect` ≥44×44 at 375, 768 and 1280; zero `a` below 44 in the map `ul`.
  - Screenshot check: layout of the outline unchanged, dots at their projected coordinates, no label clipped at 375 (labels near the right edge — if one overflows, flip it to the left side for that case or accept `overflow` per measurement).
  - Keyboard: Tab reaches each pin in DOM order, focus ring visible; works with JS disabled (server component, no `'use client'`).
  - Unit test (vitest, no new dependency; check whether `renderToStaticMarkup` works in the current setup, else assert on the exported constant and source classes): `MAP_TARGET_PX >= 44`; markup of `VietnamMap` for every destination contains an `<a>` with the `size-11` class and no `href="#"`.
  - `npm run typecheck`, `npm run lint`, `npm run test` PASS with output stated.
- Security and migration risks: none (markup/CSS only, no data, no auth).
- Risks: (a) dense clusters (e.g. central-coast pins) may have overlapping 44px boxes at the 340px preview width — WCAG 2.5.8 tolerates overlap only if spacing is adequate; I will measure overlaps and report them rather than shrink targets; if pins overlap, a follow-up (zoom/clustering list) is a separate decision. (b) The dot shifting to its true coordinate is a small visual change on `/map`.
- Rollback approach: revert the single PR; no data or config touched.
- Budget: 0 subagents; stop condition = acceptance criteria met or an overlap finding that needs an owner decision.
- State: DONE (merged PR #191, tests #193 and #194, 2026-11-19)
- Feature document owner (`docs/features/<slug>.md` + `.vi.md`): none planned — accessibility fix to an existing feature; if `docs/features/` map/design-system docs state the touch-target behaviour, update both twins in the same change.
- Architecture/usage doc updates needed: none expected.
