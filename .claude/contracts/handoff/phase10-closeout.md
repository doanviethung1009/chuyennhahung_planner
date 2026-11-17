# Handoff — phase10-closeout (2026-11-17, class M, 1 session)

- Không đổi code. Phase 10 **vẫn chưa đóng**; chỉ chủ dự án quyết định đóng.
- Smoke có đăng nhập trên dev VM: **NOT RUN**. Chưa có tài khoản member/admin dev; không tự tạo,
  không nhập mật khẩu. Đã hỏi session `phase10-contract` chuyển câu hỏi cho chủ dự án.
  Mục NOT RUN: cổng Terms, UI Terms 375/768/1280, hàng đợi admin + UI, chuỗi request→approve→remove
  (audit), báo cáo lập→resolve, bộ đếm limiter qua restart. Không gửi POST báo cáo hàng loạt.
- `GUEST_KEY_SECRET=` trong `deploy/.env.example`: **chưa có** trên `main` @ `9f27432`; sửa `deploy/`
  bị quy tắc quyền của session chặn → chủ dự án tự thêm dòng `GUEST_KEY_SECRET=` (không giá trị).
- Việc của chủ dự án (không làm thay): P10-7 (sao lưu dev, `metadataBase`, HSTS trên HTTPS thật), D5 (text
  Terms, `termsVersion`), D10 (proxy/log nginx thật).
- W1/W2 đã merge (#143); `/sec-check` lại cho phần này: NOT RUN.
- Kiểm tra: typecheck PASS; lint PASS; test PASS (84 file pass, 3 skipped; 1097 passed, 78 skipped, không có Postgres); build NOT RUN.
