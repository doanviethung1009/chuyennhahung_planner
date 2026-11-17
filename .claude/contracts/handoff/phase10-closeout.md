# Handoff — phase10-closeout (2026-11-18, class M, 1 session)

- Không đổi code. Phase 10 **vẫn chưa đóng**; chỉ chủ dự án quyết định đóng.
- Smoke dev VM (chủ dự án tự đăng nhập `admin1` trong pane; không nhập mật khẩu). PASS: `/quan-tri`, hàng đợi
  `/quan-tri/cong-dong`, 375/768/1280 (1 h1, không tràn, ≥44px), báo cáo lập→resolve→gỡ review thử, cổng Terms
  (403 `terms_not_accepted` rồi cho phép sau đồng ý) + UI Terms 3 độ rộng, chuyến request→approve→remove (audit đủ).
  NOT RUN: bộ đếm limiter qua restart (cần restart VM), view restrictions. Không gửi báo cáo hàng loạt.
- Dữ liệu dev đổi: review thử `removed`; `admin1` đồng ý Terms; chuyến thử `trip_13a30fd5` còn trong `admin1`.
- `GUEST_KEY_SECRET=` rỗng đã thêm vào `deploy/.env.example` (commit `cd361f6`, chủ dự án thêm).
- Việc của chủ dự án: P10-7 (sao lưu dev, `metadataBase`, HSTS), D5 (text Terms, `termsVersion`), D10 (proxy/log nginx).
- Nên đổi mật khẩu `admin1` (đã lộ trong chat) và xoay `ADMIN_API_TOKEN`, mật khẩu `cnh_app`, `GUEST_KEY_SECRET`.
- W1/W2 đã merge (#143); `/sec-check` lại phần này: NOT RUN. `build`: NOT RUN.
- Kiểm tra (2026-11-17): typecheck PASS; lint PASS; test PASS (1097 passed, 78 skipped); commit sau đó chỉ docs/env.
