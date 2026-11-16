# Feature — Bảng điều khiển quản trị

🇻🇳 English version: [admin-dashboard.md](admin-dashboard.md)

## Tóm tắt

`/admin` cho thấy việc đang chờ theo từng vai trò: chuyến đi và đánh giá chờ duyệt, bản nháp nội dung, tài khoản hoạt động và bị khóa/xóa mềm, vấn đề toàn vẹn dữ liệu và (super admin) nơi lưu hai kho dữ liệu. Mỗi thẻ dẫn tới màn hình tương ứng. Chỉ có số đếm, chỉ đọc, không tự làm mới.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `GET /api/admin/overview` | như nhau | như nhau |

API nhận admin token hoặc phiên staff (`content:write` trở lên), trả `no-store`, và trả `{ cards: [{ id, href, state, count?, severity?, detail? }] }`. `id` thuộc một enum cố định; payload không bao giờ có handle, email hay bí mật.

## Dữ liệu

Không có bảng, thao tác ghi hay phương thức repository mới. Số đếm lấy từ phương thức sẵn có: `listListingQueue`, `listReviewQueue('pending')`, `listStories`/`listReviews` (bản nháp), `listUsers`, cả hai `validateIntegrity()`.

| Thẻ | Cần quyền | Mở tới |
|---|---|---|
| `listingsPending`, `reviewsPending` | `community:moderate` | `/admin/community` |
| `contentDrafts` | `content:write` | `/admin/content/stories` |
| `usersActive`, `usersDisabled`, `integrity` | `user:provision` | `/admin/users` |
| `runtime` | `runbook:read` | `/admin/runbook` |

## Cách hoạt động

`buildOverview(principal, sources)` trong `src/server/admin/overview.ts` giữ các thẻ vai trò được xem (cùng `can()` với màn hình mà thẻ mở ra) và đọc từng nguồn độc lập: một nguồn lỗi chỉ biến thẻ của nó thành `state: 'unavailable'`, không bao giờ thành lỗi 500. Trang gọi thẳng `loadOverview`; route làm tương tự sau `adminContentRoute`. Chạy được trên kho JSON và PostgreSQL vì chỉ dùng phương thức repository. `OverviewCards` là server component. Vai trò không có thẻ nào thấy trạng thái trống.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/server/admin/overview.ts` | Định nghĩa thẻ, `buildOverview`, nguồn thật |
| `src/app/api/admin/overview/route.ts` | `GET /api/admin/overview` |
| `src/components/admin/dashboard/overview-cards.tsx` | Thẻ, trạng thái không khả dụng và trống |
| `src/app/[locale]/admin/page.tsx` | Trang bảng điều khiển |

## Test

`tests/admin-overview.test.ts`: ma trận vai trò (ẩn danh 401, member 403, editor, admin, service), số đếm so với fixture, tính riêng tư của payload, đường thẻ lỗi và trống. `tests/runbook.test.ts` (đồng bộ danh sách route), `tests/i18n.test.ts`, `tests/docs.test.ts`.

## Giới hạn và câu hỏi còn mở

Chưa có thẻ hoạt động: route events (`/api/admin/community/events`) cần `targetId` nên không có luồng hoạt động gần đây để tóm tắt; chờ trình xem audit (P07-13). Thẻ toàn vẹn đếm phát hiện của cả hai kho và dành cho admin; bản thân các route integrity vẫn chỉ nhận token. Kiểm tra giao diện ở 375/768/1280px: xem PR.
