# Feature — Admin users and roles

🇻🇳 English: [admin-users-roles.md](admin-users-roles.md)

## Summary

Quản trị viên làm trên trình duyệt những việc trước đây chỉ có `curl`: gỡ liên kết đăng nhập Google, xoay token truy cập của người dùng, và phân trang danh sách lớn. Một trang chỉ-xem cho biết mỗi vai trò được làm gì và được quản lý tài khoản nào. Không thêm vai trò, action hay audit event (P07-12).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/users/roles` | `/quan-tri/nguoi-dung/vai-tro` | `/admin/users/roles` |

API (bổ sung): `GET /api/admin/planner/users?limit&cursor&sort`, `DELETE /api/admin/planner/users/[userId]/google`, `POST /api/admin/planner/users/[userId]/rotate-token` (hai route này nay nhận cả cookie phiên admin).

## Data

Đọc `ROLE_ACTIONS` và `canManageRole` (`src/server/identity/permissions.ts`); namespace message `adminRoles`, cùng các khóa `admin.users` và `admin.status` cho nút mới. `AdminUser.hasGoogle` (vốn đã công khai) quyết định có hiện *Gỡ liên kết Google* hay không.

## How it works

- **Ma trận:** server component không props; mỗi ô tính từ nguồn phân quyền nên không thể lệch. Hai bảng: thao tác theo vai trò, và vai trò nào quản lý được vai trò đích nào. Chặn như bảng điều khiển người dùng (`user:provision`; người khác nhận 404).
- **Phân trang:** không có query = toàn bộ tài khoản như cũ. Bất kỳ `limit` (1–200, lớn hơn bị chặn trần), `cursor`, `sort` (`handle` mặc định, `created`, `-created`) bật phân trang keyset; phản hồi thêm `total` và `nextCursor`. Cursor ghi dòng cuối đã thấy (khóa sắp xếp + id) nên tài khoản tạo giữa các trang không bị lặp hay bỏ sót. Cursor sai hoặc của kiểu sắp xếp khác trả 422. Repository không đổi: route cắt danh sách có sẵn (`src/server/planner/user-page.ts`).
- **Thao tác thông tin xác thực:** console hiện xác nhận có sẵn rồi gọi API. Với phiên session, route kiểm `canManageRole` trên đích trước khi ghi (admin → chỉ member/editor; super admin → mọi người; còn lại 403, id không có 404; tự xoay token của mình là 409 `self_action`). Token mới trả về một lần, `no-store`, chỉ nằm trong state của `SecretPanel`.
- **Phân trang trên UI:** console tải 50 dòng mỗi lần với *Tải thêm*. Tìm kiếm và lọc vai trò chạy trên các dòng đã tải; còn trang chưa tải thì có ghi chú.

## Files

| Path | Role |
|---|---|
| `src/server/planner/user-page.ts` | mã hóa/kiểm cursor, sắp xếp, cắt trang |
| `src/server/planner/manage-user.ts` | kiểm `canManageRole` cho hai route |
| `src/app/api/admin/planner/users/route.ts` | query phân trang |
| `src/app/api/admin/planner/users/[userId]/{google,rotate-token}/route.ts` | nhận phiên + kiểm vai trò |
| `src/components/admin/roles-matrix.tsx` | ma trận |
| `src/app/(admin)/[locale]/admin/users/roles/page.tsx` | trang |
| `src/components/admin/{admin-console,user-table,types}.ts*` | phân trang và hai thao tác mới |
| `src/i18n/routing.ts`, `src/lib/return-to.ts`, `messages/*.json` | đường dẫn, return-to, chuỗi |

## Tests

`tests/admin-roles-matrix.test.ts`: vai trò và action khớp nguồn; mỗi mục có nhãn VI và EN; hai đường dẫn tồn tại. `tests/admin-users-paging-credentials.test.ts`: không query thì không đổi; phân trang đi qua mọi tài khoản đúng một lần với từng kiểu sắp xếp, kể cả khi tạo mới đồng thời; trần `limit`, `limit`/cursor/sort sai và cursor của kiểu sắp xếp khác là 422; 401/403/404 và việc admin bị từ chối với admin cho cả hai thao tác; token mới một lần, `no-store`, token cũ chết. Smoke trình duyệt 375/768/1280: NOT RUN.

## Limits and open questions

- Bộ lọc không tìm trong các trang chưa tải; không thêm lọc phía server (ngoài phạm vi).
- Kiểm vai trò nằm ở route, không ở repository (file dùng chung với Phase 10), nên nếu vai trò đổi giữa lúc kiểm và lúc ghi thì có một race hẹp.
- Phân trang cắt danh sách trong bộ nhớ; nó giới hạn kích thước phản hồi, không giới hạn lần đọc repository.
- Không thêm audit event ở đây (P07-13); bản ghi `token_rotate` / `google_unlink` sẵn có nay mang tên admin thực hiện. `/sec-check` được khuyến nghị và NOT RUN.
