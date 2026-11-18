# Tính năng — Bộ sưu tập và toàn vẹn dữ liệu (admin, P07-15)

🇬🇧 English: [admin-content-collections.md](admin-content-collections.md)

## Summary

Editor quản lý bộ sưu tập điểm đến ngay trên trình duyệt — xem danh sách, tìm kiếm, sắp xếp, sửa vi/en song song, xuất bản hoặc gỡ xuất bản — và đọc báo cáo toàn vẹn chỉ-xem liệt kê các tham chiếu hỏng trong kho nội dung. Admin còn xem báo cáo toàn vẹn của Planner. Các màn hình dùng API đã có; thay đổi API chỉ gồm guard truy cập (từ chỉ-token sang session trình duyệt) và `If-Match` tuỳ chọn cho `PATCH` collection (W11, quyết định của chủ dự án 2026-11-18).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/collections` | `/quan-tri/noi-dung/bo-suu-tap` | `/en/admin/content/collections` |
| `/admin/content/collections/[slug]` | `/quan-tri/noi-dung/bo-suu-tap/[slug]` | `/en/admin/content/collections/[slug]` |
| `/admin/content/integrity` | `/quan-tri/noi-dung/toan-ven` | `/en/admin/content/integrity` |

Route API chuyển từ chỉ-token sang `adminContentRoute(request, { action: 'content:write', session: true })`: `GET`/`POST /api/admin/travel/collections`, `GET`/`PATCH …/collections/[slug]` (`DELETE` vẫn chỉ token theo quyết định của chủ dự án), `POST …/collections/[slug]/status`, `GET /api/admin/travel/integrity`. `GET /api/admin/planner/integrity` nay truyền `{ action: 'user:provision', session: true }`. Service token vẫn dùng được ở tất cả. `templates/**` không đổi (CORE-5).

## Data

Đọc và ghi `DestinationCollection` (`title`, `tagline`, `description`, `cover`, `destinationSlugs`, `storySlugs`, `placeSlugs`, `seo`, `status`, `updatedAt`). Slug là định danh và không sửa. Phát hiện toàn vẹn có dạng `{ entity, id, issue }`; báo cáo Planner chỉ có định danh và mô tả lỗi, không có nội dung chuyến đi (ADR 0002 §3). Namespace message: `adminContent.collections`, `adminContent.integrity`, cộng `adminContent.list.{search…,sort…,noMatches}` và `adminContent.nav.{collections,integrity}`.

## How it works

Cả hai trang là server component sau `requireStaff(…, 'content')` (chưa đăng nhập thì chuyển sang đăng nhập, member nhận 404 của admin). Trang toàn vẹn truyền `showPlanner = canUsers` (`user:provision`) cho client island, nên editor không bao giờ gọi báo cáo Planner, và API vẫn từ chối họ. Danh sách là `ContentList kind="collections"`: tải một lần rồi tìm kiếm (không phân biệt hoa thường và dấu, trên slug và cả hai tiêu đề) và sắp xếp (mới cập nhật, tên, slug) bằng hàm thuần trong `list-utils.ts`; tìm kiếm và sắp xếp này cũng áp dụng cho story và place. Trình sửa là `RecordShell` với `CollectionEditor`: lưu kèm `If-Match: "<updatedAt>"`, lưu trên bản cũ trả 412 và hiện thông báo "có người lưu trước" kèm nút tải lại. Đổi trạng thái đi qua endpoint status. Phát hiện liên kết tới bản ghi sở hữu (`ownerLink`): story, place, collection tới trình sửa, review tới hàng đợi duyệt; template và bản ghi Planner hiện dạng chữ. Có trạng thái rỗng, đang tải và lỗi kèm nút thử lại.

`updateCollection(slug, patch, expectedUpdatedAt?)` trong repository so dấu thời gian bên trong transaction (một lớp repository phục vụ cả kho JSON và PostgreSQL). Không có header thì vẫn ghi sau thắng với người gọi API.

## Files

| Path | Role |
|---|---|
| `src/app/api/admin/travel/collections/**`, `…/integrity/route.ts`, `src/app/api/admin/planner/integrity/route.ts` | guard chuyển sang session; PATCH collection truyền `ifMatchStamp` |
| `src/server/content/repository.ts` | `updateCollection` thêm `expectedUpdatedAt` tuỳ chọn |
| `src/app/(admin)/[locale]/admin/content/{collections,collections/[slug],integrity}/page.tsx` | các trang |
| `src/components/admin/content/{collection-editor,integrity-report,list-utils,integrity-utils}.ts(x)`, `content-list.tsx`, `record-shell.tsx` | UI và hàm thuần |
| `src/i18n/routing.ts`, `src/lib/admin-gate.ts`, `src/lib/return-to.ts`, `messages/*.json` | route, sidebar, return-to, chuỗi |

## Tests

`tests/admin-content-session.test.ts` — mọi handler đã chuyển: 401 khi không credential, editor và admin 200, member 403, service token 200, mutation cross-site bị chặn và không ghi gì, `If-Match` khớp / cũ 412 / không có / rỗng 400 và đua đồng thời, planner integrity (admin 200, editor và member 403). `tests/admin-collections-integrity.test.ts` — route, sidebar, cổng trang và ma trận role, hàm tìm kiếm/sắp xếp, liên kết phát hiện, đồng bộ message. `tests/dom/collections-integrity.test.tsx` — trình sửa gửi `If-Match`, hiện thông báo 412 và tải lại, POST trạng thái, tìm kiếm danh sách, báo cáo toàn vẹn cho editor so với admin, lỗi và thử lại. Chưa kiểm: chạy trình duyệt thật ở 375/768/1280 (NOT RUN).

## Limits and open questions

Chưa có tạo hoặc xoá trên trình duyệt (API hỗ trợ cả hai; sẽ làm cùng mẫu xác nhận như lưu trữ khi cần). Không tự sửa các phát hiện. Mọi phiên editor nay ghi được collection, cùng mức phơi bày như story và place; khuyến nghị `/sec-check`. Giới hạn 30 lần/phút/người tính theo từng process. `If-Match` tuỳ chọn trên API nên người gọi bằng token vẫn có thể ghi đè.
