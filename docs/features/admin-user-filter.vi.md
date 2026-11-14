# Tính năng — Tìm kiếm và lọc vai trò người dùng ở trang quản trị

🇻🇳 English version: [admin-user-filter.md](admin-user-filter.md)

## Summary

Ô tìm kiếm và bộ lọc vai trò phía trên bảng người dùng của cổng quản trị, để admin
tìm nhanh một người trong danh sách dài. Việc lọc diễn ra trên trình duyệt, trên danh
sách đã tải; không thêm hay đổi API. Xây trên [admin-portal.vi.md](admin-portal.vi.md).

## Routes

Không có. Tính năng nằm trên trang `/quan-tri` (`/en/admin`) sẵn có.

## Data

- Đọc `AdminUser[]` mà trang đã có: `handle`, `displayName`, `email?`, `role?` (thiếu thì coi là `member`).
- Thông điệp: các khoá mới trong `admin.users` (`searchLabel`, `searchPlaceholder`, `filterRoleLabel`, `filterRoleAll`, `filterClear`, `filterResult`, `filterEmpty`) ở cả `messages/vi.json` và `messages/en.json`.

## How it works

1. `UserTable` giữ hai state là từ khoá và vai trò lọc, rồi hiển thị `filterUsers(users, query, role)`.
2. Từ khoá khớp tên hiển thị, handle hoặc email theo kiểu chứa chuỗi, không phân biệt hoa thường và bỏ dấu tiếng Việt (`đ` coi như `d`), nên "hung" tìm được "Hưng".
3. Bộ lọc vai trò gồm mọi vai trò cùng thành viên, biên tập viên, quản trị viên; user không có `role` tính là thành viên. Từ khoá và vai trò kết hợp bằng AND.
4. Khi đang lọc, dòng `role="status"` đọc "Hiển thị x/y", và nút Xoá bộ lọc đặt lại cả hai. Nếu không khớp, bảng được thay bằng một thông báo ngắn.
5. Thao tác trên dòng (đổi vai trò, cấp lại mật khẩu) hoạt động như cũ trên các dòng đã lọc; bản nháp và trạng thái xác nhận gắn theo id người dùng nên không mất khi lọc.

## Files

| Path | Role |
|---|---|
| `src/components/admin/filter-users.ts` | `normalizeSearch` và `filterUsers` thuần |
| `src/components/admin/user-table.tsx` | Ô tìm kiếm, select vai trò, dòng kết quả, trạng thái rỗng |
| `messages/vi.json`, `messages/en.json` | Khoá `admin.users` mới |
| `tests/admin-user-filter.test.ts` | Test đơn vị cho bộ lọc |

## Tests

`tests/admin-user-filter.test.ts` kiểm tra từ khoá rỗng, khớp theo tên, handle, email, bỏ dấu và hoa thường, thiếu role coi là member, kết hợp từ khoá với vai trò, và gấp `đ` thành `d`. `tests/i18n.test.ts` kiểm tra khoá khớp nhau. Chưa test: tương tác trên trình duyệt (chưa có test runner DOM).

## Limits and open questions

- Chỉ phía client: chỉ tìm trong danh sách đã tải, nên đầy đủ đến mức danh sách đó (hiện chưa phân trang).
- Khớp chuỗi con, không xếp hạng hay khớp mờ.
- Trạng thái lọc không nằm trên URL và mất khi tải lại.
