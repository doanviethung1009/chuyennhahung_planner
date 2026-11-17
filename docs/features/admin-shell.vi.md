# Feature — Khung quản trị

🇻🇳 English version: [admin-shell.md](admin-shell.md)

## Tóm tắt

Một khung chung cho mọi trang quản trị, trong root layout riêng tách khỏi website khách (không có header, nav hay footer công khai): thanh trên gọn, thanh bên theo nhóm và theo vai trò, breadcrumb, skip link, menu điện thoại và một `AdminPageHeader` gọn cho mỗi trang. `/admin` thành trang tổng quan tối giản (số liệu dashboard đến cùng P07-11) và bảng người dùng được chuyển nguyên vẹn sang `/admin/users`. Quyết định thiết kế: [ADR 0020](../adr/0020-admin-workspace-shell.vi.md) và [ADR 0023](../adr/0023-admin-root-layout.vi.md) (P07-19).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |
| `/admin/users` | `/quan-tri/nguoi-dung` | `/en/admin/users` |

Mọi URL quản trị khác giữ nguyên; các trang chỉ chuyển chỗ trên đĩa sang `src/app/(admin)/[locale]/admin/**`, URL không đổi. `/admin/users` là `noindex`, là `returnTo` hợp lệ (giữ query) và cần quyền `user:provision`.

## Dữ liệu

Không có dữ liệu và không đổi API. Khoá thông điệp: `adminContent.nav` (nhóm, liên kết, menu, skip, breadcrumb, brand, viewSite), `adminContent.notFound` và `adminContent.overview` (tiêu đề, mô tả) ở cả hai catalogue.

## Cách hoạt động

`src/app/(admin)/[locale]/admin/layout.tsx` đọc `readStaffPageAccess()` (bọc `cache()`, nên chỉ chạy một lần mỗi request) và chỉ vẽ khung cho nhân sự. Layout không bao giờ redirect hay 404: mỗi trang vẫn tự gọi `requireStaff` với `returnTo` riêng; với người khác thì trang redirect hoặc 404 và khung không được vẽ. `adminSidebarGroups(principal)` trong `src/lib/admin-gate.ts` là hàm thuần của `can()`, trả về các nhóm mà vai trò được thấy (biên tập viên không thấy Người dùng hay Vận hành; nhóm rỗng bị bỏ; Media chưa hiển thị đến Phase 08). `AdminSidebar` là client island cho `aria-current` (khớp trang của liên kết và các trang chi tiết). Ẩn liên kết không phải là phân quyền.

P07-19 (ADR 0023) cho admin root layout riêng (`src/app/(admin)/[locale]/layout.tsx`: `<html>`, font dùng chung, `noindex`, không có `SiteHeader`/`SiteFooter`). `AdminTopBar` (dính, `--admin-bar-h`) chứa thương hiệu, Xem trang chính, ngôn ngữ, handle và vai trò, và `AdminSignOut`; dưới 768px nó giữ thương hiệu và một nút Menu, panel của nút (`AdminMobileMenu`) chứa các nhóm và thao tác tài khoản, đóng khi chuyển trang hoặc bấm Escape. Thanh bên dính dưới thanh trên (12rem từ `md`, 16rem từ `xl`) và tự cuộn; mục đang chọn có thanh primary 3px, nền nhạt và chữ đậm 600, không chỉ dựa vào màu; Tổng quan là một liên kết trên cùng. `AdminPageHeader` (`title`, `description?`, `actions?`) là h1 duy nhất của mỗi trang admin. Một `not-found` admin duy nhất phục vụ cả vai trò bị cấm lẫn URL admin không tồn tại (hai catch-all `[...rest]` dẫn tới nó), nên trang 404 không tiết lộ gì.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/app/(admin)/[locale]/layout.tsx`, `not-found.tsx` | Root layout admin và trang 404 admin duy nhất |
| `src/app/(admin)/[locale]/{admin,quan-tri}/[...rest]/page.tsx` | URL admin không tồn tại dẫn tới 404 admin |
| `src/app/fonts.ts` | Font dùng chung cho hai root layout |
| `src/app/(admin)/[locale]/admin/layout.tsx` | Khung: skip link, thanh trên, thanh bên, breadcrumb, `<main>` |
| `src/components/admin/admin-top-bar.tsx`, `admin-sign-out.tsx`, `admin-page-header.tsx` | Thanh trên, đăng xuất, tiêu đề trang |
| `src/components/admin/admin-sidebar.tsx` | `AdminSidebar`, `AdminMobileMenu`, `AdminBreadcrumb` |
| `src/lib/admin-gate.ts` | `adminSidebarGroups` |
| `src/app/(admin)/[locale]/admin/users/page.tsx` | Bảng người dùng, đã chuyển |
| `src/app/(admin)/[locale]/admin/page.tsx` | Trang tổng quan |
| `src/server/planner/admin-page.ts` | `readStaffPageAccess` trong `cache()` |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route `/admin/users` và mục `returnTo` |

## Test

`tests/admin-layout.test.ts` (ADR 0023): layout admin không có chrome công khai, một module font, `AdminPageHeader` trên mọi trang, một 404 admin cho vai trò bị cấm và URL không tồn tại, markup header và thanh bên. `tests/admin-portal.test.ts`: route mới và các ca gần-đúng của `returnTo`, nối dây layout và trang, hiển thị thanh bên theo vai trò. `tests/runbook.test.ts`: liên kết Runbook bị ẩn nếu không có `runbook:read`. `tests/i18n.test.ts`, `tests/docs.test.ts`, `tests/client-boundary.test.ts` kiểm tra đồng bộ, tài liệu và ranh giới client.

## Giới hạn và câu hỏi còn mở

Đường dẫn `/quan-tri` đã được lưu nay hiện trang tổng quan, không còn là bảng người dùng. Số liệu dashboard, các màn hình nhật ký, hệ thống, bộ sưu tập và `/admin/users/roles` là các task riêng (P07-11 đến P07-18); khi chưa có, liên kết của chúng không được hiển thị. Lượt kiểm tra giao diện 375/768/1280px được ghi trong PR. Liên kết của bộ chuyển ngôn ngữ cao 36px (component dùng chung không đổi); chuyển giữa admin và website khách là tải lại cả trang.
