# Handoff — verify /my-trips UI + share 404 robots

Branch `fix/share-404-robots`. Verified in a real browser (dev server, 375/768/1280, VI+EN).
Test data: local `.data/` JSON store (gitignored) + `.env.local` token (gitignored). Not committed.

## Result
- No blocking UI defect on /my-trips: no horizontal overflow, one h1, h2 list / h3 trip cards,
  44px pins and buttons, visible focus, legend in words, label only on featured pin,
  solid (visited) vs hollow (planned) pins, VI/EN strings complete.
- Share panel: link shown once, rotate invalidates the old link, revoke -> 404,
  preview equals public page, sparse (<2) warning, name mode closed -> anonymous.
- Public page headers (production build): Cache-Control private, no-store; X-Robots-Tag noindex;
  Referrer-Policy no-referrer. Dev server shows plain no-store (Next dev override, not a bug).
- /ban-do-cua-toi and /en/my-map -> 308 to /my-trips.

## Fixed
- 404 of a share token had both `noindex` and the layout's `index, follow` robots meta.
  Added `not-found.tsx` with noindex metadata for `shared-map/[token]` and `shared/[token]`;
  test `tests/share-not-found-robots.test.ts`.

## Not run
- qc, sec-check; 1280 guest/empty-member screenshots.
