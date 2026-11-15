# Feature — Tài khoản super admin

🇻🇳 English version: [super-admin-accounts.md](super-admin-accounts.md)

## Summary

Role `super_admin` cao hơn `admin` ([ADR 0017](../adr/0017-super-admin-role.vi.md)). Chỉ super admin mở được tab Runbook, và admin không còn chiếm được tài khoản admin khác. Tài khoản staff (editor, admin, super admin) còn khóa, xóa mềm, khôi phục hoặc xóa vĩnh viễn được.

## Routes

API: `POST /api/admin/planner/users/[userId]/ban`, `/unban`, `/restore`; `DELETE .../[userId]?mode=soft|hard`. Trang: `/admin/runbook` (`/quan-tri/runbook`, `/en/admin/runbook`) nay trả 404 cho mọi người trừ super admin.

## Data

`Role` là `member | editor | admin | super_admin`, lưu trên dòng user (chỉ thêm, không migration). Action mới `runbook:read`, chỉ `super_admin` có. Trường user `bannedAt/bannedBy`, `deletedAt/deletedBy` (tùy chọn). Khóa message dưới `admin.users` (`ban`, `unban`, `delete`, `restore`, `purge`, `status*`) và `admin.status.*Done`. Khóa message `admin.roles.super_admin`.

## How it works

1. `can(super_admin)` = mọi action của admin + `runbook:read`.
2. `requireStaff(..., 'runbook')` chặn trang; `AdminNav` hiện liên kết theo `canRunbook`.
3. `canManageRole(actor, target)`: phiên admin chỉ tạo, đổi role hoặc đặt lại mật khẩu cho tài khoản `member` và `editor`; super admin hoặc service token thao tác trên mọi tài khoản. Kiểm tra chạy lại trong transaction nên actor đã bị hạ role bị từ chối.
4. `super_admin` cuối cùng không bị hạ role hay xóa; `admin` và `super_admin` đều tính khi xét "admin cuối cùng".
4a. `npm run admin:create -- --email … --name … --role member|editor|admin|super_admin` (mặc định `admin`) tạo tài khoản với role đó thẳng trong store, không cần token. Lệnh curl tương đương nằm ở `docs/deploy-runbook.vi.md` Phase 7.
5. Khóa và xóa mềm đánh dấu user *bị vô hiệu*: phiên bị xóa ngay và đăng nhập bằng cookie, access token, mật khẩu hay Google đều bị từ chối; dữ liệu giữ nguyên. Mở khóa và khôi phục bật lại. Xóa mềm chỉ vô hiệu và đánh dấu tài khoản (vẫn nằm trong danh sách staff với nhãn "Đã xóa"), xóa cứng (`?mode=hard`, mặc định) xóa dòng và từ chối khi user còn trip; phiên chỉ xóa cứng được tài khoản staff đã xóa mềm. Chỉ tài khoản staff, không bao giờ chính mình, admin chỉ với editor, và tài khoản bị vô hiệu không còn tính là "admin cuối cùng". Trong bảng user mỗi dòng có Cấp lại mật khẩu / Khóa / Xóa (mềm), hoặc Mở khóa, hoặc Khôi phục / Xóa vĩnh viễn, đều có bước xác nhận.
6. Tạo super admin đầu tiên bằng service token: `PATCH /api/admin/planner/users/:id` body `{"role":"super_admin"}`.

## Files

| Path | Vai trò |
|---|---|
| `src/server/identity/permissions.ts` | `super_admin`, `runbook:read`, `isAdminRole`, `canManageRole` |
| `src/server/planner/repository.ts` | Actor guards in `createUser`, `setUserRole`, `resetUserPassword`; last-super-admin guard; admin session lifetime |
| `src/app/api/admin/planner/users/route.ts` | Truyền actor phiên cho `createUser` |
| `src/app/api/admin/planner/users/[userId]/{ban,unban,restore}/route.ts`, `.../[userId]/route.ts` | Các route vòng đời; `DELETE ?mode` |
| `tests/account-lifecycle.test.ts` | Test vòng đời |
| `src/lib/admin-gate.ts` | `requireStaff(..., 'runbook')`, `canRunbook` |
| `src/components/admin/admin-nav.tsx` | Runbook link by `canRunbook` |
| `src/components/admin/{types,user-table,create-user-form,admin-console}.tsx` | Role choices limited to what the actor may assign |
| `messages/{vi,en}.json` | `admin.roles.super_admin` |
| `tests/super-admin.test.ts`, `tests/planner-roles.test.ts`, `tests/runbook.test.ts` | xem Tests |

## Tests

`tests/super-admin.test.ts` kiểm tra admin không tạo hay nâng lên `admin`/`super_admin`, không đổi role hay đặt lại mật khẩu super admin, actor đã bị hạ role bị từ chối, super admin làm được, và guard super admin cuối cùng. `tests/account-lifecycle.test.ts` kiểm tra khóa kết thúc phiên và chặn đăng nhập bằng cookie, bearer, access token, mật khẩu, Google, mở khóa và khôi phục hoàn tác được, xóa mềm giữ trip, quy tắc xóa cứng chỉ qua xóa mềm với phiên, và các guard chính mình / role / admin cuối cùng. `tests/planner-roles.test.ts` ghim ma trận quyền; `tests/runbook.test.ts` ghim cổng và nút nav. Chưa kiểm thử: cổng trang trong trình duyệt; bộ chọn role trên UI.

## Limits and open questions

- Admin hiện tại mất Runbook và quyền quản lý admin khác cho tới khi có super admin đầu tiên.
- Xóa mềm vẫn giữ email và handle; chưa có job tự xóa vĩnh viễn sau N ngày.
- Nội dung công khai (trip niêm yết, đánh giá đã duyệt) của user bị khóa hoặc xóa mềm vẫn hiển thị; chỉ chặn đăng nhập. Muốn ẩn cần một thay đổi riêng.
- Không khóa hay xóa mềm được member (dùng hạn chế đánh giá, ADR 0015).
- Khuyến nghị review `/sec-check`, chưa chạy.
