# ADR 0017 — Role super admin và ai được quản lý ai

🇻🇳 English version: [0017-super-admin-role.md](0017-super-admin-role.md)

- **Status:** Accepted (hiện thực qua hai PR)
- **Date:** 2026-11-16
- **Owner:** system-architect

## Context

[ADR 0006](0006-unified-identity-and-roles.vi.md) có ba role; mọi `admin` đều nâng được ai đó lên `admin`, đặt lại mật khẩu mọi tài khoản và đọc Runbook vận hành (ADR 0010/0011). Hai lỗ hổng: Runbook (danh sách API, hướng dẫn deploy và database) mở cho mọi admin, và một admin bị lộ hoặc bất cẩn có thể chiếm tài khoản admin khác bằng cách đặt lại mật khẩu. Chủ dự án muốn một role cao hơn `admin`.

## Decision

1. `Role` thêm `super_admin`: có mọi action của `admin` cộng action mới `runbook:read`. `admin` và `editor` **không** có `runbook:read`.
2. Trang Runbook được chặn bằng `requireStaff(..., 'runbook')` (`can(role, 'runbook:read')`); người khác nhận 404, nút nav chỉ hiện cho `runbook:read`.
3. `canManageRole(actor, target)`: `super_admin` hoặc service token thao tác trên mọi tài khoản; `admin` chỉ thao tác trên `member` và `editor`. Áp dụng cho `createUser`, `setUserRole` (cả role hiện tại lẫn role mới) và `resetUserPassword`. Bị từ chối trả `403 forbidden`.
4. Guard số lượng: `admin` và `super_admin` đều tính là có quyền quản trị khi xét "admin cuối cùng"; `super_admin` cuối cùng không bị hạ role hay xóa, kể cả bằng service token.
5. `super_admin` dùng vòng đời phiên của admin (ADR 0010 §4). Không thêm route. Giá trị role chỉ thêm mới, nhưng trên PostgreSQL phải nới CHECK của role (migration 0002) và thêm các cột khóa / xóa mềm: **migration 0009** (rollback ở `db/rollback/`). Thiếu nó, đặt `super_admin` sẽ lỗi 500.
6. Super admin đầu tiên được tạo bằng service token (`PATCH /api/admin/planner/users/:id` với `{"role":"super_admin"}`) — phiên admin không cấp được.

7. **Vòng đời tài khoản (PR thứ hai).** `bannedAt/bannedBy` và `deletedAt/deletedBy` là các trường tùy chọn trên user. Tài khoản bị khóa hoặc xóa mềm là *vô hiệu*: mọi phiên bị xóa ngay, và `identify` (cookie lẫn bearer), đăng nhập bằng access token, bằng mật khẩu và bằng Google đều từ chối (Google coi như `account_not_found`, không có câu trả lời riêng và không đăng ký lách qua). Trip, đánh giá và thông tin đăng nhập giữ nguyên; mở khóa hoặc khôi phục sẽ bật lại.
8. Xóa có hai chế độ (quyết định của chủ dự án): **mềm** (`DELETE ?mode=soft`: vô hiệu và đánh dấu đã xóa, khôi phục bằng `POST .../restore`) và **cứng** (`DELETE ?mode=hard`, mặc định như trước: xóa dòng, từ chối khi tài khoản còn trip). Phiên chỉ xóa cứng được tài khoản staff đã xóa mềm trước; service token giữ đường trực tiếp.
9. Khóa, xóa mềm và khôi phục áp dụng cho mọi tài khoản (member, editor, admin, super admin; chủ dự án mở rộng từ chỉ staff), không bao giờ cho chính mình, và admin chỉ thao tác trên tài khoản member và editor (`canManageRole`). Tài khoản bị khóa hoặc đã xóa không đổi role được cho tới khi mở khóa hoặc khôi phục. Tài khoản bị vô hiệu không còn được tính là "admin cuối cùng" hay "super admin cuối cùng", và actor bị vô hiệu không thao tác được.
10. Không thêm tên Action: các route dùng lại `user:provision`. Route mới: `POST .../ban`, `.../unban`, `.../restore`; `DELETE` nay nhận cả phiên.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chọn): role mới kèm action `runbook:read` | Khớp bản đồ `can` hiện có; một chỗ để mở rộng | Admin hiện tại mất Runbook cho tới khi có super admin |
| B: giữ `admin`, chặn Runbook bằng danh sách id user | Không đổi role | Thêm cơ chế phân quyền thứ hai bên cạnh role |

B thua vì thêm một danh sách truy cập song song phải kiểm toán.

## Consequences

Dễ hơn: Runbook giới hạn cho một role tin cậy; admin không tự leo thang hay chiếm admin khác. Khó hơn: trên hệ thống đang chạy, chưa ai mở được Runbook hay quản lý admin cho tới khi service token nâng super admin đầu tiên; rollback code khi còn dòng `super_admin` sẽ lỗi schema role cũ, nên hạ họ trước. Role vẫn lưu trên từng user và đọc lại mỗi request nên thay đổi có hiệu lực ngay.

## Follow-up

Chạy `/sec-check` cho PR vòng đời tài khoản; cập nhật `docs/architecture.vi.md`, `docs/usage.vi.md` và tài liệu tính năng [super-admin-accounts](../features/super-admin-accounts.vi.md).
