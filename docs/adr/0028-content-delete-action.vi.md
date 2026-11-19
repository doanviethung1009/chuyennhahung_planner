# ADR 0028 — `content:delete`: xóa vĩnh viễn một địa điểm là hành động của admin

🇻🇳 English version: [0028-content-delete-action.md](0028-content-delete-action.md)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-19
- **Người chịu trách nhiệm:** system-architect
- **Ảnh hưởng:** `src/server/identity/permissions.ts` (một action), `src/app/api/admin/travel/places/[slug]/route.ts` (`DELETE`), trình sửa địa điểm trong admin và trang ma trận vai trò, `messages/*.json`. Không đổi database, migration hay route mới. Task Contract `CORE-10`; dựa trên [ADR 0006](0006-unified-identity-and-roles.vi.md), [ADR 0011](0011-admin-content-cms.vi.md) và [ADR 0017](0017-super-admin-role.vi.md).

## Bối cảnh

`DELETE /api/admin/travel/places/[slug]` chỉ nhận `ADMIN_API_TOKEN`, nên admin không xóa được địa điểm từ trình duyệt. `can()` chưa có action nào cho việc xóa vĩnh viễn nội dung; các action gần nhất (`community:erase`, `user:provision`) mang nghĩa khác. Chủ dự án đã quyết định (2026-11-19) rằng xóa vĩnh viễn không phải việc của editor, và yêu cầu nút xóa chỉ hiện với super admin và admin.

## Quyết định

1. **Action mới `content:delete`.** Thuộc `admin`, `super_admin` và token dịch vụ; không thuộc `editor` hay `member`. Được thêm vào `ROLE_ACTIONS` — nơi duy nhất mở rộng quyền — và hiện trong ma trận vai trò.
2. **Route bật chế độ session.** `DELETE places/[slug]` dùng `adminContentRoute(request, { action: 'content:delete', session: true })`: token vẫn dùng được; session cần chứng minh same-origin, bị giới hạn tốc độ (30 lần mỗi phút mỗi người) và nhận 403 nếu vai trò không có action. Quy tắc `place_in_use` (409) và fail-closed (503) của CORE-9 giữ nguyên.
3. **Nút chỉ là tiện lợi, API mới là chốt chặn.** Trang tính `can(principal, 'content:delete')` ở server và truyền một boolean xuống trình sửa, giống trang community với `community:erase`. Ẩn nút không bao giờ là cơ chế kiểm soát.
4. **Phạm vi chỉ là địa điểm.** Story, review, collection và template vẫn chỉ cho `DELETE` bằng token.

## Hệ quả

- Session admin giờ xóa vĩnh viễn được một địa điểm không còn tham chiếu. Chốt 409 và báo cáo integrity là lưới an toàn; không có soft delete hay hoàn tác.
- Thêm một dòng vào ma trận quyền; test ghim principal nào có action này.
- Mở rộng cùng action sang loại nội dung khác sau này chỉ là đổi một dòng ở route kèm ghi chú ở đây, không cần quyền mới.
- Xóa là không thể hoàn tác, không dùng `If-Match` (chốt tham chiếu của CORE-9 là lớp bảo vệ) và chưa ghi vào audit log; cả hai có thể thêm sau mà không đổi action.
