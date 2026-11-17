# Handoff — phase10-closeout (2026-11-17, class M, 1 session)

- Không đổi code. Phase 10 **vẫn chưa đóng**; chỉ chủ dự án quyết định đóng.
- Smoke dev VM: **một phần**. Chủ dự án tự đăng nhập `admin1` trong pane (tôi không nhập mật khẩu). PASS: `/quan-tri`,
  `/quan-tri/cong-dong` (hàng đợi chuyến/đánh giá/báo cáo tải được), 375/768/1280 không tràn, 1 h1, không nút <44px.
  PASS thêm: báo cáo lập→resolve→gỡ review thử (audit: report_actioned, remove). NOT RUN: approve/remove chuyến, cổng Terms (cần member),
  limiter qua restart (cần restart VM). Không gửi POST báo cáo hàng loạt. Mật khẩu đã lộ trong chat: nên đổi.
- `GUEST_KEY_SECRET=` trong `deploy/.env.example`: **chưa có** trên `main` @ `9f27432`; sửa `deploy/`
  bị quy tắc quyền của session chặn → chủ dự án tự thêm dòng `GUEST_KEY_SECRET=` (không giá trị).
- Việc của chủ dự án (không làm thay): P10-7 (sao lưu dev, `metadataBase`, HSTS trên HTTPS thật), D5 (text
  Terms, `termsVersion`), D10 (proxy/log nginx thật).
- W1/W2 đã merge (#143); `/sec-check` lại cho phần này: NOT RUN.
- Kiểm tra: typecheck PASS; lint PASS; test PASS (84 file pass, 3 skipped; 1097 passed, 78 skipped, không có Postgres); build NOT RUN.
