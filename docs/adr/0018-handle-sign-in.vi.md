# ADR 0018 — Đăng nhập bằng mã tài khoản (handle) và cấp lại mật khẩu khi chưa có email

🇬🇧 English: [0018-handle-sign-in.md](0018-handle-sign-in.md)

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-11-16
- **Chủ sở hữu:** system-architect

## Bối cảnh

[ADR 0007](0007-password-and-google-sign-in.vi.md) cho đăng nhập bằng email và mật khẩu, còn `resetUserPassword` từ chối tài khoản không có email (`409 invalid_state`). Vì vậy tài khoản do vận hành viên tạo mà chưa có email không bao giờ được cấp mật khẩu, và trang quản trị lại hiện câu "không thể đổi vai trò của chính mình…" không liên quan cho lỗi 409 đó. Chủ dự án muốn các tài khoản này đăng nhập bằng mã tài khoản (handle).

## Quyết định

1. `POST /api/planner/session` nhận `{ identifier, password }`; `identifier` là email hoặc handle. Dạng cũ `{ email, password }` vẫn được nhận và đọc như `identifier`.
2. Máy chủ cắt khoảng trắng, chuyển chữ thường, tra theo email nếu có `@` (handle không có ký tự này), còn lại tra theo handle. Handle và email đều duy nhất nên tối đa một ứng viên.
3. Giữ nguyên có chủ đích: một `401` chung cho tài khoản không tồn tại, chưa có mật khẩu, sai mật khẩu và (theo `isDisabled`) tài khoản bị khóa hoặc xóa mềm; luôn chạy một lần scrypt; giới hạn tốc độ theo IP và theo tài khoản (nhóm theo tài khoản lấy khóa là id của tài khoản khớp, nên handle và email dùng chung một nhóm); bước bắt đổi mật khẩu tạm.
4. `resetUserPassword` không còn đòi email. Handle là tên đăng nhập nên cấp lại mật khẩu cho tài khoản chưa có email nay chạy được.
5. Không đổi schema hay migration; handle đã lưu chữ thường.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): một trường `identifier`, email hoặc handle | Một form, không lộ tài khoản có tồn tại, thay đổi nhỏ | Thêm một lần đọc snapshot mỗi lượt để xác định khóa |
| B: trường hoặc route riêng cho handle | Rõ ràng | Hai dạng đăng nhập phải giữ giống hệt nhau; form phải hỏi dạng nào |

B thua vì thêm bề mặt mà không có lợi ích.

## Hệ quả

Dễ hơn: tài khoản chưa có email được cấp mật khẩu và dùng ngay. Khó hơn: handle trở thành tên đăng nhập, nên handle dễ đoán là mục tiêu dò mật khẩu trực tuyến; phòng vệ là các giới hạn tốc độ hiện có và mật khẩu tạm 12 ký tự, và handle không bao giờ hiện cho người chưa đăng nhập.

Đánh đổi được chấp nhận: nhóm theo tài khoản chỉ lấy khóa là tài khoản, nên ai biết handle có thể dùng hết 5 lượt mỗi 15 phút của người đó và làm chậm đăng nhập bằng mật khẩu của họ tối đa 15 phút. Điều này theo đúng ADR 0007 (làm chậm, không khóa hẳn) và đã đúng với email. Nó không ảnh hưởng đăng nhập bằng Google hay mã truy cập, nhóm theo IP vẫn giới hạn kẻ tấn công, và không tài khoản nào bị chiếm. Phương án khóa theo IP cộng tài khoản bị loại: kẻ đoán chỉ cần đổi địa chỉ là nhân được ngân sách đoán, và khóa IP phụ thuộc proxy ghi đè `X-Forwarded-For`. Chỉ xem lại (ví dụ thử thách sau nhiều lần sai) nếu thấy bị lạm dụng.

## Việc tiếp theo

Chạy `/sec-check` (thay đổi xác thực). Tài liệu tính năng: [handle-sign-in](../features/handle-sign-in.vi.md).
