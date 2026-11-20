# Runbook — tổng quan và danh sách API

🇻🇳 English version: [runbook.md](runbook.md)

Nơi bắt đầu khi vận hành ứng dụng: hướng dẫn nào trả lời câu hỏi nào, các bước
kiểm tra hằng ngày và danh sách mọi endpoint HTTP. Cùng nội dung này hiển thị cho
quản trị viên trên trình duyệt tại `/quan-tri/runbook` (`/en/admin/runbook`),
xem [features/admin-runbook.vi.md](features/admin-runbook.vi.md).

## Mở hướng dẫn nào

| Bạn muốn | Mở |
|---|---|
| Dựng VM trống thành ứng dụng chạy và tự triển khai | [deploy-runbook.vi.md](deploy-runbook.vi.md) |
| Kiểm tra, khởi động lại, sao lưu, khôi phục, xoay bí mật, xử lý sự cố | [deploy-operations.vi.md](deploy-operations.vi.md) |
| Chuyển dữ liệu JSON sang PostgreSQL trên VM riêng | [deploy-database.vi.md](deploy-database.vi.md) |
| Cài hoặc sửa runner triển khai tự host | [deploy-runner.vi.md](deploy-runner.vi.md) |
| Gọi, kiểm tra và xử lý sự cố các API đã triển khai | [runbook-api.vi.md](runbook-api.vi.md) |
| Bật và vận hành đăng nhập Google trên VM dev | [runbook-google-sign-in.vi.md](runbook-google-sign-in.vi.md) |
| Hiểu app được xây thế nào: route, luồng dữ liệu, module, giai đoạn | [architecture.vi.md](architecture.vi.md) |
| Cài đặt, chạy, kiểm thử, triển khai và các quy trình hằng ngày | [usage.vi.md](usage.vi.md) |
| Đọc hợp đồng API Travel Content và mã lỗi | [travel-content-api.vi.md](travel-content-api.vi.md) |

## Kiểm tra nhanh

- Sống: `GET /api/health` trả `{"status":"ok"}`. Nó không đụng kho dữ liệu nào, nên sự cố database hiện ra là Planner `503`, không phải health check hỏng.
- Trang quản trị dành cho vai trò `admin` (và principal dịch vụ). Người khác, kể cả editor, nhận `404` trơn.
- Bí mật (`ADMIN_API_TOKEN`, `GOOGLE_CLIENT_SECRET`, URL database) không bao giờ xuất hiện trong tài liệu này hay tab trên trình duyệt.

## Ai được gọi gì

Cột **Ai được gọi** của bảng bên dưới dùng các thuật ngữ sau:

- **Công khai**: không cần thông tin xác thực. Nơi có ghi chú thì giới hạn tần suất theo từng tiến trình.
- **Du khách**: cookie `planner_session` từ lúc đăng nhập, hoặc access token của du khách. Mọi đọc và ghi đều lọc theo dữ liệu của chính du khách đó. Ghi bằng cookie phải cùng origin.
- **Admin token**: `Authorization: Bearer $ADMIN_API_TOKEN`.
- **Phiên admin / nhân viên**: phiên trình duyệt của người dùng có vai trò cho phép hành động nêu tên; admin token cũng dùng được. Vai trò và hành động: [features/admin-roles.vi.md](features/admin-roles.vi.md).

## Danh sách API

Bảng này là tham chiếu (có gì, ai được gọi); cách gọi, kiểm tra và xử lý sự cố API trên VM dev nằm ở [runbook-api.vi.md](runbook-api.vi.md).

Đường dẫn dùng đúng dạng ngoặc vuông của các file route dưới `src/app/api/`.
`tests/runbook.test.ts` báo lỗi khi bảng này và các file route lệch nhau, nên thêm
hay bỏ một route nghĩa là sửa bảng này ở cả hai ngôn ngữ.

| Method | Đường dẫn | Ai được gọi | Mục đích |
|---|---|---|---|
| GET | `/api/health` | Công khai | Probe sống cho healthcheck của container |
| GET | `/api/travel/places` | Công khai | Danh sách địa điểm đã đăng |
| GET | `/api/travel/places/[slug]` | Công khai | Một địa điểm |
| GET | `/api/travel/stories` | Công khai | Danh sách chuyện đã đăng |
| GET | `/api/travel/stories/[slug]` | Công khai | Một chuyện |
| GET | `/api/travel/collections` | Công khai | Danh sách bộ sưu tập |
| GET | `/api/travel/collections/[slug]` | Công khai | Một bộ sưu tập |
| GET | `/api/travel/reviews` | Công khai | Danh sách đánh giá đã đăng |
| GET | `/api/travel/templates` | Công khai | Danh sách mẫu chuyến đi |
| GET | `/api/travel/templates/[slug]` | Công khai | Một mẫu chuyến đi |
| GET | `/api/shared/[token]` | Công khai, giới hạn tần suất | Chuyến chia sẻ chỉ đọc theo share token |
| GET | `/api/community/trips` | Công khai, giới hạn tần suất | Chuyến cộng đồng đã duyệt |
| GET | `/api/community/reviews` | Công khai, giới hạn tần suất | Đánh giá cộng đồng đang hiển thị |
| POST | `/api/community/reviews` | Công khai, giới hạn tần suất | Đánh giá khách từ trang chủ (hiện ngay) |
| POST | `/api/community/reports` | Công khai (khách hoặc thành viên), giới hạn 10/ngày | Báo cáo chuyến hoặc đánh giá cộng đồng (không cần Điều khoản) |
| POST | `/api/planner/session` | Công khai, giới hạn tần suất | Đăng nhập (token hoặc email + mật khẩu), mở cookie phiên |
| GET | `/api/planner/session` | Du khách (cookie phiên hoặc access token) | Tôi là ai (kiểm tra phiên) |
| DELETE | `/api/planner/session` | Du khách (cookie phiên hoặc access token) | Đăng xuất |
| POST | `/api/planner/password` | Du khách (cookie phiên hoặc access token) | Đổi mật khẩu của mình |
| DELETE | `/api/planner/google` | Du khách (cookie phiên hoặc access token) | Gỡ liên kết Google của chính mình (cần đã đặt mật khẩu; có giới hạn tần suất) |
| GET | `/api/planner/oauth/google/start` | Công khai, giới hạn tần suất | Bắt đầu đăng nhập Google (404 khi chưa cấu hình) |
| GET | `/api/planner/oauth/google/callback` | Công khai | Callback đăng nhập Google (404 khi chưa cấu hình) |
| GET | `/api/planner` | Du khách (cookie phiên hoặc access token) | Danh sách chuyến của mình |
| POST | `/api/planner` | Du khách (cookie phiên hoặc access token) | Tạo chuyến (trống hoặc từ mẫu) |
| GET | `/api/planner/[id]` | Du khách (cookie phiên hoặc access token) | Một chuyến, kèm ETag |
| PATCH | `/api/planner/[id]` | Du khách (cookie phiên hoặc access token) | Sửa phần đầu chuyến (If-Match) |
| DELETE | `/api/planner/[id]` | Du khách (cookie phiên hoặc access token) | Lưu trữ chuyến |
| POST | `/api/planner/[id]/restore` | Du khách (cookie phiên hoặc access token) | Khôi phục chuyến đã lưu trữ |
| POST | `/api/planner/[id]/duplicate` | Du khách (cookie phiên hoặc access token) | Nhân bản chuyến |
| GET | `/api/planner/[id]/budget` | Du khách (cookie phiên hoặc access token) | Ngân sách: mục tiêu so với dự toán và thực chi |
| PATCH | `/api/planner/[id]/days/[dayNumber]` | Du khách (cookie phiên hoặc access token) | Sửa một ngày |
| PATCH | `/api/planner/[id]/reorder` | Du khách (cookie phiên hoặc access token) | Sắp xếp lại hoặc chuyển hoạt động giữa các ngày |
| POST | `/api/planner/[id]/activities` | Du khách (cookie phiên hoặc access token) | Thêm hoạt động |
| PATCH | `/api/planner/[id]/activities/[activityId]` | Du khách (cookie phiên hoặc access token) | Sửa hoạt động |
| DELETE | `/api/planner/[id]/activities/[activityId]` | Du khách (cookie phiên hoặc access token) | Xóa hoạt động |
| POST | `/api/planner/[id]/expenses` | Du khách (cookie phiên hoặc access token) | Thêm khoản chi |
| PATCH | `/api/planner/[id]/expenses/[expenseId]` | Du khách (cookie phiên hoặc access token) | Sửa khoản chi |
| DELETE | `/api/planner/[id]/expenses/[expenseId]` | Du khách (cookie phiên hoặc access token) | Xóa khoản chi |
| PUT | `/api/planner/[id]/share` | Du khách (cookie phiên hoặc access token) | Bật chia sẻ (tạo share token) |
| DELETE | `/api/planner/[id]/share` | Du khách (cookie phiên hoặc access token) | Thu hồi chia sẻ |
| POST | `/api/planner/[id]/share/rotate` | Du khách (cookie phiên hoặc access token) | Đổi share token |
| PUT | `/api/planner/[id]/listing` | Du khách (cookie phiên hoặc access token) | Xin đăng lên cộng đồng |
| DELETE | `/api/planner/[id]/listing` | Du khách (cookie phiên hoặc access token) | Rút khỏi cộng đồng |
| GET | `/api/planner/reviews` | Du khách (cookie phiên hoặc access token) | Đánh giá địa điểm của mình |
| PUT | `/api/planner/reviews/[placeSlug]` | Du khách (cookie phiên hoặc access token) | Viết hoặc thay đánh giá (có kiểm duyệt) |
| DELETE | `/api/planner/reviews/[placeSlug]` | Du khách (cookie phiên hoặc access token) | Xóa đánh giá của mình |
| GET | `/api/admin/planner/users` | Admin token hoặc phiên admin | Danh sách người dùng (`user:provision`) |
| POST | `/api/admin/planner/users` | Admin token hoặc phiên admin | Tạo người dùng, trả bí mật một lần (`user:provision`) |
| PATCH | `/api/admin/planner/users/[userId]` | Admin token hoặc phiên admin | Đặt vai trò (`user:promote`) |
| DELETE | `/api/admin/planner/users/[userId]` | Admin token hoặc phiên admin | Xóa người dùng: `?mode=soft` vô hiệu và đánh dấu đã xóa (khôi phục được), `?mode=hard` (mặc định) xóa hẳn; phiên chỉ xóa hẳn được tài khoản đã xóa mềm (ADR 0017) |
| POST | `/api/admin/planner/users/[userId]/ban` | Admin token hoặc phiên admin | Khóa tài khoản: kết thúc phiên, chặn mọi đăng nhập (ADR 0017) |
| POST | `/api/admin/planner/users/[userId]/unban` | Admin token hoặc phiên admin | Gỡ khóa |
| POST | `/api/admin/planner/users/[userId]/restore` | Admin token hoặc phiên admin | Khôi phục tài khoản đã xóa mềm |
| GET | `/api/admin/planner/users/[userId]/impact` | Admin token hoặc phiên admin | Đếm chuyến đi và bình luận sẽ bị xóa khi xóa vĩnh viễn |
| POST | `/api/admin/planner/users/[userId]/reset-password` | Admin token hoặc phiên admin | Cấp lại mật khẩu tạm (`user:provision`) |
| POST | `/api/admin/planner/users/[userId]/rotate-token` | Chỉ admin token | Đổi access token |
| DELETE | `/api/admin/planner/users/[userId]/google` | Chỉ admin token | Gỡ liên kết Google |
| GET | `/api/admin/planner/integrity` | Chỉ admin token | Báo cáo toàn vẹn kho Planner |
| GET | `/api/admin/overview` | Admin token hoặc phiên staff | Số đếm các thẻ bảng điều khiển, lọc theo vai trò (`content:write`) |
| GET | `/api/admin/community/queue` | Admin token hoặc phiên admin | Hàng đợi đăng chuyến, chờ duyệt trước (`community:moderate`) |
| PATCH | `/api/admin/community/trips/[id]` | Admin token hoặc phiên admin | Duyệt hoặc từ chối chuyến (`community:moderate`) |
| GET | `/api/admin/community/reviews` | Admin token hoặc phiên admin | Hàng đợi kiểm duyệt đánh giá (`community:moderate`) |
| PATCH | `/api/admin/community/reviews/[id]` | Admin token hoặc phiên admin | Duyệt, từ chối, giữ hoặc gỡ đánh giá (`community:moderate`) |
| POST | `/api/admin/community/reviews/[id]/erase` | Admin token hoặc phiên admin | Xóa vĩnh viễn nội dung review của khách theo yêu cầu xóa dữ liệu (`community:erase`, từ admin) |
| GET | `/api/planner/terms` | Du khách (cookie phiên hoặc access token) | Trạng thái Điều khoản Người tạo hiện hành |
| POST | `/api/planner/terms` | Du khách (cookie phiên hoặc access token) | Chấp nhận phiên bản Điều khoản Người tạo hiện hành (idempotent) |
| GET | `/api/planner/map/share` | Du khách (cookie phiên hoặc access token) | Trạng thái chia sẻ bản đồ của chính mình (không bao giờ có token) |
| PUT | `/api/planner/map/share` | Du khách (cookie phiên hoặc access token) | Bật hoặc tắt chia sẻ bản đồ, đặt chế độ tên; token trả một lần ở lần bật đầu (idempotent) |
| DELETE | `/api/planner/map/share` | Du khách (cookie phiên hoặc access token) | Thu hồi link chia sẻ bản đồ (idempotent) |
| POST | `/api/planner/map/share/rotate` | Du khách (cookie phiên hoặc access token) | Link chia sẻ bản đồ mới, trả một lần; link cũ chết |
| GET | `/api/admin/community/reports` | Token admin hoặc phiên admin | Hàng đợi báo cáo, `?status=open\|actioned\|dismissed` (`community:moderate`) |
| POST | `/api/admin/community/reports/[id]/resolve` | Token admin hoặc phiên admin | Bỏ qua hoặc đánh dấu đã xử lý báo cáo, idempotent, ghi một sự kiện (`community:moderate`) |
| GET | `/api/admin/audit` | Admin token hoặc phiên admin | Nhật ký quản trị: lọc `actor`, `targetType`, `action`, `from`, `to`, `limit`, `cursor` (`audit:read`) |
| GET | `/api/admin/system` | Chỉ phiên super admin | Trạng thái hệ thống: chế độ kho, migration gần nhất, bản dựng, cờ tích hợp, sức khỏe (`runbook:read`) |
| GET | `/api/admin/community/events` | Admin token hoặc phiên admin | Log kiểm toán cho một `?targetId=` (`community:moderate`) |
| GET | `/api/admin/community/restrictions` | Admin token hoặc phiên admin | Danh sách hạn chế đánh giá (`community:restrict`) |
| POST | `/api/admin/community/restrictions` | Admin token hoặc phiên admin | Hạn chế một người (`community:restrict`) |
| DELETE | `/api/admin/community/restrictions/[id]` | Admin token hoặc phiên admin | Gỡ hạn chế (`community:restrict`) |
| GET | `/api/admin/travel/places` | Admin token hoặc phiên nhân viên | Danh sách địa điểm (mọi trạng thái) |
| POST | `/api/admin/travel/places` | Admin token hoặc phiên nhân viên | Tạo địa điểm |
| GET | `/api/admin/travel/places/[slug]` | Admin token hoặc phiên nhân viên | Một địa điểm |
| PATCH | `/api/admin/travel/places/[slug]` | Admin token hoặc phiên nhân viên | Sửa địa điểm (bắt buộc If-Match) |
| DELETE | `/api/admin/travel/places/[slug]` | Admin token hoặc session admin (`content:delete`; editor bị từ chối) | Xóa địa điểm (409 `place_in_use` khi còn được tham chiếu) |
| GET | `/api/admin/travel/stories` | Admin token hoặc phiên nhân viên | Danh sách chuyện (mọi trạng thái) |
| POST | `/api/admin/travel/stories` | Admin token hoặc phiên nhân viên | Tạo chuyện |
| GET | `/api/admin/travel/stories/[slug]` | Admin token hoặc phiên nhân viên | Một chuyện |
| PATCH | `/api/admin/travel/stories/[slug]` | Admin token hoặc phiên nhân viên | Sửa chuyện (bắt buộc If-Match) |
| DELETE | `/api/admin/travel/stories/[slug]` | Admin token hoặc phiên nhân viên | Xóa chuyện |
| POST | `/api/admin/travel/stories/[slug]/status` | Admin token hoặc phiên nhân viên | Đổi trạng thái chuyện |
| GET | `/api/admin/travel/reviews` | Admin token hoặc phiên nhân viên | Danh sách đánh giá (mọi trạng thái) |
| POST | `/api/admin/travel/reviews` | Admin token hoặc phiên nhân viên | Tạo đánh giá |
| GET | `/api/admin/travel/reviews/[id]` | Admin token hoặc phiên nhân viên | Một đánh giá |
| PATCH | `/api/admin/travel/reviews/[id]` | Admin token hoặc phiên nhân viên | Sửa đánh giá (bắt buộc If-Match) |
| DELETE | `/api/admin/travel/reviews/[id]` | Admin token hoặc phiên nhân viên | Xóa đánh giá |
| POST | `/api/admin/travel/reviews/[id]/status` | Admin token hoặc phiên nhân viên | Đổi trạng thái đánh giá |
| PATCH | `/api/admin/travel/stories/[slug]/places` | Admin token hoặc phiên nhân viên | Đặt các địa điểm gắn với chuyện |
| GET | `/api/admin/travel/collections` | Chỉ admin token | Danh sách bộ sưu tập |
| POST | `/api/admin/travel/collections` | Chỉ admin token | Tạo bộ sưu tập |
| GET | `/api/admin/travel/collections/[slug]` | Chỉ admin token | Một bộ sưu tập |
| PATCH | `/api/admin/travel/collections/[slug]` | Chỉ admin token | Sửa bộ sưu tập |
| DELETE | `/api/admin/travel/collections/[slug]` | Chỉ admin token | Xóa bộ sưu tập |
| GET | `/api/admin/travel/templates` | Chỉ admin token | Danh sách mẫu |
| POST | `/api/admin/travel/templates` | Chỉ admin token | Tạo mẫu |
| GET | `/api/admin/travel/templates/[slug]` | Chỉ admin token | Một mẫu |
| PATCH | `/api/admin/travel/templates/[slug]` | Chỉ admin token | Sửa mẫu |
| DELETE | `/api/admin/travel/templates/[slug]` | Chỉ admin token | Xóa mẫu |
| POST | `/api/admin/travel/collections/[slug]/status` | Chỉ admin token | Đổi trạng thái bộ sưu tập |
| POST | `/api/admin/travel/templates/[slug]/reorder` | Chỉ admin token | Sắp xếp lại hoạt động của mẫu |
| POST | `/api/admin/travel/templates/[slug]/move-activity` | Chỉ admin token | Chuyển hoạt động của mẫu giữa các ngày |
| GET | `/api/admin/travel/integrity` | Chỉ admin token | Báo cáo toàn vẹn nội dung |

## Quy ước

- Lỗi dùng chung một phong bì với `code` ổn định; các mã nằm trong [travel-content-api.vi.md](travel-content-api.vi.md).
- Ghi vào Planner dùng khóa lạc quan: gửi `ETag` của lần đọc lại trong `If-Match`; lệch là `412 version_conflict`.
- `PATCH`/`reorder`/`move-activity` admin của Travel Content cũng bắt buộc `If-Match: "<updatedAt>"` (cả phiên lẫn token): thiếu là `428 precondition_required`, cũ là `412 version_conflict`.
- Bộ giới hạn đăng nhập (`signInLimiter`, `signInAccountLimiter`) đếm theo từng tiến trình và khóa theo giá trị đầu của `X-Forwarded-For`, nên nhiều instance thì giới hạn nhân lên và nginx **phải ghi đè** `X-Forwarded-For` (CORE-11 / S-4; chưa chia sẻ qua PostgreSQL).
- `429 rate_limited` kèm `Retry-After`. Giới hạn theo từng tiến trình và khóa client có thể bị giả ([ADR 0005](adr/0005-trip-sharing-and-story-cloning.vi.md)).
- Phản hồi admin là `no-store`.
- **Chia sẻ bản đồ thành viên (ADR 0030) — ghi chú vận hành.**
  - *Khoá client (L1).* Bộ giới hạn đọc của trang công khai khoá theo hop đầu của `X-Forwarded-For` (`src/server/rate-limit.ts`, `clientKey`). Chỉ an toàn khi cổng app **chỉ** truy cập được qua nginx, nơi ghi đè header; client chạm thẳng được cổng sẽ tự chọn bucket. `TRUST_PROXY_HEADERS=true` chỉ điều khiển cờ `Secure` của cookie và scheme, không đổi bộ giới hạn.
  - *JSON sang PostgreSQL (L3).* Export bỏ mọi digest chia sẻ và import không ghi digest nào, nên chuyển Planner từ file JSON sang PostgreSQL **làm chết mọi link bản đồ đang chạy**. Báo thành viên trước; mỗi người phải bật chia sẻ lại (link mới).
  - *`error.log` của nginx (L5).* `access_log` tắt cho `/shared-map/*` và `/ban-do-chia-se/*`, nhưng nginx vẫn có thể ghi dòng request, gồm cả token, vào `error.log` (lỗi upstream hay timeout). Giới hạn người đọc được, giữ thời gian ngắn (xoay vòng ở `deploy/logrotate/chuyennhahung`), và không dán vào ticket hay chat khi chưa che `/shared-map/<token>`.
  - *Tài khoản bị vô hiệu.* Khoá hay xoá mềm thành viên tắt link của họ vĩnh viễn; khôi phục không đem link về.
