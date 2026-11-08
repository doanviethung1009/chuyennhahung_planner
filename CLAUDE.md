# Chuyện Nhà Hưng — project rules

> Đi đâu cũng có chuyện.

Vietnamese-first travel storytelling site with a trip Planner. Next.js App Router,
TypeScript, Tailwind v4, next-intl.

## Stack
| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4 — CSS-first `@theme` tokens in `src/app/globals.css` |
| i18n | `next-intl` 4, VI default unprefixed, EN at `/en`, localized pathnames |
| Content | Typed seed data in `src/content/**` |
| Tests | Vitest 3 (Node 20.14 here is below Vite 7's 20.19 floor, so Vitest 4/5 cannot run) |

## Commands
```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
npm run build      # production build
```

## Agent roster
Three specialist agents. Route work to the one that owns the files.

| Agent | Owns | Never touches |
|---|---|---|
| `system-architect` | Route topology, data contracts, ADRs in `docs/adr/`, Archify diagrams | App code, design tokens |
| `backend-engineer` | `src/app/api/**`, server actions, persistence, validation, caching | Components, tokens, route topology |
| `frontend-engineer` | `src/app/**` markup, `src/components/**`, `globals.css` tokens, `messages/*.json` | API handlers, persistence, route topology |

Rules for each live in `.claude/agents/<name>.md` and are binding on that agent.

**Ownership is exclusive.** If a task spans two agents, the architect splits it and
defines the contract between the halves first. An agent that needs a change in
someone else's files requests it — it does not make it.

## Rules that bind everyone

1. **Vietnamese is the product, English is a translation.** VI is the default locale
   and ships without a prefix. Never ship a user-visible string that is not in both
   `messages/vi.json` and `messages/en.json`.
2. **Tour routes are permanent.** Tours are modelled as itineraries. `/tour`,
   `/tours`, `/tour/:slug` and `/tours/:slug` redirect into the itinerary routes via
   `next.config.ts`. Removing or repointing them requires an approved ADR.
3. **Design tokens are defined once**, in `@theme` in `src/app/globals.css`. No
   hard-coded colour, font, radius or shadow anywhere else.
4. **No placeholder links, no dead buttons.** `href="#"` is a defect. A control that
   does nothing must not exist.
5. **Accessibility is not optional**: semantic landmarks, one `<h1>`, ordered
   headings, visible focus, real `<button>`/`<a>` elements, ≥44px touch targets,
   meaningful `alt`.
6. **The Planner backend is a later phase.** Until the user opens it, the Planner CTA
   is a content page with real contact affordances and no server dependency. Do not
   scaffold Planner tables or endpoints early.
7. **Definition of done** is `typecheck`, `lint` and `test` passing *and the output
   stated*. Report what actually happened — if something fails or was skipped, say so.
8. Seed content must be realistic and plausible for this brand. Where a value needs
   the owner's real data (social handles, phone numbers, booking emails), flag it
   explicitly instead of leaving a convincing fake in place.

## Skills
- **archify** (`.claude/skills/archify/`, Apache-2.0, vendored from
  [tt-a1i/archify](https://github.com/tt-a1i/archify)) — generates validated,
  interactive standalone-HTML architecture/sequence/flow diagrams. It is a
  *diagramming* tool, not an architecture authority: write the ADR first, then
  visualize it. Owned by `system-architect`. Artifacts go in `.archify/`.
