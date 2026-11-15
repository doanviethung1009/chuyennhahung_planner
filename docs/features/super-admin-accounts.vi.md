# Feature — Tài khoản super admin

🇻🇳 English version: [super-admin-accounts.md](super-admin-accounts.md)

## Summary

Role `super_admin` cao hơn `admin` ([ADR 0017](../adr/0017-super-admin-role.vi.md)). Chỉ super admin mở được tab Runbook, và admin không còn chiếm được tài khoản admin khác. Khóa và xóa tài khoản staff làm ở PR sau.

## Routes

Không có route mới. `/admin/runbook` (`/quan-tri/runbook`, `/en/admin/runbook`) nay trả 404 cho mọi người trừ super admin.

## Data

`Role` là `member | editor | admin | super_admin`, lưu trên dòng user (chỉ thêm, không migration). Action mới `runbook:read`, chỉ `super_admin` có. Khóa message `admin.roles.super_admin`.

## How it works

1. `can(super_admin)` = mọi action của admin + `runbook:read`.
2. `requireStaff(..., 'runbook')` chặn trang; `AdminNav` hiện liên kết theo `canRunbook`.
3. `canManageRole(actor, target)`: phiên admin chỉ tạo, đổi role hoặc đặt lại mật khẩu cho tài khoản `member` và `editor`; super admin hoặc service token thao tác trên mọi tài khoản. Kiểm tra chạy lại trong transaction nên actor đã bị hạ role bị từ chối.
4. `super_admin` cuối cùng không bị hạ role hay xóa; `admin` và `super_admin` đều tính khi xét "admin cuối cùng".
5. Tạo super admin đầu tiên bằng service token: `PATCH /api/admin/planner/users/:id` body `{"role":"super_admin"}`.

## Files

| Path | Vai trò |
|---|---|
| `src/server/identity/permissions.ts` | `super_admin`, `runbook:read`, `isAdminRole`, `canManageRole` |
| `src/server/planner/repository.ts` | Actor guards in `createUser`, `setUserRole`, `resetUserPassword`; last-super-admin guard; admin session lifetime |
| `src/app/api/admin/planner/users/route.ts` | Truyền actor phiên cho `createUser` |
| `src/lib/admin-gate.ts` | `requireStaff(..., 'runbook')`, `canRunbook` |
| `src/components/admin/admin-nav.tsx` | Runbook link by `canRunbook` |
| `src/components/admin/{types,user-table,create-user-form,admin-console}.tsx` | Role choices limited to what the actor may assign |
| `messages/{vi,en}.json` | `admin.roles.super_admin` |
| `tests/super-admin.test.ts`, `tests/planner-roles.test.ts`, `tests/runbook.test.ts` | xem Tests |

## Tests

`tests/super-admin.test.ts` kiểm tra admin không tạo hay nâng lên `admin`/`super_admin`, không đổi role hay đặt lại mật khẩu super admin, actor đã bị hạ role bị từ chối, super admin làm được, và guard super admin cuối cùng. `tests/planner-roles.test.ts` ghim ma trận quyền; `tests/runbook.test.ts` ghim cổng và nút nav. Chưa kiểm thử: cổng trang trong trình duyệt; bộ chọn role trên UI.

## Limits and open questions

- Admin hiện tại mất Runbook và quyền quản lý admin khác cho tới khi có super admin đầu tiên.
- Khóa/bỏ khóa và xóa staff chưa có trong PR này.
- Khuyến nghị review `/sec-check`, chưa chạy.
