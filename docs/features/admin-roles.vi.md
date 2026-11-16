# Tính năng — Vai trò admin

🇬🇧 English version: [admin-roles.md](admin-roles.md)

## Tóm tắt

Mỗi user của Planner nay mang một vai trò — `member`, `editor` hoặc `admin` — và
người vận hành giữ `ADMIN_API_TOKEN` có thể tạo hoặc nâng admin đầu tiên. Đây là
bước 1–2 của [ADR 0006](../adr/0006-unified-identity-and-roles.vi.md): vai trò được
ghi lại và phân giải, nhưng chưa có gì trong đường xử lý request áp dụng nó, nên
hành vi người dùng thấy không đổi. *Lịch sử:* các thay đổi sau đã áp dụng nó — xem
[admin-portal.vi.md](admin-portal.vi.md), [admin-content-cms.vi.md](admin-content-cms.vi.md) và
[super-admin-accounts.vi.md](super-admin-accounts.vi.md) (thêm `super_admin`).

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `PATCH /api/admin/planner/users/[userId]` | như nhau | như nhau |
| `POST /api/admin/planner/users` (thêm `role` tùy chọn) | như nhau | như nhau |

Route API không được bản địa hóa. Route PATCH chỉ được chặn bằng admin token; cookie
session, hoặc không có token, trả 401.

## Dữ liệu

`PlannerUser.role` là tùy chọn (`member` | `editor` | `admin`); dòng lưu trước thay
đổi này không có và được đọc là `member`. User công khai luôn trả `role` đã phân
giải. `PlannerIdentity.role` được phân giải mỗi request từ dòng user.
`createdVia: 'google'` không bao giờ cấp vai trò: lần đăng nhập Google đầu tiên lưu
`role: 'member'`.

## Cách hoạt động

`src/server/identity/permissions.ts` là hàm thuần. `userRole(user)` là nơi duy nhất
biến role vắng mặt thành `member`; việc đọc không bao giờ ghi lại dòng đã lưu.
`can(principal, action)` tra một bảng tĩnh: `member` không có gì; `editor` có
`template:write` và `story:publish`; `admin` có thêm `user:provision` và
`user:promote`; `service` có cả bốn. `trip:support-read` được giữ tên và không cấp
cho ai. Role hoặc action lạ đều bị từ chối. (Ở bước này chưa route nào gọi `can`; nay mọi route và trang quản trị đều gọi.)

`PATCH` parse `{ role }` bằng schema strict (key thừa như `email` là 422, vì route
này cấp đặc quyền), rồi gọi `setUserRole`. Cùng một role lần nữa trả 200 và không
ghi gì, nên `updatedAt` không đổi. Cho phép hạ vai trò và không có chốt
"admin cuối cùng"; token luôn nâng lại được. Session không bị thu hồi: `identify`
đọc role mỗi request. User không tồn tại là 404. Lỗi validation dùng dạng
`validation_failed` / 422 sẵn có chung với các route anh em.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/server/identity/permissions.ts` | `Role`, `Action`, `ROLE_ACTIONS`, `can`, `userRole` |
| `src/server/planner/schemas.ts` | `role` trên user đã lưu, khi tạo và công khai; schema cập nhật role strict |
| `src/server/planner/auth.ts` | `PlannerIdentity.role`, gán ở đường bearer |
| `src/server/planner/repository.ts` | `identify` (đường cookie), `createUser`, `setUserRole`, tạo user từ Google |
| `src/app/api/admin/planner/users/route.ts` | POST nhận `role` |
| `src/app/api/admin/planner/users/[userId]/route.ts` | `PATCH` mới |
| `tests/planner-roles.test.ts` | các bất biến bên dưới |

## Kiểm thử

`tests/planner-roles.test.ts` khẳng định: dòng cũ được đọc là `member` mà không bị
ghi lại; `identify` trả role đã lưu ở cả đường cookie và bearer; toàn bộ ma trận
`can`, gồm `trip:support-read` bị từ chối với tất cả và role lạ bị từ chối; PATCH
nâng vai trò, lặp lại idempotent, hạ vai trò, 404, 401 (không token, token sai,
session member) và 422 (không hợp lệ, thiếu, key thừa); POST có, không có và có role
không hợp lệ; admin token và session role admin vẫn không đọc được trip của người
khác; không có `tokenHash`, `passwordHash` hay `googleSub` trong bất kỳ user công
khai nào; đăng nhập Google lần đầu là `member`.

## Giới hạn và câu hỏi mở

*Ở bước này* chưa có gì áp dụng vai trò; cổng quản trị, CMS nội dung và ADR 0017 nay đã áp dụng. PATCH hoàn toàn dựa vào `ADMIN_API_TOKEN` (giới hạn tốc độ và so
sánh timing-safe nằm ở `adminPlannerRoute`). Chưa có nhật ký audit, giao diện admin,
route admin qua session, MFA hay identity provider (ADR 0006 bước 3–4). Các câu hỏi
mở cho chủ nhà trong ADR vẫn còn: chọn provider, ai là admin, và `admin` có bắt buộc
MFA không.
