# Handoff — MEMBER-MAP Lát 1 (bản đồ thành viên riêng tư `/my-map`)
- Nhánh `feat/member-map` (từ origin/main 0c794f8). Chưa commit/push/PR (chờ chủ cho phép).
## Đã làm
- `src/server/planner/member-map.ts` (hàm thuần `buildMemberMapPoints`, `resolveMemberMap`, `getMemberMap`), trang `/my-map` (VI `/ban-do-cua-toi`), `MemberMapView`, `VietnamMap` đổi kiểu prop sang `MapPin` (đầu ra không đổi, có test so sánh).
- Routing, `return-to`, i18n VI/EN (`memberMap`, `nav.myMap`, `myTrips.mapLink`), link ở account menu + `/my-trips`, header `private, no-store` trong `next.config.ts`.
- ADR 0029 VI+EN (+ đăng ký), feature doc `member-map.*` (+ README), `docs/architecture.*`, chữ quy tắc 6 ở `CLAUDE.md` + `rules/03`, contract chép vào repo.
## Ngoài kế hoạch
- Sửa `tests/home-page-boundary.test.ts` (luật cache-control mới thêm `/ban-do-cua-toi`, `/en/my-map`); `src/lib/return-to.ts` thêm `/my-map` vào trang riêng tư; `docs/features/README.*` đổi dòng "Planner map" thành "Trip route map".
- Sau sec-check của contract (PR #200): chép contract mới; ADR 0029 thêm rủi ro cache (nginx/CDN/router) và ghi `MemberMapPoint` chỉ riêng tư; thêm test đăng xuất = điều hướng đầy đủ.
## Checks (đã chạy)
- typecheck PASS · lint PASS · test PASS (114 files, 1413 tests, 95 skipped; gồm docs.test.ts) · build PASS (route `/[locale]/my-map` dynamic).
- `/qc-check` NOT RUN. `/sec-check` NOT RUN — **khuyến nghị** (danh tính phiên, cô lập ownerId).
- Chưa chạy trình duyệt thật.
## Rủi ro / quyết định mở
- Mỗi request đọc tới 1.000 chuyến/trạng thái. Các specs cũ còn chữ "Planner map" (roadmap, specs-*, runbook) chưa đổi, nghĩa là bản đồ tuyến.
- Chưa liên kết chéo `travel-map.*` (đợi PR #198). Lát 2 (token) cần ADR bổ sung + sec-check.
## Next
- Chủ cho phép commit/PR; chạy `/sec-check`; Lát 2.
