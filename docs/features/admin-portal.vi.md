# Tính năng — Cổng quản trị (đợt 1)

🇬🇧 English version: [admin-portal.md](admin-portal.md)

## Mục đích

Một trang trên trình duyệt để quản trị viên đã đăng nhập quản lý người dùng
Planner mà không cần `curl`: xem danh sách, tạo người dùng, đổi vai trò, cấp lại
mật khẩu. Trang phục vụ chủ site và không ai khác; không có liên kết nào từ
điều hướng công khai. Quyết định thiết kế:
[ADR 0010](../adr/0010-admin-portal-session-authorization.vi.md). Mô hình vai trò
nằm ở [admin-roles.vi.md](admin-roles.vi.md).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin` | `/quan-tri` | `/en/admin` |

Route do kiến trúc sư định nghĩa; frontend thêm vào `src/i18n/routing.ts` theo contract đã duyệt. Trang dùng các endpoint `/api/admin/planner/users*` sẵn có, vừa được mở cho phiên cookie trong cùng đợt này (backend).

## Dữ liệu

- Đọc `GET /api/admin/planner/users` (`{ users, count }`): `id`, `handle`, `displayName`, `email?`, `role?` (vắng mặt nghĩa là `member`), `createdAt`. API không bao giờ trả về hash thông tin xác thực.
- Ghi qua `POST /api/admin/planner/users`, `PATCH /api/admin/planner/users/:id` (`{ role }`) và `POST /api/admin/planner/users/:id/reset-password`.
- Bí mật dùng một lần (`accessToken`, `temporaryPassword`) chỉ tồn tại trong state của React.
- Thông điệp: namespace `admin` trong `messages/vi.json` và `messages/en.json`. Không bao giờ hiển thị chữ lỗi của server; mỗi `code` lỗi ánh xạ sang một thông báo đã bản địa hoá.

## Cách hoạt động

1. `src/app/[locale]/admin/page.tsx` là server component động. `readAdminPageAccess()` quyết định: chưa đăng nhập thì chuyển tới trang đăng nhập theo ngôn ngữ, kèm `returnTo` về trang quản trị; admin đang dùng mật khẩu tạm thì chuyển tới trang đổi mật khẩu; người đã đăng nhập nhưng không phải admin nhận `notFound()`; admin thì hiển thị trang. Metadata là `noindex, nofollow`.
2. Một client island duy nhất, `AdminConsole`, nằm dưới tiêu đề. Nó là client component vì giữ state form, gọi `fetch` cùng origin kèm cookie phiên và giữ bí mật trong bộ nhớ. Nó không bao giờ chứa `ADMIN_API_TOKEN`.
3. Bảng có một dòng cho mỗi người dùng: `<select>` vai trò kèm nút Lưu, và nút Cấp lại mật khẩu có bước xác nhận ngay tại chỗ. Dòng của chính admin đang đăng nhập bị vô hiệu cả hai (server cũng từ chối).
4. Sau khi tạo hoặc cấp lại, một khung nổi bật hiện bí mật đúng một lần, có nút Sao chép (và ô chỉ đọc có thể bôi chọn khi không dùng được clipboard, như trên HTTP thường) cùng nút "Tôi đã lưu lại" để đóng.
5. Kết quả và lỗi vào một vùng `aria-live`. `401` có liên kết đăng nhập lại; `403`, `409`, `422` (nêu tên trường), `429` (số giây từ `Retry-After`) và `404` đều có thông báo riêng.
6. Nút đăng xuất dùng lại `DELETE /api/planner/session`.
7. `robots.txt` chặn cả hai đường dẫn, `next.config.ts` gửi `X-Robots-Tag: noindex, nofollow`, sitemap không liệt kê trang, và `safeReturnTo` cho phép `/quan-tri` và `/en/admin`.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/admin/page.tsx` | Cổng ở server, metadata, một `<h1>` |
| `src/components/admin/admin-console.tsx` | Client island: gọi API, vùng trạng thái, ánh xạ lỗi, đăng xuất |
| `src/components/admin/user-table.tsx` | Bảng người dùng, đổi vai trò, cấp lại có xác nhận |
| `src/components/admin/create-user-form.tsx` | Form tạo người dùng |
| `src/components/admin/secret-panel.tsx` | Hiện và sao chép bí mật dùng một lần |
| `src/components/admin/types.ts` | Hình dạng API mà UI đọc |
| `src/components/planner/api.ts` | `ApiError` giờ mang `issuePaths` của lỗi 422 |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route và danh sách `returnTo` cho phép |
| `src/app/robots.ts`, `next.config.ts` | Loại khỏi công cụ tìm kiếm |
| `messages/vi.json`, `messages/en.json` | Namespace `admin` |
| `tests/admin-portal.test.ts` | Test bên dưới |
| `scripts/admin-create.ts`, `src/server/planner/admin-bootstrap.ts` | `npm run admin:create`: tạo admin đầu tiên với mật khẩu tạm ngẫu nhiên, ghi thẳng vào kho |

## Test

`tests/admin-portal.test.ts` kiểm tra mục route, danh sách `returnTo` (và từ chối các giá trị gần giống), `robots` disallow, mã nguồn sitemap không nhắc tới route, các luật `X-Robots-Tag` mà vẫn giữ nguyên redirect tour, và không file nào trong `src/components/admin` nhắc `ADMIN_API_TOKEN`, đọc `process.env`, import `src/server` hay dùng web storage. `tests/client-boundary.test.ts`, `tests/i18n.test.ts`, `tests/return-to.test.ts` và `tests/design-tokens.test.ts` phủ phần còn lại. Cổng ở server do `tests/planner-admin-session.test.ts` (backend) phủ. Chưa test: tương tác của island trên trình duyệt (dự án chưa có công cụ test DOM). `admin:create` được kiểm bởi `tests/admin-bootstrap.test.ts`.

## Giới hạn và câu hỏi còn mở

- Chỉ là đợt 1: chưa có CMS nội dung, nhật ký kiểm toán, MFA, xoá người dùng, đổi mã truy cập hay huỷ liên kết Google trên trình duyệt.
- Khi chưa có nhật ký kiểm toán, admin nào cũng có thể cấp lại mật khẩu của admin khác (ADR 0010).
- Người không phải admin nhận 404 có chủ ý, nên không phân biệt được "không có trang" với "không được phép"; chọn 404 hay 403 là câu hỏi còn mở cho chủ site trong ADR.
- Giới hạn tốc độ tính theo từng tiến trình.
- HTTP thường trên mạng LAN làm lộ mật khẩu và cookie; ngoài môi trường phát triển hãy dùng HTTPS.
