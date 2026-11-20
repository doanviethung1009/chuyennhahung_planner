# Task Contract: MEMBER-HOME-MERGE — gộp `/my-map` vào `/my-trips`
- Class: **L** (đổi IA/route → có ADR 0031). Không API, không schema, không migration. Chủ dự án muốn một trang thành viên thay vì hai.
- Trạng thái: **CHỜ CHỦ DUYỆT ADR 0031**. Không commit/push/PR khi chưa được phép. `qc`/`security`: NOT RUN (chỉ khi chủ gọi).

## Quyết định thiết kế
- `/my-trips` (VI `/chuyen-di-cua-toi`) là **trang chủ của thành viên**: bản đồ ở trên, danh sách chuyến bên dưới (không toggle: không ẩn thông tin, không thêm trạng thái client).
- `/my-trips` đổi từ client page sang **server page** `force-dynamic`: đọc `getMemberMap()` (cookie phiên) cho phần bản đồ; phần danh sách vẫn là client `MyTrips` gọi `GET /api/planner` (không đổi).
- **Khách**: bản đồ trống + CTA đăng nhập, **không mount `MyTrips`** (nếu mount, 401 sẽ chuyển thẳng sang đăng nhập và mất bất biến "khách thấy bản đồ trống").
- Header `Cache-Control: private, no-store` cho `/chuyen-di-cua-toi` và `/en/my-trips` (thay cho `/ban-do-cua-toi`, `/en/my-map`); giữ `noindex`.
- `/ban-do-cua-toi` → `/chuyen-di-cua-toi`, `/en/my-map` → `/en/my-trips`: `permanent: true` (308) trong `next.config.ts`; test.
- Bỏ `/my-map` khỏi `pathnames`; mọi link tới nó đổi sang `/my-trips` (menu tài khoản, `returnTo` allow-list, CTA khách ở `MemberMapView`, `myTrips.mapLink`).
- Chỗ cho chia sẻ (2c): điều khiển nằm trong khối bản đồ của trang gộp (`MemberMapView` hoặc component cạnh nó).
- Không đổi: `src/content/destinations.ts`, `/map`, `/shared-map/[token]`, `/my-trips/new`, `/my-trips/[id]`, allow-list `{slug, visits}`.

## Phụ thuộc / thứ tự
- Session 2c (`member-map-2c`) sửa `my-map/page.tsx`, `member-map-view.tsx`, `messages/*.json`. Làm phần không chồng file trước; 3 file đó chỉ sửa sau khi PR 2c merge (`gh pr list`), rebase trước.

## Tasks
- FE: trang `/my-trips` mới; chỉnh `MemberMapView` (returnTo, tiêu đề h2); account-menu; i18n VI/EN (bỏ `nav.myMap`, `myTrips.mapLink`; tiêu đề trang gộp).
- BE/config: redirect + header; `routing.ts`; `return-to.ts`.
- Tests: cập nhật `member-map.test.ts`, `member-map-view.test.ts`, `home-page-boundary.test.ts`; thêm test redirect.
- Docs EN+VI: ADR 0031 + README, feature `member-map`, `architecture`, `usage` nếu nhắc route.

## Acceptance
- Một h1, landmark, focus, target ≥44px ở 375/768/1280; VI/EN đủ; `typecheck`, `lint`, `test`, `build` chạy và ghi kết quả thật.
