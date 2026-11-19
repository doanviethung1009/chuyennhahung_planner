# Tính năng — Lịch trình mẫu (admin, P07-6)

🇬🇧 English: [admin-content-templates.md](admin-content-templates.md)

## Summary

Editor quản lý lịch trình mẫu ngay trên trình duyệt — xem danh sách, tìm, sắp xếp, sửa thông tin chung (vi và en cạnh nhau), các ngày và hoạt động, đổi thứ tự hoạt động và chuyển hoạt động giữa các ngày — và đọc ảnh chụp chuyện nguồn (bất biến) cùng các số liệu tự tính. Trước đây chỉ làm được bằng `curl`. Mọi thao tác ghi đều gửi `If-Match` nên không ai âm thầm ghi đè đồng nghiệp. Các chuyến đã tạo từ mẫu là bản sao đóng băng và không bao giờ đổi (`tests/planner-clone-independence.test.ts`). Không có lịch sử phiên bản (quyết định W4 của chủ dự án).

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin/content/templates` | `/quan-tri/noi-dung/lich-trinh-mau` | `/en/admin/content/templates` |
| `/admin/content/templates/[slug]` | `/quan-tri/noi-dung/lich-trinh-mau/[slug]` | `/en/admin/content/templates/[slug]` |

Các route API chuyển từ chỉ-token sang `adminContentRoute(request, { action: 'template:write', session: true })`: `GET /api/admin/travel/templates`, `GET`/`PATCH …/templates/[slug]`, `POST …/templates/[slug]/reorder`, `POST …/templates/[slug]/move-activity`. Token dịch vụ vẫn dùng được. **`POST …/templates` (tạo) và `DELETE …/templates/[slug]` vẫn chỉ dùng token** theo quyết định của chủ dự án (2026-11-19): tạo từ story và xóa vĩnh viễn không phải hành động của editor. `PATCH`, `reorder` và `move-activity` nhận `If-Match: "<updatedAt>"` tuỳ chọn và trả 412 `version_conflict` khi lệch.

## Data

Đọc và ghi `TravelTemplate`: `title`, `summary`, `groupSize` (vi/en), `travelStyle`, `pace`, `itinerarySlugs`, `visibility`, `days[].{title, summary, activities[]}` với mỗi hoạt động có `title`, `placeSlug`, `startTime`, `durationMinutes`, `estimatedCostVnd`, `note`. Chỉ đọc: `slug`, `sourceStorySlug`, `sourceSnapshot` (bất biến theo thiết kế, ADR 0001 §4), `durationDays`, `placeSlugs`, `estimatedTotalVnd` và `version` (đều tự tính). Namespace thông điệp: `adminContent.templates`, `adminContent.nav.templates`, cùng `adminContent.list.*` dùng chung.

## How it works

Cả hai trang là server component sau `requireStaff(…, 'content')`; danh sách và editor là client island gọi các endpoint có sẵn. Danh sách tải một lần rồi tìm và sắp xếp bằng `list-utils.ts` (dùng chung với story, place, collection). Editor giữ bản nháp của cả bản ghi. **Lưu** chỉ gửi các khóa thông tin chung đã đổi, và `days` chỉ khi nội dung hoạt động đổi: patch `days` cấp lại id hoạt động nên việc đổi thứ tự không đi qua đó. **Đổi thứ tự (lên/xuống)** và **chuyển sang ngày khác** gọi `reorder` và `move-activity`, giữ nguyên id hoạt động; mỗi thao tác lưu ngay và bị khóa khi còn chỉnh sửa chưa lưu (hãy lưu trước). Hoạt động được chuyển sẽ nối vào cuối ngày đích; ngày chỉ còn một hoạt động thì không chuyển đi được (server không cho ngày rỗng). Công khai (`visibility: public`) cần chuyện nguồn đã xuất bản: server trả `invalid_state`, hiển thị thành thông báo rõ ràng. Lỗi 412 hiện "có người lưu trước" kèm nút tải lại. Khung chuyện nguồn hiển thị ảnh chụp và, khi `updatedAt` của story nguồn mới hơn `storyUpdatedAt`, một gợi ý "chuyện nguồn đã đổi"; nếu không đọc được story thì ảnh chụp vẫn hiển thị.

`updateTemplate`, `reorderActivities` và `moveActivity` trong repository nhận `expectedUpdatedAt`, kiểm tra trong transaction (`checkStamp`); từ CORE-11 các route yêu cầu header `If-Match` (thiếu là `428 precondition_required`), cả với người gọi API.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/app/api/admin/travel/templates/**` | bốn handler chuyển sang truy cập bằng session; ba handler truyền `ifMatchStamp`; POST và DELETE giữ nguyên quyền truy cập |
| `src/server/content/repository.ts` | `expectedUpdatedAt` trên ba hàm (route nay yêu cầu `If-Match`) |
| `src/app/(admin)/[locale]/admin/content/templates/{,[slug]/}page.tsx` | các trang |
| `src/components/admin/content/{template-list,template-editor}.tsx`, `template-utils.ts` | giao diện và hàm thuần |
| `src/i18n/routing.ts`, `src/lib/admin-gate.ts`, `src/lib/return-to.ts`, `messages/*.json` | route, sidebar, return-to, chuỗi |

## Tests

`tests/admin-content-session.test.ts` — bốn handler (401 / member 403 / editor, admin, super_admin và token được phép), mutation khác site bị từ chối và không ghi gì, `If-Match` khớp / cũ 412 / vắng trên `PATCH`, `reorder` và `move-activity`, và POST, DELETE bị từ chối với session editor, admin, super_admin trong khi token vẫn xóa được template riêng tư còn template công khai vẫn bị chặn. `tests/travel-content-repository.test.ts` — stamp trên ba hàm. `tests/admin-template-cms.test.ts` — route, sidebar, ma trận role của trang, dựng patch, kiểm tra nguồn cũ, hàm sắp xếp, đồng bộ thông điệp. Chưa phủ: test render component editor và chạy trình duyệt thật ở 375/768/1280 (NOT RUN).

## Limits and open questions

Chưa có tạo mới (từ story), xóa, hay thêm/bớt ngày và hoạt động trên trình duyệt; tạo template từ story là quyết định riêng. Không có lịch sử phiên bản (W4). Mọi phiên editor giờ đều sửa được nội dung template công khai, cùng mức phơi bày như story và place; khuyến nghị `/sec-check`. `If-Match` là bắt buộc trên API (CORE-11) nên người gọi bằng token không còn ghi đè được. Giới hạn 30 lần/phút/người tính theo từng process.
