# Handoff — P04-4 Danh sách lịch trình mẫu (WEB-2)

- Nhánh: `feat/trip-template-list` (từ `origin/main` @ `de97840`, sau #198). PR: **chưa mở** (chờ chủ dự án cho phép). Chưa commit/push.
- Đã xong: trang `/trip-templates` (VI `/lich-trinh-mau`), `src/server/content/public-templates.ts` (allow-list + `listPublicTemplates`),
  `components/templates/{template-card,template-states}.tsx`, routing, sitemap, link footer, nút `/plan-your-trip` → `/trip-templates` (Q3),
  messages VI/EN (`tripTemplates`, `nav.tripTemplates`, chữ nút plan), docs `trip-template-list.*` + README + architecture + follow-hung-footsteps.
- Ngoài kế hoạch: sửa `tests/plan-your-trip-links.test.ts` (đích nút đổi từ `/stories` sang `/trip-templates`, hệ quả của Q3). `npm ci` trong worktree (chưa có node_modules).
- Kiểm tra (thật): `typecheck` PASS · `lint` PASS · `test` PASS (114 file, 1407 test, 95 skip có sẵn) · `build` PASS (route `/[locale]/trip-templates` có mặt).
- Kiểm tay 375/768/1280 VI + EN: PASS (1 h1, 1 link/thẻ cao 48px, không tràn ngang, link EN `/en/trip-setup/...`, footer có link). Trạng thái rỗng/lỗi chỉ kiểm bằng test jsdom + node, chưa nhìn bằng mắt.
- `/qc-check`: NOT RUN (khuyến nghị: a11y, VI/EN). `/sec-check`: NOT RUN (khuyến nghị nhẹ: projection công khai).
- Rủi ro: P07-21 (template public còn sống khi story nguồn đã draft/xóa vẫn hiện); API `GET /api/travel/templates` vẫn trả nguyên template.
- EN hiển thị chi phí "₫750,000" còn VI "0,8 triệu đ" do `formatVnd` hiện có, không đổi.
- Mở: Q5 — tạo việc riêng cho projection API templates (chưa có ID); cần template thật từ chủ dự án (seed chỉ có 1).
- Tiếp: chủ dự án cho phép commit + mở PR; không merge ở session này.
