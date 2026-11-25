# Feature — Bảng điều khiển quản trị

🇻🇳 English version: [admin-dashboard.md](admin-dashboard.md)

## Tóm tắt

`/admin` cho thấy việc đang chờ theo từng vai trò: chuyến đi và đánh giá chờ duyệt, báo cáo chờ xử lý, hạn chế đang hiệu lực, bản nháp chuyến đi và đánh giá, nội dung đã xuất bản, lỗi toàn vẹn dữ liệu, tài khoản hoạt động và bị khóa/xóa mềm, và (super admin) nơi lưu hai kho dữ liệu. Mỗi thẻ dẫn tới màn hình tương ứng. Chỉ có số đếm, chỉ đọc, không tự làm mới.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `GET /api/admin/overview` | như nhau | như nhau |

API nhận admin token hoặc phiên staff (`content:write` trở lên), trả `no-store`, và trả `{ cards: [{ id, href, state, count?, atLeast?, severity?, detail? }] }`. `id` thuộc một enum cố định; `state` là `ok` hoặc `unavailable`; `atLeast: true` đánh dấu số đếm là cận dưới; `detail` (chỉ thẻ runtime) là `postgres`, `file` hoặc `mixed`. Không bao giờ có nội dung exception hay chuỗi kết nối; payload không bao giờ có handle, email hay bí mật.

## Dữ liệu

Không có bảng, thao tác ghi hay phương thức repository mới. Số đếm lấy từ phương thức sẵn có: `listListingQueue`, `listReviewQueue('pending')`, `listReports('open')`, `listRestrictions(true)`, `listStories`/`listReviews` (bản nháp và đã xuất bản; place không có trạng thái nháp), `validateIntegrity`, `listUsers`.

| Thẻ | Cần quyền | Mở tới |
|---|---|---|
| `listingsPending`, `reviewsPending` | `community:moderate` | `/admin/community` |
| `reportsOpen` | `community:moderate` | `/admin/community` |
| `restrictionsActive` | `community:restrict` | `/admin/community` |
| `contentDrafts`, `contentPublished` | `content:write` | `/admin/content/stories` |
| `integrityIssues` | `content:write` | `/admin/content/integrity` |
| `usersActive`, `usersDisabled` | `user:provision` | `/admin/users` |
| `runtime` | `runbook:read` | `/admin/runbook` |

## Cách hoạt động

`buildOverview(principal, sources)` trong `src/server/admin/overview.ts` giữ các thẻ vai trò được xem (cùng `can()` với màn hình mà thẻ mở ra) và đọc từng nguồn độc lập: một nguồn lỗi chỉ biến thẻ của nó thành `state: 'unavailable'`, không bao giờ thành lỗi 500. Trang gọi thẳng `loadOverview`; route làm tương tự sau `adminContentRoute`. Chạy được trên kho JSON và PostgreSQL vì chỉ dùng phương thức repository. `OverviewCards` là server component. Payload chỉ phụ thuộc vai trò, nên `loadOverview` giữ một mục cho mỗi vai trò trong 15 giây (trong tiến trình, trang và route dùng chung): các lần đọc toàn danh sách chạy tối đa một lần mỗi vai trò mỗi khoảng, và số đếm có thể cũ tới 15 giây sau thay đổi từ nơi khác. Mọi yêu cầu quản trị làm đổi dữ liệu (POST/PUT/PATCH/DELETE qua các lớp bảo vệ route admin, `src/server/overview-cache.ts`) xóa cache khi xong, nên duyệt, khóa hoặc đổi trạng thái hiện ngay ở lần tải bảng điều khiển kế tiếp, không phải chờ. Vai trò không có thẻ nào thấy trạng thái trống. `listReviewQueue` trả tối đa 200 dòng, nên số đánh giá chờ duyệt bằng 200 được hiện là "200+" (`atLeast`), không bao giờ là tổng chính xác.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/server/admin/overview.ts` | Định nghĩa thẻ, bảng nguồn đếm, `buildOverview`, nguồn thật |
| `src/app/api/admin/overview/route.ts` | `GET /api/admin/overview` |
| `src/components/admin/dashboard/overview-cards.tsx` | Thẻ, trạng thái không khả dụng và trống |
| `src/app/[locale]/admin/page.tsx` | Trang bảng điều khiển |

## Test

`tests/admin-overview.test.ts`: ma trận vai trò, cận dưới 200+, tập `state`/`detail` đóng, (ẩn danh 401, member 403, editor, admin, service), số đếm so với fixture, tính riêng tư của payload, đường thẻ lỗi và trống. `tests/runbook.test.ts` (đồng bộ danh sách route), `tests/i18n.test.ts`, `tests/docs.test.ts`.

## Giới hạn và câu hỏi còn mở

Chưa có thẻ hoạt động: route events (`/api/admin/community/events`) cần `targetId` nên không có luồng hoạt động gần đây để tóm tắt; chờ trình xem audit (P07-13). `reportsOpen` và `integrityIssues` báo "cần xử lý" khi lớn hơn 0; số lỗi toàn vẹn chạy một lượt quét đầy đủ nên dựa vào cache 15 giây. Các route integrity vẫn chỉ nhận token; bảng điều khiển đọc thẳng repository và chỉ hiện số đếm. Kiểm tra giao diện ở 375/768/1280px: xem PR.
