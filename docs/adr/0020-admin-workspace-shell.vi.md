# ADR 0020 — Khung Admin Workspace: một layout, sidebar theo nhóm, `/admin` là dashboard

🇻🇳 English version: [0020-admin-workspace-shell.md](0020-admin-workspace-shell.md)

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-11-17
- **Chủ trì:** system-architect
- **Ảnh hưởng:** `src/app/[locale]/admin/**`, `src/components/admin/admin-nav.tsx`, `src/i18n/routing.ts`, `src/lib/return-to.ts`, `src/server/identity/permissions.ts` (một action), `messages/*.json`
- **Thuộc:** Phase 07 (Admin Portal, CMS & RBAC); thiết kế ở [specs-admin-workspace.vi.md](../specs-admin-workspace.vi.md)

## Bối cảnh

Admin portal lớn lên từng trang (ADR 0010, 0011, 0017). Không có layout dùng chung; mỗi trang tự
vẽ header và một hàng nút phẳng, và `/quan-tri` là bảng người dùng với admin. Phase 07 còn liệt kê
audit log và CMS create/delete, Phase 10 thêm báo cáo và sự kiện, Phase 08 thêm media. Mỗi thứ cần
một mục điều hướng và một chỗ để đặt, trong khi route gốc hiện nghĩa là "quản lý người dùng", thứ
mà đa số staff không cần trước tiên.

Điều chưa biết: bảng phải liệt kê bao nhiêu user (hiện không phân trang), và có admin nào đã đánh
dấu `/quan-tri` với kỳ vọng thấy bảng hay không.

## Quyết định

1. **Một `layout.tsx`** dưới `src/app/[locale]/admin/` sở hữu sidebar, skip link và breadcrumb.
   Các trang giữ cổng `requireStaff` và một `<h1>` riêng. Lần đọc quyền staff được bọc `cache()` để
   chạy một lần mỗi request.
2. **Sidebar theo nhóm, nhận biết role** thay `AdminNav`: Overview, Content, Community, People,
   Media (ẩn tới Phase 08), Operations. Hiển thị lấy từ `can()`; đó không phải phân quyền.
3. **`/admin` thành dashboard**; console người dùng chuyển nguyên vẹn sang `/admin/users`
   (`/quan-tri/nguoi-dung`). Mọi URL hiện có khác được giữ.
4. **Route mới** được thêm vào `pathnames` và allow-list `returnTo`: `/admin/users`,
   `/admin/users/roles`, `/admin/content/collections`, `/admin/content/integrity`, `/admin/audit`,
   `/admin/system`.
5. **Một action mới, `audit:read`** (admin, super admin, service). Mọi thứ khác dùng lại action có sẵn.
6. **Không store dữ liệu mới, không đường xác thực mới.** Các màn hình gọi API hiện có hoặc API bổ sung.

## Các phương án đã cân nhắc

| Phương án | Đánh giá |
|---|---|
| Giữ `/admin` là users, thêm `/admin/overview` | An toàn cho bookmark, nhưng điểm vào vẫn là màn ít dùng nhất và editor vẫn vào một trang sơ sài |
| Chỉ sidebar trong `AdminNav`, không layout | Mỗi trang vẫn lặp header và nav; không có breadcrumb hay menu mobile ở một chỗ |
| Ứng dụng admin riêng hoặc framework admin hosted | Trùng lặp xác thực và component; vi phạm tái sử dụng và CLAUDE.md quy tắc 6 |
| **Layout + sidebar + dashboard ở `/admin` (chọn)** | Một khung, route chỉ thêm vào, một màn hình được chuyển |

## Hệ quả

- Tích cực: màn mới cắm vào một khung; editor có trang đầu hữu ích; tính năng Phase 10 và 08 có chỗ được định nghĩa.
- Tiêu cực: `/quan-tri` đã đánh dấu giờ hiện dashboard; các assertion về route `/admin` trong `tests/admin-portal.test.ts` đổi.
- Rủi ro: layout đọc session nhiều hơn hiện nay một lần (giảm nhẹ bằng `cache()`); route được chuyển phải giữ các redirect mật khẩu tạm và `returnTo`.
- Rollback: khôi phục nội dung `page.tsx` cũ và `AdminNav`; các route mới có thể để không có link. Không có dữ liệu cần hoàn tác.
- Việc tiếp theo: các contract `P07-10`…`P07-18` trong `.claude/contracts/`; trạng thái chuyển Accepted khi bắt đầu `P07-10`, khi chủ dự án đồng ý.
