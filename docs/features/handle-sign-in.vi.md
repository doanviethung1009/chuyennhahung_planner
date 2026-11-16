# Tính năng — Đăng nhập bằng handle và cấp lại mật khẩu khi chưa có email

🇬🇧 English: [handle-sign-in.md](handle-sign-in.md)

## Tóm tắt

Người dùng đăng nhập bằng email hoặc mã tài khoản (handle) cùng mật khẩu ([ADR 0018](../adr/0018-handle-sign-in.vi.md)). Nút "Cấp lại mật khẩu" trong trang quản trị nay chạy được với tài khoản chưa có email, đây là lý do trước đó vận hành viên không cấp được mật khẩu cho họ.

## Đường dẫn

`POST /api/planner/session` body `{ "identifier": "<email hoặc handle>", "password": "…" }` (dạng cũ `{ "email", "password" }` vẫn dùng được). `POST /api/admin/planner/users/[userId]/reset-password` không còn trả 409 cho tài khoản chưa có email. Trang: `/dang-nhap` (`/sign-in`).

## Dữ liệu

Không đổi dữ liệu lưu. Các khóa `signIn.description`, `signIn.divider`, `signIn.emailLabel`, `signIn.errorCredentials` và `admin.users.create.emailHint` được viết lại trong `messages/vi.json` và `messages/en.json`.

## Cách hoạt động

1. Form gửi `identifier`; schema cắt khoảng trắng và chuyển chữ thường.
2. `signInWithPassword` tìm theo email nếu giá trị có `@`, còn lại tìm theo handle, và bỏ qua tài khoản bị khóa hoặc xóa.
3. Tài khoản không tồn tại, chưa có mật khẩu, sai mật khẩu và tài khoản bị vô hiệu đều trả cùng một `401` sau một lần scrypt; áp dụng giới hạn theo IP và theo tài khoản.
4. Mật khẩu tạm vẫn đưa người dùng tới trang đổi mật khẩu trước.
5. Cấp lại mật khẩu cho tài khoản chưa có email lưu mật khẩu tạm và kết thúc mọi phiên của người đó; vận hành viên đưa handle và mật khẩu cho họ.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/server/planner/schemas.ts` | `signInSchema` nhận `identifier` (và `email` cũ) |
| `src/server/planner/repository.ts` | `signInWithPassword` theo email hoặc handle; `resetUserPassword` bỏ ràng buộc email |
| `src/app/api/planner/session/route.ts` | Khóa giới hạn theo tài khoản là id tài khoản khớp (`signInBucketKey`) |
| `src/components/planner/sign-in-form.tsx` | Ô văn bản ghi email hoặc mã tài khoản |
| `messages/{vi,en}.json` | Nhãn và thông báo lỗi |

## Kiểm thử

`tests/planner-password.test.ts` kiểm tra user chưa có email được cấp lại mật khẩu rồi đăng nhập bằng handle, handle không phân biệt hoa thường, handle không tồn tại, chưa có mật khẩu và sai mật khẩu cho cùng một từ chối, và tài khoản bị khóa bị từ chối. `tests/planner-postgres.integration.test.ts` có cùng kịch bản trên PostgreSQL; chỉ chạy khi có `TEST_DATABASE_URL`. Chưa kiểm thử: form trên trình duyệt.

## Giới hạn và câu hỏi mở

- Lỗi đăng nhập là một thông báo chung cho mọi trường hợp, kèm gợi ý dùng Google hoặc liên hệ nhà Hưng cho tài khoản chưa có mật khẩu, nên không lộ tài khoản nào tồn tại mà người dùng cũng không bị kẹt.
- Lỗi 409 nay có `error.reason` (`self_action`, `last_admin`, `last_super_admin`, `account_disabled`, `not_soft_deleted`, `confirm_handle`) và trang quản trị hiện một thông báo riêng cho từng lý do thay vì một câu chung cho mọi từ chối.
- Handle nay là tên đăng nhập; handle dễ đoán dựa vào giới hạn tốc độ và mật khẩu tạm mạnh.
- Tạo user không có email vẫn không cấp mật khẩu; hãy bấm Cấp lại mật khẩu sau đó.
- Nên chạy `/sec-check`, hiện chưa chạy.
