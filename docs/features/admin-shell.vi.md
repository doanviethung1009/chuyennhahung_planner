# Feature — Khung quản trị

🇻🇳 English version: [admin-shell.md](admin-shell.md)

## Tóm tắt

Một khung chung cho mọi trang quản trị: thanh bên theo nhóm và theo vai trò, breadcrumb, skip link và menu điện thoại hoạt động được. `/admin` thành trang tổng quan tối giản (số liệu dashboard đến cùng P07-11) và bảng người dùng được chuyển nguyên vẹn sang `/admin/users`. Quyết định thiết kế: [ADR 0020](../adr/0020-admin-workspace-shell.vi.md).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `/admin/users` | `/quan-tri/nguoi-dung` | `/en/admin/users` |

Mọi URL quản trị khác giữ nguyên. `/admin/users` là `noindex`, là `returnTo` hợp lệ (giữ query) và cần quyền `user:provision`.

## Dữ liệu

Không có dữ liệu và không đổi API. Khoá thông điệp: `adminContent.nav` (nhóm, liên kết, menu, skip, breadcrumb) và `adminContent.overview` (tiêu đề, mô tả) ở cả hai catalogue.

## Cách hoạt động

`src/app/[locale]/admin/layout.tsx` đọc `readStaffPageAccess()` (bọc `cache()`, nên chỉ chạy một lần mỗi request) và chỉ vẽ khung cho nhân sự. Layout không bao giờ redirect hay 404: mỗi trang vẫn tự gọi `requireStaff` với `returnTo` riêng; với người khác thì trang redirect hoặc 404 và khung không được vẽ. `adminSidebarGroups(principal)` trong `src/lib/admin-gate.ts` là hàm thuần của `can()`, trả về các nhóm mà vai trò được thấy (biên tập viên không thấy Người dùng hay Vận hành; nhóm rỗng bị bỏ; Media chưa hiển thị đến Phase 08). `AdminSidebar` là client island chỉ để bật/tắt menu điện thoại và `aria-current` (khớp trang của liên kết và các trang chi tiết). Ẩn liên kết không phải là phân quyền.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/admin/layout.tsx` | Khung: skip link, thanh bên, breadcrumb |
| `src/components/admin/admin-sidebar.tsx` | `AdminSidebar` và `AdminBreadcrumb` (thay `AdminNav`) |
| `src/lib/admin-gate.ts` | `adminSidebarGroups` |
| `src/app/[locale]/admin/users/page.tsx` | Bảng người dùng, đã chuyển |
| `src/app/[locale]/admin/page.tsx` | Trang tổng quan |
| `src/server/planner/admin-page.ts` | `readStaffPageAccess` trong `cache()` |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route `/admin/users` và mục `returnTo` |

## Test

`tests/admin-portal.test.ts`: route mới và các ca gần-đúng của `returnTo`, nối dây layout và trang, hiển thị thanh bên theo vai trò. `tests/runbook.test.ts`: liên kết Runbook bị ẩn nếu không có `runbook:read`. `tests/i18n.test.ts`, `tests/docs.test.ts`, `tests/client-boundary.test.ts` kiểm tra đồng bộ, tài liệu và ranh giới client.

## Giới hạn và câu hỏi còn mở

Đường dẫn `/quan-tri` đã được lưu nay hiện trang tổng quan, không còn là bảng người dùng. Số liệu dashboard, các màn hình nhật ký, hệ thống, bộ sưu tập và `/admin/users/roles` là các task riêng (P07-11 đến P07-18); khi chưa có, liên kết của chúng không được hiển thị. Lượt kiểm tra giao diện 375/768/1280px được ghi trong PR.
