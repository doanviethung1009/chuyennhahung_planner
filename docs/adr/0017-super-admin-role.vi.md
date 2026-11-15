# ADR 0017 — Role super admin và ai được quản lý ai

🇻🇳 English version: [0017-super-admin-role.md](0017-super-admin-role.md)

- **Status:** Accepted (phần 1 đã hiện thực; ban/xóa ở PR sau)
- **Date:** 2026-11-16
- **Owner:** system-architect

## Context

[ADR 0006](0006-unified-identity-and-roles.vi.md) có ba role; mọi `admin` đều nâng được ai đó lên `admin`, đặt lại mật khẩu mọi tài khoản và đọc Runbook vận hành (ADR 0010/0011). Hai lỗ hổng: Runbook (danh sách API, hướng dẫn deploy và database) mở cho mọi admin, và một admin bị lộ hoặc bất cẩn có thể chiếm tài khoản admin khác bằng cách đặt lại mật khẩu. Chủ dự án muốn một role cao hơn `admin`.

## Decision

1. `Role` thêm `super_admin`: có mọi action của `admin` cộng action mới `runbook:read`. `admin` và `editor` **không** có `runbook:read`.
2. Trang Runbook được chặn bằng `requireStaff(..., 'runbook')` (`can(role, 'runbook:read')`); người khác nhận 404, nút nav chỉ hiện cho `runbook:read`.
3. `canManageRole(actor, target)`: `super_admin` hoặc service token thao tác trên mọi tài khoản; `admin` chỉ thao tác trên `member` và `editor`. Áp dụng cho `createUser`, `setUserRole` (cả role hiện tại lẫn role mới) và `resetUserPassword`. Bị từ chối trả `403 forbidden`.
4. Guard số lượng: `admin` và `super_admin` đều tính là có quyền quản trị khi xét "admin cuối cùng"; `super_admin` cuối cùng không bị hạ role hay xóa, kể cả bằng service token.
5. `super_admin` dùng vòng đời phiên của admin (ADR 0010 §4). Không thêm route, không migration schema: giá trị role chỉ thêm mới.
6. Super admin đầu tiên được tạo bằng service token (`PATCH /api/admin/planner/users/:id` với `{"role":"super_admin"}`) — phiên admin không cấp được.

Khóa và xóa tài khoản staff (quyết định của chủ dự án: khóa kết thúc phiên ngay và chặn cookie, bearer, Google; xóa giữ xóa cứng hiện có; admin khóa/xóa được editor, chỉ super admin thao tác trên admin và super admin) làm ở PR riêng và mở rộng ADR này.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chọn): role mới kèm action `runbook:read` | Khớp bản đồ `can` hiện có; một chỗ để mở rộng | Admin hiện tại mất Runbook cho tới khi có super admin |
| B: giữ `admin`, chặn Runbook bằng danh sách id user | Không đổi role | Thêm cơ chế phân quyền thứ hai bên cạnh role |

B thua vì thêm một danh sách truy cập song song phải kiểm toán.

## Consequences

Dễ hơn: Runbook giới hạn cho một role tin cậy; admin không tự leo thang hay chiếm admin khác. Khó hơn: trên hệ thống đang chạy, chưa ai mở được Runbook hay quản lý admin cho tới khi service token nâng super admin đầu tiên; rollback code khi còn dòng `super_admin` sẽ lỗi schema role cũ, nên hạ họ trước. Role vẫn lưu trên từng user và đọc lại mỗi request nên thay đổi có hiệu lực ngay.

## Follow-up

Ban/unban và xóa staff (PR kế, mở rộng ADR này); chạy `/sec-check`; cập nhật `docs/architecture.vi.md`, `docs/usage.vi.md` và tài liệu tính năng [super-admin-accounts](../features/super-admin-accounts.vi.md).
